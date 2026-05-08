import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';
import { QuoteDecisionButtons } from './quote-buttons';

export default async function ClientProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.clientId) notFound();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      briefs: { orderBy: { createdAt: 'desc' }, take: 1 },
      files: true,
    },
  });

  // Sicurezza: il cliente vede SOLO i propri progetti.
  if (!project || project.clientId !== session.user.clientId) {
    notFound();
  }

  const brief = project.briefs[0];

  // Preventivo visibile al cliente (solo se inviato/accettato/rifiutato — mai draft)
  const visibleQuote = await prisma.quote.findFirst({
    where: {
      projectId: project.id,
      status: { in: ['inviato', 'accettato', 'rifiutato'] },
    },
    orderBy: { version: 'desc' },
    include: { items: { orderBy: { ordine: 'asc' } } },
  });

  // Recupera le condizioni dal project_finance_outputs (più strutturato del JSON sul Quote)
  const financeOutput = visibleQuote
    ? await prisma.projectFinanceOutput.findFirst({
        where: { projectId: project.id, version: visibleQuote.version },
        select: { conditions: true, note: true },
      })
    : null;
  const conditions = Array.isArray(financeOutput?.conditions)
    ? (financeOutput.conditions as string[])
    : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 font-sans">
      <Link
        href="/projects"
        className="text-xs font-medium uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
      >
        ← I miei progetti
      </Link>

      <div className="mt-3 flex items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase text-zinc-500">
            {project.codiceProgetto}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {project.titolo}
          </h1>
        </div>
        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-100">
          {project.stato.replace(/_/g, ' ')}
        </span>
      </div>

      {project.stato === 'in_attesa_approvazione_admin' ? (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Il tuo brief è in attesa di approvazione da parte dell&apos;agenzia. Riceverai un
          aggiornamento appena Michele lo avrà valutato.
        </p>
      ) : null}
      {project.stato === 'in_analisi' ? (
        <p className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
          Brief approvato! Il team sta analizzando il progetto e prepara il preventivo.
        </p>
      ) : null}
      {project.stato === 'annullato' ? (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          Brief rifiutato. Ti invitiamo a contattare l&apos;agenzia per discuterne.
        </p>
      ) : null}
      {project.stato === 'preventivo_inviato' ? (
        <p className="mt-6 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100">
          È arrivato il preventivo. Leggilo qui sotto e accettalo per dare il via alla produzione,
          oppure rifiutalo per discuterne con l&apos;agenzia.
        </p>
      ) : null}
      {project.stato === 'preventivo_accettato' ? (
        <p className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          Preventivo accettato. Il team partirà a breve con la produzione.
        </p>
      ) : null}

      {visibleQuote ? (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Preventivo · v{visibleQuote.version} · {visibleQuote.status}
          </h2>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Detail label="Min">
              € {(visibleQuote.prezzoMinCents / 100).toLocaleString('it-IT')}
            </Detail>
            <Detail label="Max">
              € {(visibleQuote.prezzoMaxCents / 100).toLocaleString('it-IT')}
            </Detail>
            <Detail label="Gap">{Number(visibleQuote.gapPct).toFixed(2)}%</Detail>
            <Detail label="Valido fino">
              {visibleQuote.validUntil ? visibleQuote.validUntil.toLocaleDateString('it-IT') : '—'}
            </Detail>
          </div>

          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Voci</h3>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                  <th className="py-2">Voce</th>
                  <th className="py-2 text-right">Qta</th>
                  <th className="py-2 text-right">Unitario</th>
                  <th className="py-2 text-right">Totale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {visibleQuote.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2">
                      {it.voce}
                      {it.opzionale ? (
                        <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          opzionale
                        </span>
                      ) : null}
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

          {conditions.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Condizioni
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-700 dark:text-zinc-300">
                {conditions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {visibleQuote.status === 'inviato' ? (
            <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <QuoteDecisionButtons projectId={project.id} />
            </div>
          ) : null}
        </section>
      ) : null}

      {brief ? (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Brief inviato
          </h2>
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
            File di reference
          </h2>
          <ul className="mt-3 space-y-2">
            {project.files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900"
              >
                <span className="text-zinc-800 dark:text-zinc-200">{f.filename}</span>
                <span className="font-mono text-xs text-zinc-500">{f.mime}</span>
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
