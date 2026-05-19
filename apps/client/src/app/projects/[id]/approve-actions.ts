'use server';

// =========================================================================
// CLIENT APPROVE ACTION
// =========================================================================
//
// Permette al cliente di chiudere la fase di revisione anche SENZA aver
// richiesto alcuna revisione. Effetti:
//   1. Crea un evento `project.client_approved` per tracciabilità
//   2. Auto-genera l'Invoice (status: emessa) basata sul prezzo MAX del
//      preventivo accettato — stessa logica di admin createInvoiceAction,
//      ma triggerata dal cliente
//   3. Il pulsante "Paga" appare immediatamente nella pagina
//
// Vincoli di sicurezza:
//   - Cliente autenticato + ownership del progetto
//   - Progetto deve essere in stato compatibile (in_revisione)
//   - Non deve esserci una revisione "in_progress" già inviata (in quel
//     caso aspettiamo che admin la chiuda)
//   - Non deve esserci già un'Invoice attiva
//
// =========================================================================

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';

export async function approveAndProceedAction(
  projectId: string,
): Promise<{ ok: true; invoiceId: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'client' || !session.user.clientId) {
    return { ok: false, error: 'Non autorizzato.' };
  }

  // Verifica ownership + stato compatibile
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, clientId: true, stato: true },
  });
  if (!project || project.clientId !== session.user.clientId) {
    return { ok: false, error: 'Progetto non trovato.' };
  }
  if (project.stato !== 'in_revisione' && project.stato !== 'preventivo_accettato') {
    return {
      ok: false,
      error: `Stato progetto "${project.stato}" non consente l'approvazione cliente.`,
    };
  }

  // Verifica niente revisioni "aperte" già inviate dal cliente:
  // se ce ne sono (status richiesta o in_lavorazione), prima l'admin le
  // deve processare, poi il cliente può approvare. Questo evita "approvo
  // ma ho appena chiesto modifiche".
  const pendingRound = await prisma.revisionRound.findFirst({
    where: { projectId, status: { in: ['richiesta', 'in_lavorazione'] } },
  });
  if (pendingRound) {
    return {
      ok: false,
      error:
        'Hai un round di revisione in corso (round ' +
        pendingRound.numero +
        '). Aspetta che il team lo processi prima di approvare definitivamente.',
    };
  }

  // Verifica preventivo accettato
  const quote = await prisma.quote.findFirst({
    where: { projectId, status: { in: ['accettato', 'inviato'] } },
    orderBy: { version: 'desc' },
  });
  if (!quote) {
    return { ok: false, error: 'Nessun preventivo accettato disponibile.' };
  }

  // Idempotenza: se esiste già un'invoice attiva, è OK — significa che
  // qualcuno (admin o il cliente in un click precedente) l'ha già creata.
  const existing = await prisma.invoice.findFirst({
    where: { projectId, status: { in: ['draft', 'emessa'] } },
  });
  if (existing) {
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, invoiceId: existing.id };
  }

  // Genera l'invoice (numero progressivo annuale)
  const importoCents = quote.prezzoMaxCents;
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: { createdAt: { gte: new Date(year, 0, 1) } },
  });
  const numero = `KSA-INV-${year}-${String(count + 1).padStart(4, '0')}`;

  const invoice = await prisma.invoice.create({
    data: {
      projectId,
      quoteId: quote.id,
      numero,
      importoCents,
      valuta: 'EUR',
      status: 'emessa',
      issuedAt: new Date(),
    },
  });

  await prisma.event.create({
    data: {
      projectId,
      tipo: 'project.client_approved',
      payload: {
        approvedBy: session.user.email,
        invoiceId: invoice.id,
        numero,
        importoCents,
        skippedRevisions: true,
      },
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, invoiceId: invoice.id };
}
