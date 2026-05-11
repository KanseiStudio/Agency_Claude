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
  direttoreOutputSchema,
  type FinanceAdminOutput,
} from '@kansei/agents';

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
