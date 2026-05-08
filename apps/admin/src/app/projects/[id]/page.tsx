import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@kansei/database';
import { direttoreOutputSchema, type DirettoreOutput } from '@kansei/agents';
import { ApprovalButtons } from './approval-buttons';
import { DirettoreButton } from './direttore-button';

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
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Informazioni mancanti dal brief
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-100">
                    {direttoreOutput.missing_information.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
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
