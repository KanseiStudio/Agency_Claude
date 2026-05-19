// Pagina mostrata dopo che Stripe Checkout completa con successo.
// Stripe ridirige il cliente qui con ?session_id=cs_...
//
// Il webhook ha (o sta per) marcare il Payment come succeeded; questa
// pagina mostra solo un'animazione "in attesa" + auto-redirect al
// progetto dopo qualche secondo, dove il cliente vedrà i download sbloccati.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';

export default async function PaymentSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'client' || !session.user.clientId) {
    notFound();
  }

  const { id } = await params;
  const { session_id } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, titolo: true, codiceProgetto: true, clientId: true },
  });
  if (!project || project.clientId !== session.user.clientId) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-8 w-8"
          >
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
          Pagamento ricevuto
        </h1>
        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
          Stripe ci sta confermando il pagamento. Tra qualche secondo i file del
          progetto <strong>{project.titolo}</strong> ({project.codiceProgetto}) saranno
          scaricabili.
        </p>
        {session_id ? (
          <p className="mt-3 font-mono text-[10px] text-emerald-700 dark:text-emerald-300">
            Session: {session_id.slice(0, 24)}…
          </p>
        ) : null}
        <Link
          href={`/projects/${project.id}`}
          className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          Vai al progetto
        </Link>
      </div>
    </main>
  );
}
