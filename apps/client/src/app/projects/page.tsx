import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';

export const metadata = {
  title: 'I miei progetti · Kansei-Studio',
};

export default async function ProjectsListPage() {
  const session = await auth();
  if (!session?.user?.clientId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 font-sans">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Account cliente non collegato a un&apos;azienda. Contatta l&apos;agenzia.
        </p>
      </main>
    );
  }

  const projects = await prisma.project.findMany({
    where: { clientId: session.user.clientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      codiceProgetto: true,
      titolo: true,
      stato: true,
      createdAt: true,
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 font-sans">
      <Link
        href="/"
        className="text-xs font-medium uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
      >
        ← Torna alla home
      </Link>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            I miei progetti
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Tutti i progetti che hai aperto con Kansei-Studio.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + Nuovo
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {projects.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-zinc-500">
            Non hai ancora progetti. Click su <strong>+ Nuovo</strong> per crearne uno.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block px-6 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs font-semibold uppercase text-zinc-500">
                        {p.codiceProgetto}
                      </p>
                      <h2 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                        {p.titolo}
                      </h2>
                    </div>
                    <StatusBadge status={p.stato} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Creato il {p.createdAt.toLocaleDateString('it-IT')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
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
  const label = status.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-zinc-100 text-zinc-700'}`}
    >
      {label}
    </span>
  );
}
