import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';
import { QuoteDecisionButtons } from './quote-buttons';
import { RevisionForm } from './revision-form';
import { PayButton } from './pay-button';
import { isMockPayments } from '@/lib/stripe';
import { ApproveAndProceedButton } from './approve-button';

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

  // Deliverable pubblicati al cliente
  const deliverables = await prisma.deliverable.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'asc' },
  });

  // Round revisione del cliente
  const revisionRounds = await prisma.revisionRound.findMany({
    where: { projectId: project.id },
    orderBy: { numero: 'desc' },
  });
  const completedRounds = revisionRounds.filter((r) => r.status === 'completata').length;
  const inProgressRound = revisionRounds.find((r) =>
    ['richiesta', 'in_lavorazione'].includes(r.status),
  );
  const nextRoundNumber = revisionRounds.length + (inProgressRound ? 0 : 1);
  const nextRoundIsPaid = nextRoundNumber > 3;

  // Fatture e pagamento
  const invoice = await prisma.invoice.findFirst({
    where: { projectId: project.id, status: { in: ['emessa', 'pagata'] } },
    orderBy: { createdAt: 'desc' },
    include: { payments: true },
  });
  const isPaid = invoice?.payments.some((p) => p.status === 'succeeded') ?? false;
  const hasInvoiceToPay = !!invoice && !isPaid;

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
      {project.stato === 'in_revisione' ? (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          I deliverable sono pronti qui sotto. Se ti piacciono così come sono,
          clicca <strong>Approva tutto e procedi al pagamento</strong>. Se invece
          vuoi modifiche, hai{' '}
          <strong>{Math.max(0, 3 - completedRounds)} round di revisione gratuiti rimasti</strong> su 3.
        </p>
      ) : null}

      {deliverables.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Deliverable in revisione
            </h2>
            <p className="text-xs text-zinc-500">
              {revisionRounds.length} round usat{revisionRounds.length === 1 ? 'o' : 'i'} su 3 gratuiti
            </p>
          </div>

          {!isPaid ? (
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              Anteprima protetta. I file finali saranno scaricabili dopo il
              pagamento.
            </p>
          ) : (
            <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              ✓ Pagamento confermato. I file sono scaricabili.
            </p>
          )}

          {/* Bottone "Approva tutto e procedi al pagamento" — appare quando:
              - progetto in_revisione
              - nessuna invoice già emessa/pagata
              - nessun round revisione attualmente aperto (richiesta o in_lavorazione)
              Permette al cliente di chiudere la fase revisione senza richiedere
              modifiche, generando subito la fattura. */}
          {project.stato === 'in_revisione' &&
          !invoice &&
          !inProgressRound ? (
            <div className="mt-4">
              <ApproveAndProceedButton projectId={project.id} />
            </div>
          ) : null}

          {hasInvoiceToPay ? (
            <div className="mt-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                Fattura {invoice!.numero}
              </p>
              <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-100">
                Importo da pagare:{' '}
                <strong>
                  € {(invoice!.importoCents / 100).toLocaleString('it-IT')}
                </strong>
              </p>
              <div className="mt-3 space-y-2">
                <PayButton
                  projectId={project.id}
                  importoEur={invoice!.importoCents / 100}
                  mockMode={isMockPayments()}
                />
                <a
                  href={`/api/invoices/${invoice!.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs font-semibold text-emerald-900 underline hover:no-underline dark:text-emerald-100"
                >
                  Apri / scarica fattura
                </a>
              </div>
            </div>
          ) : null}

          {isPaid && invoice ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
              <div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Fattura {invoice.numero}
                </p>
                <p className="text-xs text-zinc-500">
                  Pagata il {invoice.paidAt?.toLocaleDateString('it-IT')}
                </p>
              </div>
              <a
                href={`/api/invoices/${invoice.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Apri fattura
              </a>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {deliverables.map((d) => {
              const isVisual = d.tipo.startsWith('visual:');
              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {d.titolo}
                    </p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {d.tipo}
                    </span>
                  </div>

                  {isVisual ? (
                    <div className="mt-3 overflow-hidden rounded-lg bg-zinc-50 dark:bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/client-preview/${d.storageKey}`}
                        alt={d.titolo}
                        className="w-full max-h-96 object-contain"
                      />
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs italic text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                      Contenuto testuale — apri la preview dopo aver richiesto
                      l&apos;eventuale revisione, oppure scaricalo dopo il
                      pagamento.
                    </p>
                  )}

                  <div className="mt-3 space-y-2">
                    {isPaid ? (
                      <a
                        href={`/api/client-files/${d.storageKey}`}
                        className="inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Scarica file
                      </a>
                    ) : null}
                    <RevisionForm
                      projectId={project.id}
                      deliverableId={d.id}
                      deliverableTitle={d.titolo}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {nextRoundIsPaid ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              Hai esaurito i 3 round gratuiti. Eventuali nuove revisioni
              partono come <strong>round {nextRoundNumber} a pagamento</strong>
              {' '}(€ 50 stimati). Il pagamento verrà richiesto al momento dell&apos;invio
              nelle prossime versioni del portale.
            </p>
          ) : null}
        </section>
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
