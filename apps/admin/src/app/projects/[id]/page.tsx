import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@kansei/database';
import { ApprovalButtons } from './approval-buttons';

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
