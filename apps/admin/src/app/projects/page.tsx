import Link from 'next/link';
import { prisma } from '@kansei/database';

export const metadata = {
  title: 'Progetti · Kansei-Studio Admin',
};

export default async function AdminProjectsListPage() {
  const projects = await prisma.project.findMany({
    orderBy: [{ stato: 'asc' }, { createdAt: 'desc' }],
    include: {
      client: { select: { ragioneSociale: true } },
    },
  });

  const pendingApprovals = projects.filter(
    (p) => p.stato === 'in_attesa_approvazione_admin',
  ).length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 font-sans">
      <Link
        href="/"
        className="text-xs font-medium uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
      >
        ← Dashboard
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Progetti
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {pendingApprovals > 0 ? (
          <>
            <strong className="text-amber-700 dark:text-amber-300">
              {pendingApprovals} in attesa di approvazione
            </strong>
            {' · '}
          </>
        ) : null}
        {projects.length} progetti totali
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {projects.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-zinc-500">
            Nessun progetto in archivio. Quando i clienti invieranno brief, li vedrai qui.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3">Codice</th>
                <th className="px-4 py-3">Titolo</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3">Creato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-mono text-xs font-semibold uppercase text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                    >
                      {p.codiceProgetto}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {p.titolo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {p.client.ragioneSociale}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.stato} />
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {p.createdAt.toLocaleDateString('it-IT')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    bozza: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
    in_attesa_approvazione_admin:
      'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
    in_analisi: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    preventivo_inviato: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100',
    preventivo_accettato:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
    in_produzione: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
    in_revisione: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
    sospeso_costi: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    chiuso: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
    annullato: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-zinc-100 text-zinc-700'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
