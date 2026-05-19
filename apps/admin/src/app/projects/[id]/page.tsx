import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@kansei/database';
import {
  direttoreOutputSchema,
  copyAgentOutputSchema,
  type DirettoreOutput,
  type CopyAgentOutput,
} from '@kansei/agents';
import { z } from 'zod';
import {
  artDirectionSchema,
  imageBriefSchema,
  generatedKeyframeSchema,
  modelRecommendationSchema,
} from '@kansei/agents';
import {
  blockerSchema,
  nextActionSchema,
} from '@kansei/agents';
import { ApprovalButtons } from './approval-buttons';
import { DirettoreButton } from './direttore-button';
import { GenerateQuoteButton, SendQuoteButton } from './finance-buttons';
import { CreativeLeadButton } from './creative-button';
import { CopyAgentButton } from './copy-button';
import { ArtDesignButton } from './art-button';
import { ArtDesignGenerateButton } from './art-design-model-picker';
import { PublishButton } from './publish-button';
import { MarkRoundCompletedButton } from './revision-round-button';
import { CreateInvoiceButton } from './invoice-button';
import { ProjectManagerButton } from './project-manager-button';
import { ComposeEmailButton } from './email-button';
import { SendClarificationButton } from './clarification-button';

// Schema PM output per parsing del payload salvato
const pmOutputSchema = z.object({
  status: z.enum(['ok', 'attention', 'blocked', 'completed']),
  current_phase: z.string(),
  next_action: nextActionSchema,
  sla: z.object({
    status: z.enum(['ok', 'warning', 'breach']),
    days_in_current_phase: z.number().int().nonnegative(),
    threshold_days: z.number().int().positive(),
    message: z.string(),
  }),
  blockers: z.array(blockerSchema),
  summary: z.string(),
});

// Schema flessibile dell'output Art & Design.
// Il primary_asset attraversa 3 stati:
//   1. PROPOSAL          → solo i campi descrittivi (no storage_key, no keyframes)
//   2. KEYFRAMES_READY   → keyframes[] presente, storage_key ancora assente
//                          (succede per video: i keyframe sono pronti ma la
//                          composizione Seedance non è ancora avvenuta)
//   3. GENERATED         → storage_key + model_id + mime presenti
// I campi opzionali permettono di distinguere lo stato a runtime.
const artDesignAssetFlexibleSchema = z.object({
  asset_type: z.enum(['image', 'video']),
  title: z.string(),
  prompt: z.string(),
  aspect_ratio: z.enum(['1:1', '4:5', '9:16', '16:9', '3:4', '4:3', '2:3', '3:2']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  duration_seconds: z.number().int().optional(),
  image_briefs: z.array(imageBriefSchema).optional(),
  rationale: z.string(),
  // Campi popolati dopo la generazione:
  storage_key: z.string().optional(),
  mime: z.string().optional(),
  bytes: z.number().int().optional(),
  model_id: z.string().optional(),
  keyframes: z.array(generatedKeyframeSchema).optional(),
});

const artDesignProposalSchema = z.object({
  art_direction: artDirectionSchema,
  primary_asset: artDesignAssetFlexibleSchema,
  recommended_models: z.array(modelRecommendationSchema),
});
type ArtDesignProposal = z.infer<typeof artDesignProposalSchema>;
type ArtDesignAsset = ArtDesignProposal['primary_asset'];

function isAssetGenerated(
  a: ArtDesignAsset,
): a is ArtDesignAsset & { storage_key: string; mime: string; model_id: string } {
  return typeof a.storage_key === 'string' && typeof a.mime === 'string';
}

function hasKeyframes(a: ArtDesignAsset): boolean {
  return Array.isArray(a.keyframes) && a.keyframes.length > 0;
}

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      briefs: { orderBy: { createdAt: 'desc' }, take: 1 },
      files: true,
      approvals: { orderBy: { requestedAt: 'desc' } },
      events: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });

  if (!project) notFound();

  const brief = project.briefs[0];
  const pendingApproval = project.approvals.find(
    (a) => a.checkpointCode === 'brief_iniziale' && a.esito === 'pending',
  );

  // Email Composer: ultime 5 email inviate
  const recentEmails = await prisma.emailMessage.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  // Project Manager: ultima analisi (se esiste)
  const pmOutputRaw = await prisma.agentOutput.findFirst({
    where: { projectId: project.id, agente: 'project-manager', status: 'success' },
    orderBy: { createdAt: 'desc' },
  });
  const pmParsed = pmOutputRaw ? pmOutputSchema.safeParse(pmOutputRaw.payload) : null;
  const pmOutput = pmParsed && pmParsed.success ? pmParsed.data : null;

  // Ultima richiesta chiarimenti (per mostrare lo stato sotto il Direttore)
  const lastClarification = await prisma.clarificationRequest.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
  });

  // Output del Direttore Operativo (se già eseguito)
  const direttoreOutputRaw = await prisma.agentOutput.findFirst({
    where: { projectId: project.id, agente: 'direttore-operativo', status: 'success' },
    orderBy: { createdAt: 'desc' },
  });
  const direttoreParsed = direttoreOutputRaw
    ? direttoreOutputSchema.safeParse(direttoreOutputRaw.payload)
    : null;
  const direttoreOutput: DirettoreOutput | null =
    direttoreParsed && direttoreParsed.success ? direttoreParsed.data : null;

  // Run più recente per metadata (latency, costo)
  const latestRun = await prisma.agentRun.findFirst({
    where: { projectId: project.id, agente: 'direttore-operativo' },
    orderBy: { startedAt: 'desc' },
    include: { tokenUsage: true },
  });

  const isApproved =
    project.stato === 'in_analisi' ||
    project.stato === 'preventivo_inviato' ||
    project.stato === 'preventivo_accettato' ||
    project.stato === 'in_produzione';

  // Preventivo più recente
  const latestQuote = await prisma.quote.findFirst({
    where: { projectId: project.id },
    orderBy: { version: 'desc' },
    include: { items: { orderBy: { ordine: 'asc' } } },
  });

  // Creative Lead output (più recente)
  const creativeOutput = await prisma.projectCreativeOutput.findFirst({
    where: { projectId: project.id },
    orderBy: { version: 'desc' },
  });

  // Visibilità sezione Creative: dopo che il cliente ha accettato il preventivo
  const isInProduction =
    project.stato === 'preventivo_accettato' || project.stato === 'in_produzione';

  // Copy Agent output (più recente)
  const copyRaw = await prisma.agentOutput.findFirst({
    where: { projectId: project.id, agente: 'copy-agent', status: 'success' },
    orderBy: { createdAt: 'desc' },
  });
  const copyParsed = copyRaw ? copyAgentOutputSchema.safeParse(copyRaw.payload) : null;
  const copyOutput: CopyAgentOutput | null =
    copyParsed && copyParsed.success ? copyParsed.data : null;

  // Art & Design output (più recente, post image generation)
  const artRaw = await prisma.agentOutput.findFirst({
    where: { projectId: project.id, agente: 'art-design', status: 'success' },
    orderBy: { createdAt: 'desc' },
  });
  const artParsed = artRaw ? artDesignProposalSchema.safeParse(artRaw.payload) : null;
  const artOutput: ArtDesignProposal | null =
    artParsed && artParsed.success ? artParsed.data : null;

  // Deliverable pubblicati al cliente
  const deliverables = await prisma.deliverable.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'asc' },
  });

  // Revisioni cliente (per round, dal più recente)
  const revisionRounds = await prisma.revisionRound.findMany({
    where: { projectId: project.id },
    orderBy: { numero: 'desc' },
    include: {
      requests: {
        include: {
          // Carica info deliverable per ogni richiesta
        },
      },
    },
  });

  // Mappa deliverableId → titolo per visualizzare nelle revisioni
  const deliverableTitles = new Map(deliverables.map((d) => [d.id, d.titolo]));

  // Pubblicabile solo se il primary_asset è stato effettivamente generato
  // (storage_key valorizzato) — altrimenti la proposta è ancora "in attesa
  // di scelta del modello" e non può finire al cliente.
  const artGenerated = artOutput && isAssetGenerated(artOutput.primary_asset);
  const canPublish =
    (copyOutput || artGenerated) &&
    (project.stato === 'preventivo_accettato' ||
      project.stato === 'in_produzione' ||
      project.stato === 'in_revisione');

  // Fatturazione e pagamento
  const invoices = await prisma.invoice.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    include: { payments: true },
  });
  const activeInvoice = invoices.find((i) =>
    ['emessa', 'pagata'].includes(i.status),
  );
  const isPaid =
    activeInvoice?.payments.some((p) => p.status === 'succeeded') ?? false;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 font-sans">
      <Link
        href="/projects"
        className="text-xs font-medium uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
      >
        ← Tutti i progetti
      </Link>

      <div className="mt-3 flex items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase text-zinc-500">
            {project.codiceProgetto}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {project.titolo}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Cliente: <strong>{project.client.ragioneSociale}</strong>
            {project.client.pIva ? ` · ${project.client.pIva}` : ''}
          </p>
        </div>
        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-100">
          {project.stato.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Pannello Project Manager AI: stato + next action */}
      <section
        className={`mt-6 overflow-hidden rounded-2xl border-2 shadow-sm ${
          pmOutput?.status === 'blocked'
            ? 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/40'
            : pmOutput?.status === 'attention'
              ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40'
              : pmOutput?.status === 'completed'
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40'
                : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
        }`}
      >
        <div className="flex items-baseline justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Project Manager AI
            </h2>
            {pmOutput ? (
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                  pmOutput.status === 'blocked'
                    ? 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100'
                    : pmOutput.status === 'attention'
                      ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                      : pmOutput.status === 'completed'
                        ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100'
                        : 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200'
                }`}
              >
                {pmOutput.status}
              </span>
            ) : null}
          </div>
          <ProjectManagerButton projectId={project.id} />
        </div>

        {!pmOutput ? (
          <div className="px-5 pb-5">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Nessuna analisi PM ancora. Click <strong>Aggiorna analisi PM</strong> per
              chiedere all&apos;agente cosa fare adesso, eventuali blocchi e tempi.
            </p>
          </div>
        ) : (
          <div className="space-y-4 px-5 pb-5">
            {/* Summary */}
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              <span className="font-semibold">{pmOutput.current_phase}</span> ·{' '}
              {pmOutput.summary}
            </p>

            {/* Next action card */}
            <div
              className={`rounded-xl border p-4 ${
                pmOutput.next_action.priority === 'high'
                  ? 'border-rose-400 bg-white dark:border-rose-600 dark:bg-zinc-950'
                  : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Prossima azione · {pmOutput.next_action.type.replace('_', ' ')}
                {pmOutput.next_action.priority === 'high' ? ' · ⚠️ priorità alta' : ''}
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {pmOutput.next_action.description}
              </p>
              {pmOutput.next_action.agent_name ? (
                <p className="mt-1 font-mono text-[11px] text-zinc-500">
                  Agente da lanciare: <strong>{pmOutput.next_action.agent_name}</strong>{' '}
                  (cerca il bottone nella sezione dell&apos;agente più in basso)
                </p>
              ) : null}
            </div>

            {/* SLA */}
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                  pmOutput.sla.status === 'breach'
                    ? 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100'
                    : pmOutput.sla.status === 'warning'
                      ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                      : 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100'
                }`}
              >
                SLA · {pmOutput.sla.status}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">{pmOutput.sla.message}</span>
            </div>

            {/* Blockers */}
            {pmOutput.blockers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Blockers ({pmOutput.blockers.length})
                </p>
                <ul className="space-y-2">
                  {pmOutput.blockers.map((b, i) => (
                    <li
                      key={i}
                      className={`rounded-lg p-3 text-xs ${
                        b.severity === 'critical'
                          ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100'
                          : b.severity === 'warning'
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
                            : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200'
                      }`}
                    >
                      <p className="font-semibold">
                        [{b.severity.toUpperCase()}] {b.description}
                      </p>
                      <p className="mt-1 italic">→ {b.suggested_fix}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {pendingApproval ? (
        <section className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Approvazione richiesta · brief iniziale
          </h2>
          <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
            Il cliente ha inviato il brief. Approvalo per far partire l&apos;analisi interna oppure
            rifiutalo.
          </p>
          <div className="mt-4">
            <ApprovalButtons projectId={project.id} />
          </div>
        </section>
      ) : null}

      {brief ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Brief</h2>
          <p className="mt-3 whitespace-pre-line text-sm text-zinc-800 dark:text-zinc-200">
            {brief.descrizione}
          </p>
          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail label="Deliverable richiesti">
              {Array.isArray(brief.deliverableRichiesti)
                ? (brief.deliverableRichiesti as string[]).join(', ')
                : '—'}
            </Detail>
            <Detail label="Deadline">
              {brief.deadline ? brief.deadline.toLocaleDateString('it-IT') : '—'}
            </Detail>
            <Detail label="Budget indicativo">
              {brief.budgetIndicativoCents
                ? `€ ${(brief.budgetIndicativoCents / 100).toLocaleString('it-IT')}`
                : '—'}
            </Detail>
            <Detail label="Inviato il">{brief.createdAt.toLocaleString('it-IT')}</Detail>
          </dl>
        </section>
      ) : null}

      {project.files.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            File allegati
          </h2>
          <ul className="mt-3 space-y-2">
            {project.files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900"
              >
                <div>
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">{f.filename}</p>
                  <p className="font-mono text-xs text-zinc-500">{f.storageKey}</p>
                </div>
                <span className="font-mono text-xs text-zinc-500">{f.mime}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Direttore Operativo */}
      {isApproved ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Direttore Operativo
            </h2>
            {latestRun ? (
              <p className="text-xs text-zinc-500">
                Run {latestRun.status} · {latestRun.latencyMs ?? '?'} ms
                {latestRun.tokenUsage[0]
                  ? ` · ${latestRun.tokenUsage[0].totalTokens} token · $${Number(latestRun.tokenUsage[0].costUsd).toFixed(4)}`
                  : ''}
              </p>
            ) : null}
          </div>

          {!direttoreOutput ? (
            <div className="mt-3">
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                Il brief è stato approvato. Lancia l&apos;analisi del Direttore Operativo per
                generare il piano di lavoro.
              </p>
              <DirettoreButton projectId={project.id} />
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              <p className="text-sm text-zinc-800 dark:text-zinc-200">{direttoreOutput.summary}</p>

              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Detail label="Priorità">
                  <Badge tone="default">{direttoreOutput.priority}</Badge>
                </Detail>
                <Detail label="Complessità">
                  <Badge tone="info">{direttoreOutput.estimated_complexity}</Badge>
                </Detail>
                <Detail label="Step">{direttoreOutput.execution_plan.length}</Detail>
                <Detail label="Agenti coinvolti">{direttoreOutput.required_agents.length}</Detail>
              </dl>

              {/* Analisi cliente — campo opzionale per retrocompatibilità */}
              {direttoreOutput.client_analysis ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                      Analisi cliente
                    </h3>
                    <span className="rounded-full bg-sky-200 px-2 py-0.5 font-mono text-[10px] uppercase text-sky-900 dark:bg-sky-800 dark:text-sky-100">
                      confidence: {direttoreOutput.client_analysis.information_confidence}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Detail label="Settore">
                      {direttoreOutput.client_analysis.sector_inferred}
                    </Detail>
                    <Detail label="Modello business">
                      {direttoreOutput.client_analysis.business_model}
                    </Detail>
                    <Detail label="Target audience">
                      {direttoreOutput.client_analysis.target_audience_hypothesis}
                    </Detail>
                    <Detail label="Posizionamento">
                      {direttoreOutput.client_analysis.competitive_positioning}
                    </Detail>
                  </dl>
                  <p className="mt-2 text-[11px] font-mono text-sky-700 dark:text-sky-300">
                    Segnali usati:{' '}
                    {direttoreOutput.client_analysis.inference_signals.join(' · ')}
                  </p>
                </div>
              ) : null}

              {/* Analisi mood visivo */}
              {direttoreOutput.visual_mood_analysis ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                      Mood visivo inferito
                    </h3>
                    <span className="rounded-full bg-violet-200 px-2 py-0.5 font-mono text-[10px] uppercase text-violet-900 dark:bg-violet-800 dark:text-violet-100">
                      {direttoreOutput.visual_mood_analysis.has_references
                        ? 'reference forniti'
                        : 'no reference · dedotto'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs italic text-violet-800 dark:text-violet-200">
                    {direttoreOutput.visual_mood_analysis.rationale}
                  </p>
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase text-violet-700 dark:text-violet-300">
                      Style keywords
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {direttoreOutput.visual_mood_analysis.inferred_style_keywords.map(
                        (k, i) => (
                          <li
                            key={i}
                            className="rounded-full bg-violet-200 px-2 py-0.5 font-mono text-[10px] text-violet-900 dark:bg-violet-800 dark:text-violet-100"
                          >
                            {k}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase text-violet-700 dark:text-violet-300">
                      Direzioni palette
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-violet-900 dark:text-violet-100">
                      {direttoreOutput.visual_mood_analysis.suggested_color_directions.map(
                        (c, i) => (
                          <li key={i}>{c}</li>
                        ),
                      )}
                    </ul>
                  </div>
                  <p className="mt-2 text-xs text-violet-900 dark:text-violet-100">
                    <strong>Tipografia:</strong>{' '}
                    {direttoreOutput.visual_mood_analysis.inferred_typography_style}
                  </p>
                </div>
              ) : null}

              {/* Assunzioni esplicite */}
              {direttoreOutput.assumptions_made &&
              direttoreOutput.assumptions_made.length > 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Assunzioni fatte ({direttoreOutput.assumptions_made.length})
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-700 dark:text-zinc-300">
                    {direttoreOutput.assumptions_made.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Piano di esecuzione
                </h3>
                <ol className="mt-2 space-y-1.5">
                  {direttoreOutput.execution_plan.map((step) => (
                    <li
                      key={step.step}
                      className="flex items-baseline gap-3 text-sm text-zinc-800 dark:text-zinc-200"
                    >
                      <span className="font-mono text-xs font-semibold text-zinc-500">
                        {String(step.step).padStart(2, '0')}
                      </span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
                        {step.agent}
                      </span>
                      <span className="flex-1">{step.description}</span>
                      <span className="font-mono text-xs text-zinc-500">
                        ~{step.estimated_duration_hours}h
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {direttoreOutput.risks.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Rischi
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                    {direttoreOutput.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {direttoreOutput.missing_information.length > 0 ? (
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Informazioni mancanti dal brief ({direttoreOutput.missing_information.length})
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-100">
                    {direttoreOutput.missing_information.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>

                  {/* Stato chiarimento */}
                  <div className="mt-4 border-t border-amber-300 pt-3 dark:border-amber-700">
                    {lastClarification && lastClarification.status === 'pending' ? (
                      <p className="rounded-lg bg-white px-3 py-2 text-xs text-amber-900 dark:bg-zinc-950 dark:text-amber-200">
                        ⏳ Domande inviate al cliente il{' '}
                        {lastClarification.createdAt.toLocaleString('it-IT')}. In attesa
                        di risposta. Il preventivo è bloccato finché il cliente non
                        risponde.
                      </p>
                    ) : lastClarification && lastClarification.status === 'responded' ? (
                      <div className="space-y-2">
                        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                          ✓ Cliente ha risposto il{' '}
                          {lastClarification.respondedAt?.toLocaleString('it-IT')}. Le
                          risposte sono state appese al brief. Ri-esegui il Direttore
                          Operativo per aggiornare l&apos;analisi.
                        </p>
                        <details>
                          <summary className="cursor-pointer text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
                            Vedi domande e risposte
                          </summary>
                          <ol className="mt-2 space-y-2">
                            {(lastClarification.questions as unknown as string[]).map(
                              (q, i) => {
                                const responses =
                                  (lastClarification.responses as unknown as
                                    | string[]
                                    | null) ?? [];
                                return (
                                  <li
                                    key={i}
                                    className="rounded-lg bg-white p-2 text-xs dark:bg-zinc-950"
                                  >
                                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                                      Q{i + 1}. {q}
                                    </p>
                                    <p className="mt-1 italic text-zinc-700 dark:text-zinc-300">
                                      R. {responses[i] || '(vuota)'}
                                    </p>
                                  </li>
                                );
                              },
                            )}
                          </ol>
                        </details>
                      </div>
                    ) : (
                      <SendClarificationButton projectId={project.id} />
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <DirettoreButton projectId={project.id} />
                <span className="text-xs text-zinc-500">
                  Cliccando ri-esegui l&apos;analisi (utile dopo modifiche al brief).
                </span>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {/* Preventivo */}
      {direttoreOutput ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Preventivo (Finance/Admin)
            </h2>
            {latestQuote ? (
              <p className="text-xs text-zinc-500">
                v{latestQuote.version} · {latestQuote.status}
              </p>
            ) : null}
          </div>

          {!latestQuote ? (
            <div className="mt-3">
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                Il Direttore ha completato l&apos;analisi. Genera ora il preventivo strutturato (gap
                massimo 15%).
              </p>
              <GenerateQuoteButton projectId={project.id} />
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Detail label="Min">
                  € {(latestQuote.prezzoMinCents / 100).toLocaleString('it-IT')}
                </Detail>
                <Detail label="Max">
                  € {(latestQuote.prezzoMaxCents / 100).toLocaleString('it-IT')}
                </Detail>
                <Detail label="Gap">{Number(latestQuote.gapPct).toFixed(2)}%</Detail>
                <Detail label="Valido fino">
                  {latestQuote.validUntil
                    ? latestQuote.validUntil.toLocaleDateString('it-IT')
                    : '—'}
                </Detail>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Voci del preventivo
                </h3>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                      <th className="py-2">Voce</th>
                      <th className="py-2">Agente</th>
                      <th className="py-2 text-right">Qta</th>
                      <th className="py-2 text-right">Unitario</th>
                      <th className="py-2 text-right">Totale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {latestQuote.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2">
                          {it.voce}
                          {it.opzionale ? (
                            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              opzionale
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {it.agente ?? '—'}
                        </td>
                        <td className="py-2 text-right font-mono text-xs">{Number(it.quantita)}</td>
                        <td className="py-2 text-right font-mono text-xs">
                          € {(it.prezzoUnitarioCents / 100).toLocaleString('it-IT')}
                        </td>
                        <td className="py-2 text-right font-mono text-xs font-semibold">
                          € {(it.prezzoTotaleCents / 100).toLocaleString('it-IT')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {latestQuote.status === 'draft' ? (
                <div className="flex items-center gap-3">
                  <SendQuoteButton projectId={project.id} />
                  <span className="text-xs text-zinc-500">
                    Una volta inviato, il cliente può accettare o rifiutare.
                  </span>
                </div>
              ) : null}

              {latestQuote.status === 'inviato' ? (
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">
                  Preventivo inviato al cliente. In attesa di risposta.
                </p>
              ) : null}
              {latestQuote.status === 'accettato' ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                  Preventivo accettato dal cliente. Si può procedere con la produzione.
                </p>
              ) : null}
              {latestQuote.status === 'rifiutato' ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
                  Preventivo rifiutato dal cliente. Genera un nuovo preventivo dopo aver rivisto il
                  piano.
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {/* Creative Lead */}
      {isInProduction ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Creative Lead
            </h2>
            {creativeOutput ? (
              <p className="text-xs text-zinc-500">v{creativeOutput.version}</p>
            ) : null}
          </div>

          {!creativeOutput ? (
            <div className="mt-3">
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                Il preventivo è stato accettato. Lancia il Creative Lead per generare concept e
                brief operativi per Copy / Design / Video.
              </p>
              <CreativeLeadButton projectId={project.id} />
            </div>
          ) : (
            <div className="mt-3 space-y-5">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Concept principale
                </h3>
                <p className="mt-2 rounded-lg bg-fuchsia-50 px-4 py-3 text-base font-medium italic text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-100">
                  &ldquo;{creativeOutput.conceptPrincipale}&rdquo;
                </p>
              </div>

              {Array.isArray(creativeOutput.alternativeConcepts) &&
              (creativeOutput.alternativeConcepts as string[]).length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Concept alternativi
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {(creativeOutput.alternativeConcepts as string[]).map((c, i) => (
                      <li
                        key={i}
                        className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {creativeOutput.briefCopy ? (
                  <BriefBlock title="Brief Copy" body={creativeOutput.briefCopy} />
                ) : null}
                {creativeOutput.briefDesign ? (
                  <BriefBlock title="Brief Design" body={creativeOutput.briefDesign} />
                ) : null}
                {creativeOutput.briefVideo ? (
                  <BriefBlock title="Brief Video" body={creativeOutput.briefVideo} />
                ) : null}
              </div>

              {Array.isArray(creativeOutput.moodKeywords) ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Mood keywords
                  </h3>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {(creativeOutput.moodKeywords as string[]).map((k, i) => (
                      <li
                        key={i}
                        className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {k}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.isArray(creativeOutput.mustHaves) &&
                (creativeOutput.mustHaves as string[]).length > 0 ? (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Must have
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                      {(creativeOutput.mustHaves as string[]).map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {Array.isArray(creativeOutput.mustAvoids) &&
                (creativeOutput.mustAvoids as string[]).length > 0 ? (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                      Must avoid
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                      {(creativeOutput.mustAvoids as string[]).map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <CreativeLeadButton projectId={project.id} />
                <span className="text-xs text-zinc-500">
                  Cliccando rigeneri il concept (utile dopo modifiche al brief).
                </span>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {/* Copy Agent */}
      {creativeOutput ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Copy Agent
            </h2>
            {copyOutput ? (
              <p className="text-xs text-zinc-500">{copyOutput.deliverables.length} deliverable</p>
            ) : null}
          </div>

          {!copyOutput ? (
            <div className="mt-3">
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                Il Creative Lead ha definito concept e brief copy. Esegui il Copy Agent per generare
                i testi (post social, newsletter, landing, comunicati, claim).
              </p>
              <CopyAgentButton projectId={project.id} />
            </div>
          ) : (
            <div className="mt-3 space-y-5">
              {copyOutput.deliverables.map((d, di) => (
                <div
                  key={di}
                  className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {d.title}
                    </h3>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-mono text-[10px] uppercase text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">
                      {d.type}
                    </span>
                  </div>
                  <p className="mt-1 text-xs italic text-zinc-500">{d.rationale}</p>

                  <div className="mt-3 space-y-2">
                    {d.variants.map((v) => (
                      <details key={v.label} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                        <summary className="cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Variante {v.label}
                          {v.headline ? ` — ${v.headline}` : ''}
                          <span className="ml-2 font-mono text-[10px] font-normal text-zinc-500">
                            {v.length_chars} char
                          </span>
                        </summary>
                        <div className="mt-3 space-y-2 text-sm text-zinc-800 dark:text-zinc-200">
                          {v.headline ? <p className="font-semibold">{v.headline}</p> : null}
                          <p className="whitespace-pre-line">{v.body}</p>
                          {v.cta ? (
                            <p className="text-xs">
                              <span className="font-semibold uppercase text-zinc-500">CTA:</span>{' '}
                              {v.cta}
                            </p>
                          ) : null}
                          {v.hashtags && v.hashtags.length > 0 ? (
                            <p className="font-mono text-xs text-zinc-500">
                              {v.hashtags.join(' ')}
                            </p>
                          ) : null}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ))}

              {copyOutput.global_notes ? (
                <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs italic text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  {copyOutput.global_notes}
                </p>
              ) : null}

              <div className="flex items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <CopyAgentButton projectId={project.id} />
                <span className="text-xs text-zinc-500">
                  Click per rigenerare (utile per esplorare angoli diversi).
                </span>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {/* Art & Design */}
      {creativeOutput ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Art &amp; Design
            </h2>
            {artOutput ? (
              <p className="text-xs text-zinc-500">
                {isAssetGenerated(artOutput.primary_asset)
                  ? `Asset generato (${artOutput.primary_asset.asset_type})`
                  : hasKeyframes(artOutput.primary_asset)
                    ? `Keyframes pronti · video in attesa`
                    : 'Proposta pronta · scegli un modello'}
              </p>
            ) : null}
          </div>

          {!artOutput ? (
            <div className="mt-3">
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                Il Creative Lead ha definito il brief design. Esegui l&apos;Art &amp;
                Design Agent per produrre art direction (palette, tipografia) e
                generare gli asset visivi.
              </p>
              <ArtDesignButton projectId={project.id} />
            </div>
          ) : (
            <div className="mt-3 space-y-5">
              {/* Art direction */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Palette
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {artOutput.art_direction.palette.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <span
                        className="block h-6 w-6 rounded shadow-inner"
                        style={{ backgroundColor: c.hex }}
                      />
                      <div className="text-xs">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {c.name}
                        </p>
                        <p className="font-mono text-[10px] text-zinc-500">
                          {c.hex} · {c.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Tipografia
                  </h3>
                  <div className="mt-2 space-y-1 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">
                      <span className="font-mono text-xs text-zinc-500">headline:</span>{' '}
                      <strong>{artOutput.art_direction.typography.headline_font_family}</strong>
                    </p>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">
                      <span className="font-mono text-xs text-zinc-500">body:</span>{' '}
                      <strong>{artOutput.art_direction.typography.body_font_family}</strong>
                    </p>
                    <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {artOutput.art_direction.typography.style_notes}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Riferimenti
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-700 dark:text-zinc-300">
                    {artOutput.art_direction.references.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Style keywords
                </h3>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {artOutput.art_direction.style_keywords.map((k, i) => (
                    <li
                      key={i}
                      className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {k}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Asset principale: due stati possibili */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Asset principale ·{' '}
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 font-mono text-[10px] uppercase text-rose-800 dark:bg-rose-900 dark:text-rose-100">
                    {artOutput.primary_asset.asset_type}
                  </span>
                </h3>
                <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {artOutput.primary_asset.title}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                    {artOutput.primary_asset.width}×{artOutput.primary_asset.height} ·{' '}
                    {artOutput.primary_asset.aspect_ratio}
                    {artOutput.primary_asset.duration_seconds
                      ? ` · ${artOutput.primary_asset.duration_seconds}s`
                      : ''}
                  </p>
                  <p className="mt-2 text-xs italic text-zinc-600 dark:text-zinc-400">
                    {artOutput.primary_asset.rationale}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[10px] font-semibold uppercase text-zinc-500">
                      Prompt completo
                      {artOutput.primary_asset.asset_type === 'video' ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[9px] text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                          ≡ briefVideo del Creative Lead (forced)
                        </span>
                      ) : null}
                    </summary>
                    <p className="mt-1 whitespace-pre-line text-xs text-zinc-700 dark:text-zinc-300">
                      {artOutput.primary_asset.prompt}
                    </p>
                  </details>

                  {/* Briefs dei keyframe (solo per video) — sempre visibili: mostrano la "story" pianificata */}
                  {artOutput.primary_asset.asset_type === 'video' &&
                  artOutput.primary_asset.image_briefs &&
                  artOutput.primary_asset.image_briefs.length > 0 ? (
                    <details className="mt-2" open>
                      <summary className="cursor-pointer text-[10px] font-semibold uppercase text-zinc-500">
                        Storyboard ·{' '}
                        {artOutput.primary_asset.image_briefs.length} keyframe (uno
                        ogni 5s)
                      </summary>
                      <ol className="mt-2 space-y-2">
                        {artOutput.primary_asset.image_briefs.map((b) => (
                          <li
                            key={b.index}
                            className="rounded-lg bg-white p-2 dark:bg-zinc-950"
                          >
                            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                              Frame {b.index} · {b.title}
                            </p>
                            <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                              {b.prompt}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : null}

                  {/* Keyframes generati (solo se il flusso video è arrivato almeno a questo step) */}
                  {hasKeyframes(artOutput.primary_asset) ? (
                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase text-zinc-500">
                        Keyframes generati ({artOutput.primary_asset.keyframes!.length})
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {artOutput.primary_asset.keyframes!.map((k) => (
                          <div
                            key={k.index}
                            className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/storage/${k.storage_key}`}
                              alt={k.title}
                              className="aspect-square w-full object-cover"
                            />
                            <p className="border-t border-zinc-200 px-2 py-1 font-mono text-[10px] text-zinc-500 dark:border-zinc-800">
                              {k.index}. {k.title.slice(0, 40)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Asset finale (image OR video composto) */}
                  {isAssetGenerated(artOutput.primary_asset) ? (
                    <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                      {artOutput.primary_asset.mime.startsWith('video/') ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video
                          src={`/api/storage/${artOutput.primary_asset.storage_key}`}
                          controls
                          className="h-full w-full"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/storage/${artOutput.primary_asset.storage_key}`}
                          alt={artOutput.primary_asset.title}
                          className="h-auto w-full"
                        />
                      )}
                      <p className="border-t border-zinc-200 px-3 py-1.5 font-mono text-[10px] text-zinc-500 dark:border-zinc-800">
                        Generato con: {artOutput.primary_asset.model_id} ·{' '}
                        {((artOutput.primary_asset.bytes ?? 0) / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  ) : hasKeyframes(artOutput.primary_asset) ? (
                    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                      <strong>Keyframes pronti · video in attesa.</strong> La composizione
                      video richiede il wiring del runtime (vedi{' '}
                      <code className="font-mono">packages/agents/src/runtime/seedance.ts</code>
                      ). I keyframe sono già salvati in storage e visibili sopra.
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-white p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                      Asset non ancora generato. Scegli un modello dalla lista sotto e
                      clicca <strong>Genera</strong>.
                    </div>
                  )}
                </div>
              </div>

              {/* Bottone unico Genera + workflow info + progress */}
              <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <ArtDesignGenerateButton
                  projectId={project.id}
                  assetType={artOutput.primary_asset.asset_type}
                  keyframeCount={artOutput.primary_asset.image_briefs?.length}
                  alreadyGenerated={isAssetGenerated(artOutput.primary_asset)}
                />
              </div>

              <div className="flex items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <ArtDesignButton projectId={project.id} />
                <span className="text-xs text-zinc-500">
                  Click per rigenerare la <strong>proposta</strong> (nuova art direction
                  + nuovo asset + nuovo storyboard) prima di generare gli asset.
                </span>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {/* Pubblicazione al cliente + Deliverable */}
      {canPublish ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Pubblicazione al cliente
            </h2>
            {deliverables.length > 0 ? (
              <p className="text-xs text-zinc-500">
                {deliverables.length} deliverable pubblicati
              </p>
            ) : null}
          </div>

          {deliverables.length === 0 ? (
            <div className="mt-3">
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                Tutti gli output di Copy e Art &amp; Design verranno trasformati in
                deliverable visibili al cliente. Il progetto passa a stato{' '}
                <strong>in revisione</strong>.
              </p>
              <PublishButton projectId={project.id} />
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <ul className="space-y-1.5">
                {deliverables.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900"
                  >
                    <div>
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">{d.titolo}</p>
                      <p className="font-mono text-xs text-zinc-500">{d.tipo}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                      {d.status}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <PublishButton projectId={project.id} />
                <span className="text-xs text-zinc-500">
                  Click per ripubblicare (cancella e ricrea i deliverable da
                  Copy/Art&amp;Design più recenti).
                </span>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {/* Revisioni cliente */}
      {revisionRounds.length > 0 ? (
        <section className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Revisioni richieste dal cliente
          </h2>
          <div className="mt-3 space-y-4">
            {revisionRounds.map((round) => (
              <div
                key={round.id}
                className="rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-zinc-950"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Round {round.numero} · {round.tipo.replace(/_/g, ' ')}
                    {round.prezzoCents > 0 ? ` · € ${round.prezzoCents / 100}` : ''}
                  </p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-800 dark:bg-amber-900 dark:text-amber-100">
                    {round.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Aperto il {round.requestedAt.toLocaleString('it-IT')}
                </p>
                <ul className="mt-3 space-y-2">
                  {round.requests.map((req) => (
                    <li
                      key={req.id}
                      className="rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900"
                    >
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        {req.deliverableId
                          ? deliverableTitles.get(req.deliverableId) ?? '(deliverable rimosso)'
                          : 'Generale'}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-zinc-800 dark:text-zinc-200">
                        {req.descrizioneModifica}
                      </p>
                    </li>
                  ))}
                </ul>

                {round.status !== 'completata' ? (
                  <div className="mt-3 border-t border-amber-200 pt-3 dark:border-amber-900">
                    <MarkRoundCompletedButton roundId={round.id} />
                  </div>
                ) : (
                  <p className="mt-3 border-t border-amber-200 pt-3 text-xs text-emerald-700 dark:border-amber-900 dark:text-emerald-300">
                    ✓ Completato il {round.completedAt?.toLocaleString('it-IT')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Fatturazione + Pagamenti */}
      {deliverables.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Fatturazione e pagamento
          </h2>

          {invoices.length === 0 ? (
            <div className="mt-3">
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                Quando le revisioni sono concluse, crea la fattura per sbloccare
                il pagamento e il download dei deliverable da parte del cliente.
              </p>
              <CreateInvoiceButton projectId={project.id} />
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {inv.numero}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        inv.payments.some((p) => p.status === 'succeeded')
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'
                      }`}
                    >
                      {inv.payments.some((p) => p.status === 'succeeded')
                        ? 'pagata'
                        : inv.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                    € {(inv.importoCents / 100).toLocaleString('it-IT')} ·{' '}
                    {inv.issuedAt?.toLocaleDateString('it-IT')}
                  </p>
                  {inv.payments.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      {inv.payments.map((p) => (
                        <li key={p.id}>
                          {p.metodo} · {p.status} ·{' '}
                          {p.createdAt.toLocaleString('it-IT')}
                          {p.transactionId ? ` · ${p.transactionId}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}

              {isPaid ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                  ✓ Progetto pagato. Il cliente può scaricare i deliverable.
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {/* Email cliente — Email Composer Agent */}
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Email cliente
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Email indirizzo cliente: <strong>{project.client.emailFatturazione}</strong>
        </p>
        <div className="mt-4">
          <ComposeEmailButton projectId={project.id} />
        </div>

        {recentEmails.length > 0 ? (
          <div className="mt-5 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Ultime {recentEmails.length} email
            </p>
            {recentEmails.map((m) => (
              <details
                key={m.id}
                className={`rounded-lg border p-3 text-xs ${
                  m.status === 'sent'
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                    : m.status === 'failed'
                      ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                      : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'
                }`}
              >
                <summary className="cursor-pointer">
                  <span className="font-mono text-[10px] uppercase">{m.kind}</span>
                  {' · '}
                  <span className="font-semibold">{m.subject}</span>
                  {' · '}
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                      m.status === 'sent'
                        ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100'
                        : m.status === 'failed'
                          ? 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100'
                          : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'
                    }`}
                  >
                    {m.status}
                  </span>
                  <span className="ml-2 text-[10px] text-zinc-500">
                    {m.createdAt.toLocaleString('it-IT')}
                  </span>
                </summary>
                <div className="mt-2 whitespace-pre-line text-zinc-700 dark:text-zinc-300">
                  {m.bodyText}
                </div>
                {m.errorMessage ? (
                  <p className="mt-2 rounded bg-rose-100 px-2 py-1 font-mono text-[10px] text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                    Errore: {m.errorMessage}
                  </p>
                ) : null}
              </details>
            ))}
          </div>
        ) : null}
      </section>

      {project.events.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Timeline eventi
          </h2>
          <ul className="mt-3 space-y-1">
            {project.events.map((ev) => (
              <li key={ev.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                  {ev.tipo}
                </span>
                <span className="text-xs text-zinc-500">
                  {ev.createdAt.toLocaleString('it-IT')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">{children}</dd>
    </div>
  );
}

function BriefBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h4>
      <p className="mt-2 whitespace-pre-line text-sm text-zinc-800 dark:text-zinc-200">{body}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'default' | 'info' }) {
  const styles =
    tone === 'info'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-mono ${styles}`}>
      {children}
    </span>
  );
}
