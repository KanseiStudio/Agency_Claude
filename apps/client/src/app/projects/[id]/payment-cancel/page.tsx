// Pagina mostrata quando il cliente annulla il checkout Stripe.
// Nessuna spesa, nessun cambio di stato. Solo un messaggio + link per riprovare.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';

export default async function PaymentCancelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'client' || !session.user.clientId) {
    notFound();
  }

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, titolo: true, codiceProgetto: true, clientId: true },
  });
  if (!project || project.clientId !== session.user.clientId) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900 dark:bg-amber-950/40">
        <h1 className="text-2xl font-bold text-amber-900 dark:text-amber-100">
          Pagamento annullato
        </h1>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          Non è stata addebitata nessuna somma. Puoi riprovare quando vuoi dal
          progetto <strong>{project.titolo}</strong>.
        </p>
        <Link
          href={`/projects/${project.id}`}
          className="mt-6 inline-block rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
        >
          Torna al progetto
        </Link>
      </div>
    </main>
  );
}
