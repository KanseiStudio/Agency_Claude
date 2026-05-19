'use server';

// Server actions di approvazione/rifiuto del brief iniziale e
// trigger del Direttore Operativo.
// Solo admin loggato può eseguirle.

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma, Prisma } from '@kansei/database';
import {
  runAgent,
  direttoreOperativoAgent,
  financeAdminAgent,
  creativeLeadAgent,
  copyAgentAgent,
  artDesignAgent,
  projectManagerAgent,
  direttoreOutputSchema,
  copyAgentOutputSchema,
  artDesignOutputSchema,
  generatedAssetSchema,
  dispatchAssetGeneration,
  getModelById,
  type FinanceAdminOutput,
  type ArtDesignOutput,
  type GeneratedAsset,
  type GeneratedKeyframe,
  type EmailKind,
} from '@kansei/agents';
import { sendProjectEmail, safelyTriggerEmail } from '@/lib/notifications';
import { z } from 'zod';
import { getStorage } from '@kansei/storage';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    throw new Error('Non autorizzato.');
  }
  return session;
}

export async function approveBriefAction(projectId: string): Promise<{ ok: boolean }> {
  const session = await requireAdmin();

  await prisma.$transaction(async (tx) => {
    const approval = await tx.approval.findFirst({
      where: { projectId, checkpointCode: 'brief_iniziale', esito: 'pending' },
    });
    if (!approval) throw new Error('Approvazione non trovata o già decisa.');

    await tx.approval.update({
      where: { id: approval.id },
      data: {
        esito: 'approvato',
        decidedAt: new Date(),
        decidedById: session.user.id,
      },
    });

    await tx.project.update({
      where: { id: projectId },
      data: { stato: 'in_analisi' },
    });

    await tx.event.create({
      data: {
        projectId,
        tipo: 'project.brief_approved',
        payload: { decidedBy: session.user.email },
      },
    });
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/projects');
  return { ok: true };
}

/**
 * Lancia il Direttore Operativo sul progetto. Sincrono: l'admin attende
 * il completamento (con MOCK_LLM è ~300ms; con LLM reale 5-30s).
 * In V2 lo sposteremo dietro una coda asincrona.
 */
export async function runDirettoreOperativoAction(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { ragioneSociale: true } },
      briefs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!project) return { ok: false, error: 'Progetto non trovato.' };
  const brief = project.briefs[0];
  if (!brief) return { ok: false, error: 'Brief non trovato per questo progetto.' };

  try {
    await runAgent(
      direttoreOperativoAgent,
      {
        projectId: project.id,
        codiceProgetto: project.codiceProgetto,
        titolo: project.titolo,
        descrizione: brief.descrizione,
        deliverableRichiesti: Array.isArray(brief.deliverableRichiesti)
          ? (brief.deliverableRichiesti as string[])
          : [],
        deadline: brief.deadline ? brief.deadline.toISOString().slice(0, 10) : null,
        budgetIndicativoEur: brief.budgetIndicativoCents ? brief.budgetIndicativoCents / 100 : null,
        clientName: project.client.ragioneSociale,
        language: project.language as 'it' | 'en',
      },
      { projectId: project.id },
    );

    await prisma.event.create({
      data: {
        projectId: project.id,
        tipo: 'agent.direttore_operativo.success',
      },
    });
  } catch (e) {
    const message = (e as Error).message;
    await prisma.event.create({
      data: {
        projectId: project.id,
        tipo: 'agent.direttore_operativo.failed',
        payload: { error: message },
      },
    });
    return { ok: false, error: `Direttore Operativo fallito: ${message}` };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/**
 * Genera il preventivo via Finance/Admin agent.
 * Richiede che il Direttore Operativo sia già stato eseguito (legge il suo output).
 * Salva quote + quote_items + project_finance_outputs in transazione.
 */
export async function runFinanceAdminAction(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { ragioneSociale: true } },
      briefs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!project) return { ok: false, error: 'Progetto non trovato.' };
  const brief = project.briefs[0];
  if (!brief) return { ok: false, error: 'Brief mancante.' };

  // Blocco se c'è una clarification pending: il Direttore ha rilevato info
  // mancanti, l'admin le ha mandate al cliente, il cliente non ha ancora
  // risposto. Non possiamo procedere con un preventivo basato su un brief
  // incompleto.
  const pendingClarification = await prisma.clarificationRequest.findFirst({
    where: { projectId, status: 'pending' },
  });
  if (pendingClarification) {
    return {
      ok: false,
      error:
        'Il progetto è in attesa di chiarimenti dal cliente. Aspetta che il cliente risponda alle domande prima di generare il preventivo.',
    };
  }

  // Output del Direttore (richiesto)
  const direttoreRaw = await prisma.agentOutput.findFirst({
    where: { projectId, agente: 'direttore-operativo', status: 'success' },
    orderBy: { createdAt: 'desc' },
  });
  if (!direttoreRaw) {
    return { ok: false, error: 'Esegui prima il Direttore Operativo.' };
  }
  const direttoreParsed = direttoreOutputSchema.safeParse(direttoreRaw.payload);
  if (!direttoreParsed.success) {
    return { ok: false, error: 'Output Direttore non valido. Rieseguilo.' };
  }
  const direttore = direttoreParsed.data;

  // Listino servizi attivi
  const services = await prisma.serviceCatalog.findMany({
    where: { attivo: true },
    orderBy: { codice: 'asc' },
  });

  try {
    const result = await runAgent(
      financeAdminAgent,
      {
        projectId: project.id,
        codiceProgetto: project.codiceProgetto,
        titolo: project.titolo,
        descrizione: brief.descrizione,
        deliverableRichiesti: Array.isArray(brief.deliverableRichiesti)
          ? (brief.deliverableRichiesti as string[])
          : [],
        budgetIndicativoEur: brief.budgetIndicativoCents ? brief.budgetIndicativoCents / 100 : null,
        direttoreSummary: direttore.summary,
        requiredAgents: direttore.required_agents,
        estimatedComplexity: direttore.estimated_complexity,
        servicesCatalog: services.map((s) => ({
          codice: s.codice,
          descrizione: s.descrizione,
          prezzoBaseMinEur: s.prezzoBaseMinCents / 100,
          prezzoBaseMaxEur: s.prezzoBaseMaxCents / 100,
          agenteResponsabile: s.agenteResponsabile,
        })),
        language: project.language as 'it' | 'en',
      },
      { projectId: project.id },
    );

    const quote = result.output as FinanceAdminOutput;

    // Persisti Quote + QuoteItem + project_finance_outputs in transazione
    await prisma.$transaction(async (tx) => {
      // Conta quote esistenti per versioning
      const existingCount = await tx.quote.count({ where: { projectId } });

      const quoteRow = await tx.quote.create({
        data: {
          projectId,
          version: existingCount + 1,
          prezzoMinCents: Math.round(quote.prezzo_min_eur * 100),
          prezzoMaxCents: Math.round(quote.prezzo_max_eur * 100),
          gapPct: new Prisma.Decimal(quote.gap_pct),
          breakdown: quote.breakdown as unknown as Prisma.InputJsonValue,
          validUntil: new Date(quote.valid_until),
          status: 'draft',
        },
      });

      await tx.quoteItem.createMany({
        data: quote.breakdown.map((item, idx) => ({
          quoteId: quoteRow.id,
          agente: item.agente,
          voce: item.voce,
          quantita: new Prisma.Decimal(item.quantita),
          prezzoUnitarioCents: Math.round(item.prezzo_unitario_eur * 100),
          prezzoTotaleCents: Math.round(item.prezzo_totale_eur * 100),
          opzionale: item.opzionale,
          ordine: idx,
        })),
      });

      await tx.projectFinanceOutput.create({
        data: {
          projectId,
          prezzoMinCents: Math.round(quote.prezzo_min_eur * 100),
          prezzoMaxCents: Math.round(quote.prezzo_max_eur * 100),
          gapPct: new Prisma.Decimal(quote.gap_pct),
          breakdown: quote.breakdown as unknown as Prisma.InputJsonValue,
          conditions: quote.conditions as unknown as Prisma.InputJsonValue,
          validUntil: new Date(quote.valid_until),
          note: quote.note ?? null,
          rawPayload: quote as unknown as Prisma.InputJsonValue,
          version: existingCount + 1,
        },
      });

      await tx.event.create({
        data: { projectId, tipo: 'agent.finance_admin.success' },
      });
    });
  } catch (e) {
    const message = (e as Error).message;
    await prisma.event.create({
      data: {
        projectId,
        tipo: 'agent.finance_admin.failed',
        payload: { error: message },
      },
    });
    return { ok: false, error: `Finance/Admin fallito: ${message}` };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/**
 * Esegue il Creative Lead. Richiede preventivo accettato + Direttore già eseguito.
 * Salva il concept + brief operativi in `project_creative_outputs`.
 */
export async function runCreativeLeadAction(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { ragioneSociale: true } },
      briefs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!project) return { ok: false, error: 'Progetto non trovato.' };
  const brief = project.briefs[0];
  if (!brief) return { ok: false, error: 'Brief mancante.' };

  // Direttore output (per riepilogo + complessità)
  const direttoreRaw = await prisma.agentOutput.findFirst({
    where: { projectId, agente: 'direttore-operativo', status: 'success' },
    orderBy: { createdAt: 'desc' },
  });
  if (!direttoreRaw) {
    return { ok: false, error: 'Esegui prima il Direttore Operativo.' };
  }
  const direttoreParsed = direttoreOutputSchema.safeParse(direttoreRaw.payload);
  if (!direttoreParsed.success) {
    return { ok: false, error: 'Output Direttore non valido. Rieseguilo.' };
  }
  const direttore = direttoreParsed.data;

  try {
    const result = await runAgent(
      creativeLeadAgent,
      {
        projectId: project.id,
        codiceProgetto: project.codiceProgetto,
        titolo: project.titolo,
        descrizione: brief.descrizione,
        deliverableRichiesti: Array.isArray(brief.deliverableRichiesti)
          ? (brief.deliverableRichiesti as string[])
          : [],
        clientName: project.client.ragioneSociale,
        direttoreSummary: direttore.summary,
        estimatedComplexity: direttore.estimated_complexity,
        language: project.language as 'it' | 'en',
      },
      { projectId: project.id },
    );

    const creative = result.output;
    const existingCount = await prisma.projectCreativeOutput.count({
      where: { projectId: project.id },
    });

    await prisma.$transaction(async (tx) => {
      await tx.projectCreativeOutput.create({
        data: {
          projectId: project.id,
          conceptPrincipale: creative.concept_principale,
          alternativeConcepts: creative.alternative_concepts as unknown as Prisma.InputJsonValue,
          briefCopy: creative.brief_copy,
          briefDesign: creative.brief_design,
          briefVideo: creative.brief_video || null,
          briefAudio: null,
          moodKeywords: creative.mood_keywords as unknown as Prisma.InputJsonValue,
          mustHaves: creative.must_haves as unknown as Prisma.InputJsonValue,
          mustAvoids: creative.must_avoids as unknown as Prisma.InputJsonValue,
          rawPayload: creative as unknown as Prisma.InputJsonValue,
          version: existingCount + 1,
        },
      });

      // Avanza lo stato a in_produzione (se non già lì)
      if (project.stato === 'preventivo_accettato') {
        await tx.project.update({
          where: { id: project.id },
          data: { stato: 'in_produzione' },
        });
      }

      await tx.event.create({
        data: { projectId: project.id, tipo: 'agent.creative_lead.success' },
      });
    });
  } catch (e) {
    const message = (e as Error).message;
    await prisma.event.create({
      data: {
        projectId,
        tipo: 'agent.creative_lead.failed',
        payload: { error: message },
      },
    });
    return { ok: false, error: `Creative Lead fallito: ${message}` };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/projects');
  return { ok: true };
}

/**
 * Esegue il Copy Agent. Richiede Creative Lead già eseguito (legge concept + brief copy).
 * Salva l'output in agent_outputs.
 */
export async function runCopyAgentAction(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { ragioneSociale: true } },
      briefs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!project) return { ok: false, error: 'Progetto non trovato.' };
  const brief = project.briefs[0];
  if (!brief) return { ok: false, error: 'Brief mancante.' };

  const creative = await prisma.projectCreativeOutput.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
  });
  if (!creative) {
    return { ok: false, error: 'Esegui prima il Creative Lead.' };
  }

  try {
    await runAgent(
      copyAgentAgent,
      {
        projectId: project.id,
        codiceProgetto: project.codiceProgetto,
        titolo: project.titolo,
        descrizione: brief.descrizione,
        deliverableRichiesti: Array.isArray(brief.deliverableRichiesti)
          ? (brief.deliverableRichiesti as string[])
          : [],
        clientName: project.client.ragioneSociale,
        conceptPrincipale: creative.conceptPrincipale ?? '',
        briefCopy: creative.briefCopy ?? '',
        moodKeywords: Array.isArray(creative.moodKeywords)
          ? (creative.moodKeywords as string[])
          : [],
        mustHaves: Array.isArray(creative.mustHaves) ? (creative.mustHaves as string[]) : [],
        mustAvoids: Array.isArray(creative.mustAvoids) ? (creative.mustAvoids as string[]) : [],
        language: project.language as 'it' | 'en',
      },
      { projectId: project.id },
    );

    await prisma.event.create({
      data: { projectId, tipo: 'agent.copy_agent.success' },
    });
  } catch (e) {
    const message = (e as Error).message;
    await prisma.event.create({
      data: {
        projectId,
        tipo: 'agent.copy_agent.failed',
        payload: { error: message },
      },
    });
    return { ok: false, error: `Copy Agent fallito: ${message}` };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/**
 * STEP 1 di Art & Design — PROPOSAL.
 *
 * Esegue l'agente per ottenere:
 *   - art_direction (palette + tipografia + riferimenti)
 *   - primary_asset (UN solo asset, image o video)
 *   - recommended_models (3-5 modelli ranked dal registry)
 *
 * NON genera ancora l'asset: salva solo la proposta in agent_outputs.
 * Lo step di generazione vera è in `generateArtDesignAssetAction`,
 * dopo che l'utente ha scelto il modello nel pannello admin.
 */
export async function runArtDesignAction(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { ragioneSociale: true } },
      briefs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!project) return { ok: false, error: 'Progetto non trovato.' };
  const brief = project.briefs[0];
  if (!brief) return { ok: false, error: 'Brief mancante.' };

  const creative = await prisma.projectCreativeOutput.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
  });
  if (!creative) return { ok: false, error: 'Esegui prima il Creative Lead.' };

  try {
    const runResult = await runAgent(
      artDesignAgent,
      {
        projectId: project.id,
        codiceProgetto: project.codiceProgetto,
        titolo: project.titolo,
        descrizione: brief.descrizione,
        deliverableRichiesti: Array.isArray(brief.deliverableRichiesti)
          ? (brief.deliverableRichiesti as string[])
          : [],
        clientName: project.client.ragioneSociale,
        conceptPrincipale: creative.conceptPrincipale ?? '',
        briefDesign: creative.briefDesign ?? '',
        briefVideo: creative.briefVideo ?? undefined,
        moodKeywords: Array.isArray(creative.moodKeywords)
          ? (creative.moodKeywords as string[])
          : [],
        mustHaves: Array.isArray(creative.mustHaves) ? (creative.mustHaves as string[]) : [],
        mustAvoids: Array.isArray(creative.mustAvoids) ? (creative.mustAvoids as string[]) : [],
        language: project.language as 'it' | 'en',
      },
      { projectId: project.id },
    );

    // -------------------------------------------------------------------
    // OVERRIDE FORZATO del prompt video.
    //
    // Indipendentemente da cosa ha generato l'LLM (che spesso parafrasa o
    // semplifica), per asset_type=video forziamo `primary_asset.prompt` ad
    // essere ESATTAMENTE il briefVideo del Creative Lead. Questo garantisce
    // che Seedance riceva la descrizione narrativa precisa concordata, senza
    // interpretazioni dell'agente.
    // -------------------------------------------------------------------
    const out = runResult.output as ArtDesignOutput;
    if (
      out.primary_asset.asset_type === 'video' &&
      creative.briefVideo &&
      creative.briefVideo.trim().length > 0
    ) {
      const overriddenPayload = {
        ...out,
        primary_asset: {
          ...out.primary_asset,
          prompt: creative.briefVideo.trim(),
        },
      };
      await prisma.agentOutput.updateMany({
        where: { runId: runResult.runId, agente: 'art-design' },
        data: { payload: overriddenPayload as unknown as Prisma.InputJsonValue },
      });
    }

    await prisma.event.create({
      data: {
        projectId,
        tipo: 'agent.art_design.proposal_ready',
        payload: { phase: 'proposal' },
      },
    });
  } catch (e) {
    const message = (e as Error).message;
    await prisma.event.create({
      data: {
        projectId,
        tipo: 'agent.art_design.failed',
        payload: { error: message, phase: 'proposal' },
      },
    });
    return { ok: false, error: `Art & Design fallito: ${message}` };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/**
 * STEP 2 di Art & Design — GENERATION.
 *
 * Riceve il modelId scelto dall'utente nel pannello, recupera l'ultima
 * proposal dell'agente, chiama il dispatcher con il primary_asset + modello
 * scelto, salva il file in storage, registra cost tracking e aggiorna il
 * payload agent_outputs con storage_key + model_id usato.
 */
export async function generateArtDesignAssetAction(
  projectId: string,
  modelId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, codiceProgetto: true },
  });
  if (!project) return { ok: false, error: 'Progetto non trovato.' };

  // Recupera l'ultima proposal dell'agente Art & Design (success only)
  const lastOutput = await prisma.agentOutput.findFirst({
    where: { projectId, agente: 'art-design', status: 'success' },
    orderBy: { createdAt: 'desc' },
  });
  if (!lastOutput) {
    return {
      ok: false,
      error: 'Nessuna proposal Art & Design trovata. Esegui prima lo step 1.',
    };
  }

  const proposal = lastOutput.payload as unknown as ArtDesignOutput;
  const asset = proposal.primary_asset;
  if (!asset) {
    return { ok: false, error: 'Proposal senza primary_asset. Rigenera lo step 1.' };
  }

  // Valida che il modelId scelto sia nel registry
  const model = getModelById(modelId);
  if (!model) return { ok: false, error: `Modello "${modelId}" non valido.` };

  // Verifica coerenza tipo asset ↔ tipo modello
  if (model.type !== asset.asset_type) {
    return {
      ok: false,
      error: `Mismatch: l'asset è di tipo ${asset.asset_type} ma il modello ${model.name} produce ${model.type}. Scegli un altro modello.`,
    };
  }

  const storage = getStorage();
  const runId = lastOutput.runId ?? 'manual';
  const KEYFRAME_IMAGE_MODEL = 'openai-gpt-image-2';

  try {
    if (asset.asset_type === 'image') {
      // ============== FLUSSO IMAGE: 1 sola chiamata ==============
      const result = await dispatchAssetGeneration({
        modelId,
        prompt: asset.prompt,
        width: asset.width,
        height: asset.height,
        aspectRatio: asset.aspect_ratio,
        title: asset.title,
      });

      const ext = pickExtension(result.mime);
      const storageKey = `assets/${project.id}/${runId}/primary.${ext}`;
      await storage.put(storageKey, result.bytes, { contentType: result.mime });

      const generated: GeneratedAsset = {
        ...asset,
        storage_key: storageKey,
        mime: result.mime,
        bytes: result.bytes.byteLength,
        model_id: modelId,
      };
      await persistEnrichedPayload(lastOutput.id, proposal, generated);
      await trackUsage(lastOutput.runId, project.id, asset.asset_type, result.meta);
      await prisma.event.create({
        data: {
          projectId,
          tipo: 'agent.art_design.generated',
          payload: { modelId, mime: result.mime },
        },
      });
    } else {
      // ============== FLUSSO VIDEO: keyframes → composizione ==============
      // 1. Genera tutti i keyframe via openai-gpt-image-2
      // 2. Salva in storage e raccogli URL pubbliche
      // 3. Chiama il modello video scelto con l'array di keyframe
      // 4. Salva il video finale
      //
      // Se il modello video è uno stub, i keyframe restano comunque salvati
      // e visibili in UI con messaggio "keyframes ready, video pending wiring".
      if (!asset.image_briefs || asset.image_briefs.length < 2) {
        return {
          ok: false,
          error: 'Asset video senza image_briefs[]. Rigenera la proposal.',
        };
      }

      const keyframes: GeneratedKeyframe[] = [];
      for (const brief of asset.image_briefs) {
        const r = await dispatchAssetGeneration({
          modelId: KEYFRAME_IMAGE_MODEL,
          prompt: brief.prompt,
          width: asset.width,
          height: asset.height,
          aspectRatio: asset.aspect_ratio,
          title: brief.title,
        });
        const ext = pickExtension(r.mime);
        const kfKey = `assets/${project.id}/${runId}/keyframe-${String(brief.index).padStart(2, '0')}.${ext}`;
        await storage.put(kfKey, r.bytes, { contentType: r.mime });
        keyframes.push({
          ...brief,
          storage_key: kfKey,
          mime: r.mime,
          bytes: r.bytes.byteLength,
        });
        await trackUsage(lastOutput.runId, project.id, 'image', r.meta);
      }

      // Salviamo lo stato "keyframes pronti" anche se la composizione video
      // fallirà: i keyframe restano in storage e visibili in UI.
      await persistKeyframesProgress(lastOutput.id, proposal, asset, keyframes);
      await prisma.event.create({
        data: {
          projectId,
          tipo: 'agent.art_design.keyframes_ready',
          payload: { count: keyframes.length },
        },
      });

      // Costruisci URL pubbliche dei keyframe (l'admin storage handler le serve)
      const baseUrl = process.env.ADMIN_PUBLIC_BASE_URL ?? 'http://localhost:3001';
      const imageUrls = keyframes.map(
        (k) => `${baseUrl}/api/storage/${k.storage_key}`,
      );

      // Chiama il modello video con i keyframes
      const videoResult = await dispatchAssetGeneration({
        modelId,
        prompt: asset.prompt,
        aspectRatio: asset.aspect_ratio,
        durationSeconds: asset.duration_seconds,
        imageUrls,
        title: asset.title,
      });

      const videoExt = pickExtension(videoResult.mime);
      const videoKey = `assets/${project.id}/${runId}/primary.${videoExt}`;
      await storage.put(videoKey, videoResult.bytes, {
        contentType: videoResult.mime,
      });

      const generated: GeneratedAsset = {
        ...asset,
        storage_key: videoKey,
        mime: videoResult.mime,
        bytes: videoResult.bytes.byteLength,
        model_id: modelId,
        keyframes,
      };
      await persistEnrichedPayload(lastOutput.id, proposal, generated);
      await trackUsage(lastOutput.runId, project.id, 'video', videoResult.meta);
      await prisma.event.create({
        data: {
          projectId,
          tipo: 'agent.art_design.generated',
          payload: { modelId, mime: videoResult.mime, keyframesCount: keyframes.length },
        },
      });
    }
  } catch (e) {
    const message = (e as Error).message;
    await prisma.event.create({
      data: {
        projectId,
        tipo: 'agent.art_design.failed',
        payload: { error: message, phase: 'generation', modelId },
      },
    });
    // Refresh anche in caso di errore: se i keyframe sono già stati salvati,
    // l'UI li mostra comunque (utile per il flusso video in attesa di wiring).
    revalidatePath(`/projects/${projectId}`);
    return { ok: false, error: `Generazione fallita: ${message}` };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// ---------- helpers privati per orchestrazione asset ----------

async function persistEnrichedPayload(
  outputId: string,
  proposal: ArtDesignOutput,
  generated: GeneratedAsset,
): Promise<void> {
  const enrichedPayload = {
    art_direction: proposal.art_direction,
    primary_asset: generated,
    recommended_models: proposal.recommended_models,
  };
  await prisma.agentOutput.update({
    where: { id: outputId },
    data: { payload: enrichedPayload as unknown as Prisma.InputJsonValue },
  });
}

/**
 * Salva uno stato intermedio del flusso video: keyframe pronti, video non
 * ancora composto. Permette alla UI di mostrare i keyframe anche se la
 * chiamata al modello video poi fallisce.
 */
async function persistKeyframesProgress(
  outputId: string,
  proposal: ArtDesignOutput,
  asset: ArtDesignOutput['primary_asset'],
  keyframes: GeneratedKeyframe[],
): Promise<void> {
  const partial = {
    art_direction: proposal.art_direction,
    primary_asset: {
      ...asset,
      keyframes,
      // Nessun storage_key/mime/bytes/model_id: indica che la composizione
      // video non è ancora avvenuta. La UI usa questa assenza per mostrare
      // "keyframes ready" senza il video player.
    },
    recommended_models: proposal.recommended_models,
  };
  await prisma.agentOutput.update({
    where: { id: outputId },
    data: { payload: partial as unknown as Prisma.InputJsonValue },
  });
}

async function trackUsage(
  runId: string | null,
  projectId: string,
  endpointPrefix: string,
  meta: { provider: string; modelUsed: string; creditsCost?: number },
): Promise<void> {
  await prisma.externalApiUsage.create({
    data: {
      runId: runId ?? null,
      projectId,
      agente: 'art-design',
      provider: meta.provider,
      endpoint: `${endpointPrefix}:${meta.modelUsed}`,
      units: meta.creditsCost ?? 0,
      unitType: 'credits',
      costUsd: 0,
      costEur: 0,
    },
  });
}

/**
 * Pubblica al cliente i deliverable generati da Copy + Art & Design.
 * Crea record `Deliverable` (uno per ogni output testuale, uno per ogni asset visivo),
 * salva i testi come .md su storage, marca tutto `qa_passed`, cambia stato
 * progetto a `in_revisione`.
 *
 * Idempotente: cancella i deliverable precedenti dello stesso progetto e
 * ricrea da capo (utile dopo una rigenerazione di Copy/Art&Design).
 */
export async function publishToClientAction(
  projectId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requireAdmin();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, codiceProgetto: true, language: true, stato: true },
  });
  if (!project) return { ok: false, error: 'Progetto non trovato.' };

  // Verifica precondizioni: stato compatibile
  if (
    project.stato !== 'in_produzione' &&
    project.stato !== 'preventivo_accettato' &&
    project.stato !== 'in_revisione'
  ) {
    return {
      ok: false,
      error: `Stato progetto "${project.stato}" non consente la pubblicazione.`,
    };
  }

  // Carica output Copy + Art&Design più recenti
  const copyRaw = await prisma.agentOutput.findFirst({
    where: { projectId, agente: 'copy-agent', status: 'success' },
    orderBy: { createdAt: 'desc' },
  });
  const artRaw = await prisma.agentOutput.findFirst({
    where: { projectId, agente: 'art-design', status: 'success' },
    orderBy: { createdAt: 'desc' },
  });

  if (!copyRaw && !artRaw) {
    return { ok: false, error: 'Nessun output da Copy o Art & Design da pubblicare.' };
  }

  const copyOutput = copyRaw ? copyAgentOutputSchema.safeParse(copyRaw.payload) : null;
  const artOutput = artRaw
    ? z
        .object({
          art_direction: artDesignOutputSchema.shape.art_direction,
          // Per pubblicazione richiediamo che l'asset sia stato GIA' generato
          // (storage_key valorizzato): il check fallisce se la proposta è
          // ancora "in attesa di model selection".
          primary_asset: generatedAssetSchema,
          recommended_models: artDesignOutputSchema.shape.recommended_models,
        })
        .safeParse(artRaw.payload)
    : null;

  const storage = getStorage();

  try {
    let count = 0;

    await prisma.$transaction(async (tx) => {
      // Cancella deliverable precedenti (idempotenza)
      await tx.deliverable.deleteMany({ where: { projectId } });

      // ---- COPY: 1 deliverable per ogni entry del copy output ----
      if (copyOutput?.success) {
        for (let i = 0; i < copyOutput.data.deliverables.length; i++) {
          const item = copyOutput.data.deliverables[i]!;
          const markdown = formatCopyAsMarkdown(item);
          const storageKey = `deliverables/${projectId}/copy/${String(i + 1).padStart(2, '0')}-${slug(item.type)}.md`;
          await storage.put(storageKey, Buffer.from(markdown, 'utf-8'), {
            contentType: 'text/markdown',
          });
          await tx.deliverable.create({
            data: {
              projectId,
              tipo: `copy:${item.type}`,
              titolo: item.title,
              storageKey,
              mime: 'text/markdown',
              agenteCreatore: 'copy-agent',
              status: 'qa_passed',
              language: project.language,
            },
          });
          count++;
        }
      }

      // ---- ART & DESIGN: 1 solo deliverable (il primary_asset) ----
      if (artOutput?.success) {
        const asset = artOutput.data.primary_asset;
        await tx.deliverable.create({
          data: {
            projectId,
            tipo: `visual:${asset.asset_type}`,
            titolo: asset.title,
            storageKey: asset.storage_key,
            mime: asset.mime,
            agenteCreatore: 'art-design',
            status: 'qa_passed',
            language: project.language,
          },
        });
        count++;
      }

      // Stato progetto → in_revisione
      await tx.project.update({
        where: { id: projectId },
        data: { stato: 'in_revisione' },
      });

      await tx.event.create({
        data: {
          projectId,
          tipo: 'project.published_to_client',
          payload: { deliverableCount: count },
        },
      });
    });

    // Auto-trigger email cliente: "deliverable pronti per la revisione"
    await safelyTriggerEmail({ projectId, kind: 'deliverables_ready' });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/projects');
    return { ok: true, count };
  } catch (e) {
    const message = (e as Error).message;
    return { ok: false, error: `Pubblicazione fallita: ${message}` };
  }
}

/**
 * Marca un round di revisione come completato. Usato dall'admin dopo che ha
 * processato le richieste del cliente (eventualmente rigenerando i deliverable
 * coinvolti). Il counter "round gratuiti rimasti" del cliente si basa su questo.
 */
export async function markRevisionRoundCompletedAction(
  roundId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAdmin();

  const round = await prisma.revisionRound.findUnique({
    where: { id: roundId },
    select: { id: true, projectId: true, status: true, numero: true },
  });
  if (!round) return { ok: false, error: 'Round non trovato.' };
  if (round.status === 'completata') {
    return { ok: false, error: 'Round già completato.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.revisionRound.update({
      where: { id: roundId },
      data: { status: 'completata', completedAt: new Date() },
    });
    await tx.event.create({
      data: {
        projectId: round.projectId,
        tipo: 'revision.round_completed',
        payload: { roundNumber: round.numero, decidedBy: session.user.email },
      },
    });
  });

  // Auto-trigger email cliente: "round revisione chiuso, nuova versione online"
  await safelyTriggerEmail({
    projectId: round.projectId,
    kind: 'revision_completed',
  });

  revalidatePath(`/projects/${round.projectId}`);
  return { ok: true };
}

/**
 * Crea una fattura per il progetto, basata sul prezzo accettato del preventivo
 * più recente. Una volta creata, il cliente può vedere "Paga € X" sul portale
 * e completare il flusso.
 */
export async function createInvoiceAction(
  projectId: string,
): Promise<{ ok: true; invoiceId: string } | { ok: false; error: string }> {
  await requireAdmin();

  const quote = await prisma.quote.findFirst({
    where: { projectId, status: { in: ['accettato', 'inviato'] } },
    orderBy: { version: 'desc' },
  });
  if (!quote) {
    return { ok: false, error: 'Nessun preventivo accettato per cui fatturare.' };
  }

  const existing = await prisma.invoice.findFirst({
    where: { projectId, status: { in: ['draft', 'emessa'] } },
  });
  if (existing) {
    return { ok: false, error: 'Esiste già una fattura attiva per questo progetto.' };
  }

  // Importo: usiamo il prezzo MAX del preventivo accettato per semplicità V1.
  // In produzione si negozia all'interno della range min-max.
  const importoCents = quote.prezzoMaxCents;
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: { createdAt: { gte: new Date(year, 0, 1) } },
  });
  const numero = `KSA-INV-${year}-${String(count + 1).padStart(4, '0')}`;

  const invoice = await prisma.invoice.create({
    data: {
      projectId,
      quoteId: quote.id,
      numero,
      importoCents,
      valuta: 'EUR',
      status: 'emessa',
      issuedAt: new Date(),
    },
  });

  await prisma.event.create({
    data: {
      projectId,
      tipo: 'invoice.issued',
      payload: { invoiceId: invoice.id, numero, importoCents },
    },
  });

  // Auto-trigger email cliente: "fattura emessa, vai sul portale per pagare"
  await safelyTriggerEmail({ projectId, kind: 'invoice_issued' });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, invoiceId: invoice.id };
}

/**
 * Manda al cliente le domande di chiarimento individuate dal Direttore
 * Operativo (campo `missing_information` dell'ultimo output).
 *
 * Effetti:
 *   1. Crea ClarificationRequest con questions = missing_information
 *   2. Cambia stato progetto a "attesa_chiarimenti"
 *   3. Auto-trigger email "brief_clarification_needed" al cliente
 *
 * Vincoli:
 *   - L'ultimo Direttore output deve avere missing_information non vuoto
 *   - Non deve esistere già una ClarificationRequest pending
 */
export async function sendClarificationRequestAction(
  projectId: string,
): Promise<{ ok: true; questionsCount: number } | { ok: false; error: string }> {
  await requireAdmin();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { briefs: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!project) return { ok: false, error: 'Progetto non trovato.' };
  const brief = project.briefs[0];
  if (!brief) return { ok: false, error: 'Brief mancante.' };

  // Verifica niente clarification pending già aperto
  const pending = await prisma.clarificationRequest.findFirst({
    where: { projectId, status: 'pending' },
  });
  if (pending) {
    return {
      ok: false,
      error: 'Esiste già una richiesta di chiarimento aperta. Aspetta che il cliente risponda.',
    };
  }

  // Carica l'ultimo output del Direttore Operativo
  const direttoreOutput = await prisma.agentOutput.findFirst({
    where: { projectId, agente: 'direttore-operativo', status: 'success' },
    orderBy: { createdAt: 'desc' },
  });
  if (!direttoreOutput) {
    return { ok: false, error: 'Esegui prima il Direttore Operativo.' };
  }
  const parsed = direttoreOutputSchema.safeParse(direttoreOutput.payload);
  if (!parsed.success) {
    return { ok: false, error: 'Output Direttore non valido. Ri-esegui.' };
  }
  const questions = parsed.data.missing_information;
  if (questions.length === 0) {
    return {
      ok: false,
      error: 'Il Direttore non ha individuato informazioni mancanti. Niente da chiedere al cliente.',
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.clarificationRequest.create({
      data: {
        projectId,
        briefId: brief.id,
        questions: questions as unknown as Prisma.InputJsonValue,
        status: 'pending',
        runId: direttoreOutput.runId,
      },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { stato: 'attesa_chiarimenti' },
    });
    await tx.event.create({
      data: {
        projectId,
        tipo: 'project.clarification_requested',
        payload: { questionsCount: questions.length },
      },
    });
  });

  // Auto-trigger email cliente con le domande embedded nel body
  await safelyTriggerEmail({
    projectId,
    kind: 'brief_clarification_needed',
    clarificationQuestions: questions,
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, questionsCount: questions.length };
}

/**
 * Esegue il Project Manager AI sul progetto: raccoglie snapshot stato +
 * agent runs + outputs + revisioni + invoice → invoca l'agente → output
 * salvato in agent_outputs come riferimento "ultima analisi PM".
 */
export async function runProjectManagerAction(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { ragioneSociale: true } },
      briefs: { orderBy: { createdAt: 'desc' }, take: 1 },
      approvals: {
        where: { checkpointCode: 'brief_iniziale' },
        orderBy: { requestedAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!project) return { ok: false, error: 'Progetto non trovato.' };

  // Snapshot agent_outputs per capire cosa c'è già
  const outputs = await prisma.agentOutput.findMany({
    where: { projectId, status: 'success' },
    select: { agente: true, payload: true },
  });
  const outputsByAgent = new Map(outputs.map((o) => [o.agente, o]));

  const artOutput = outputsByAgent.get('art-design')?.payload as
    | { primary_asset?: { storage_key?: string } }
    | undefined;
  const artDesignAssetGenerated =
    typeof artOutput?.primary_asset?.storage_key === 'string';

  // Storico recente agent runs (ultimi 10)
  const recentRuns = await prisma.agentRun.findMany({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
    take: 10,
    select: {
      agente: true,
      status: true,
      startedAt: true,
      endedAt: true,
      latencyMs: true,
    },
  });

  // Preventivo
  const quote = await prisma.quote.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
  });

  // Revisioni
  const revisionRounds = await prisma.revisionRound.findMany({
    where: { projectId },
    orderBy: { numero: 'asc' },
    include: { requests: { select: { id: true } } },
  });

  // Invoice
  const invoice = await prisma.invoice.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  // Deliverable
  const deliverableCount = await prisma.deliverable.count({ where: { projectId } });

  // Calcoli temporali — daysInCurrentState approssimato da updatedAt del project
  const now = Date.now();
  const updatedMs = project.updatedAt.getTime();
  const createdMs = project.createdAt.getTime();
  const daysInCurrentState = Math.floor((now - updatedMs) / (1000 * 60 * 60 * 24));
  const daysSinceCreation = Math.floor((now - createdMs) / (1000 * 60 * 60 * 24));

  const brief = project.briefs[0];
  const briefApproved = project.approvals.some((a) => a.esito === 'approvato');

  try {
    await runAgent(
      projectManagerAgent,
      {
        projectId: project.id,
        codiceProgetto: project.codiceProgetto,
        titolo: project.titolo,
        clientName: project.client.ragioneSociale,
        stato: project.stato,
        daysInCurrentState,
        daysSinceCreation,
        hasOutputs: {
          direttore: outputsByAgent.has('direttore-operativo'),
          finance: outputsByAgent.has('finance-admin'),
          creative: outputsByAgent.has('creative-lead'),
          copy: outputsByAgent.has('copy-agent'),
          artDesign: outputsByAgent.has('art-design'),
          artDesignAssetGenerated,
        },
        recentAgentRuns: recentRuns.map((r) => ({
          agente: r.agente,
          status: r.status as 'success' | 'failed' | 'running',
          startedAt: r.startedAt.toISOString(),
          endedAt: r.endedAt ? r.endedAt.toISOString() : null,
          latencyMs: r.latencyMs,
        })),
        quote: quote
          ? {
              status: quote.status as 'draft' | 'inviato' | 'accettato' | 'rifiutato',
              // sentAt/acceptedAt non sono colonne dirette del Quote: i timestamp
              // di inviato/accettato vivono negli `events`. Per V1 passiamo null
              // — il PM si basa su `status` per le sue regole; se in futuro
              // servisse precisione temporale, leggiamo gli eventi correlati.
              sentAt: null,
              acceptedAt: null,
              prezzoMaxCents: quote.prezzoMaxCents,
            }
          : null,
        revisionRounds: revisionRounds.map((r) => ({
          numero: r.numero,
          status: r.status as 'richiesta' | 'in_lavorazione' | 'completata' | 'rifiutata',
          requestedAt: r.requestedAt.toISOString(),
          completedAt: r.completedAt ? r.completedAt.toISOString() : null,
          requestCount: r.requests.length,
        })),
        invoice: invoice
          ? {
              numero: invoice.numero,
              status: invoice.status as 'draft' | 'emessa' | 'pagata' | 'annullata',
              importoCents: invoice.importoCents,
              issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : null,
              paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
            }
          : null,
        publishedDeliverableCount: deliverableCount,
        hasBrief: !!brief,
        briefApproved,
        language: project.language as 'it' | 'en',
      },
      { projectId: project.id },
    );
  } catch (e) {
    const message = (e as Error).message;
    return { ok: false, error: `Project Manager fallito: ${message}` };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/**
 * Compone e invia un'email transazionale al cliente del progetto.
 *
 * Flusso:
 *   1. Verifica admin + progetto
 *   2. Raccoglie context da DB (cliente, progetto, fattura, ecc.)
 *   3. Esegue Email Composer agent → genera subject + body
 *   4. Crea record EmailMessage (status=queued)
 *   5. Chiama mailer.sendEmail (mock o SMTP reale)
 *   6. Aggiorna EmailMessage con esito (sent/failed)
 *   7. revalidatePath
 *
 * Fail-soft: un fallimento SMTP NON rollbacka l'azione (l'email message resta
 * in DB con status=failed, retry possibile manualmente).
 */
export async function composeAndSendEmailAction(
  projectId: string,
  kind: EmailKind,
  customNotes?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const result = await sendProjectEmail({ projectId, kind, customNotes });
  revalidatePath(`/projects/${projectId}`);
  if (!result.ok) return { ok: false, error: `Invio fallito: ${result.error}` };
  return { ok: true };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function pickExtension(mime: string): string {
  const map: Record<string, string> = {
    'image/svg+xml': 'svg',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  return map[mime] ?? 'bin';
}

function formatCopyAsMarkdown(item: {
  type: string;
  title: string;
  variants: Array<{
    label: string;
    headline?: string;
    body: string;
    cta?: string;
    hashtags?: string[];
    length_chars: number;
  }>;
  rationale: string;
}): string {
  const lines: string[] = [];
  lines.push(`# ${item.title}`);
  lines.push('');
  lines.push(`**Tipo:** ${item.type}`);
  lines.push('');
  lines.push(`> _${item.rationale}_`);
  lines.push('');
  for (const v of item.variants) {
    lines.push(`## Variante ${v.label}`);
    lines.push('');
    if (v.headline) lines.push(`**Headline:** ${v.headline}\n`);
    lines.push(v.body);
    lines.push('');
    if (v.cta) lines.push(`**CTA:** ${v.cta}\n`);
    if (v.hashtags && v.hashtags.length > 0) {
      lines.push(`**Hashtag:** ${v.hashtags.join(' ')}`);
      lines.push('');
    }
    lines.push(`_(${v.length_chars} caratteri)_`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Invia il preventivo (più recente, in stato draft) al cliente.
 * Cambia stato del progetto a `preventivo_inviato`.
 */
export async function sendQuoteAction(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAdmin();

  const draftQuote = await prisma.quote.findFirst({
    where: { projectId, status: 'draft' },
    orderBy: { version: 'desc' },
  });
  if (!draftQuote) {
    return { ok: false, error: 'Nessun preventivo in stato draft da inviare.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: draftQuote.id },
      data: { status: 'inviato' },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { stato: 'preventivo_inviato' },
    });
    await tx.event.create({
      data: {
        projectId,
        tipo: 'project.quote_sent',
        payload: { sentBy: session.user.email, quoteVersion: draftQuote.version },
      },
    });
  });

  // Auto-trigger email cliente: "preventivo pronto, dai un'occhiata"
  await safelyTriggerEmail({ projectId, kind: 'quote_sent' });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/projects');
  return { ok: true };
}

export async function rejectBriefAction(projectId: string, note: string): Promise<{ ok: boolean }> {
  const session = await requireAdmin();

  await prisma.$transaction(async (tx) => {
    const approval = await tx.approval.findFirst({
      where: { projectId, checkpointCode: 'brief_iniziale', esito: 'pending' },
    });
    if (!approval) throw new Error('Approvazione non trovata o già decisa.');

    await tx.approval.update({
      where: { id: approval.id },
      data: {
        esito: 'rifiutato',
        decidedAt: new Date(),
        decidedById: session.user.id,
        note: note || null,
      },
    });

    await tx.project.update({
      where: { id: projectId },
      data: { stato: 'annullato', closedAt: new Date() },
    });

    await tx.event.create({
      data: {
        projectId,
        tipo: 'project.brief_rejected',
        payload: { decidedBy: session.user.email, note: note || null },
      },
    });
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/projects');
  return { ok: true };
}
