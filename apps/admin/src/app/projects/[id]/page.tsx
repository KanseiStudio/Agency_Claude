import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@kansei/database';
import {
  direttoreOutputSchema,
  copyAgentOutputSchema,
  type DirettoreOutput,
  type CopyAgentOutput,
} from '@kansei/agents';
import { ApprovalButtons } from './approval-buttons';
import { DirettoreButton } from './direttore-button';
import { GenerateQuoteButton, SendQuoteButton } from './finance-buttons';
import { CreativeLeadButton } from './creative-button';
import { CopyAgentButton } from './copy-button';

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
