'use server';

// =========================================================================
// PAYMENT ACTIONS (client portal)
// =========================================================================
//
// Server action principale: `payProjectAction(projectId)`.
//
// Comportamento basato su env:
//   - Mock (MOCK_PAYMENTS=true OR STRIPE_SECRET_KEY mancante):
//     crea Payment con status='succeeded' subito, marca Invoice pagata
//     e Project chiuso. Ritorna { ok: true } e il cliente vede gli effetti
//     dopo revalidatePath.
//
//   - Real Stripe (MOCK_PAYMENTS=false + STRIPE_SECRET_KEY valorizzata):
//     crea Stripe Checkout Session, salva il sessionId nel Payment (status
//     pending), ritorna { ok: true, redirectUrl } che il client component
//     usa per fare window.location = redirectUrl. La conferma effettiva
//     arriva dal webhook /api/stripe/webhook (handler separato).
//
// Per Setup 14 di prossima generazione di Stripe Customer per riuso, vedi
// stripe.ts del lib.
//
// =========================================================================

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';
import { createCheckoutSession, isMockPayments } from '@/lib/stripe';

export async function payProjectAction(
  projectId: string,
): Promise<
  | { ok: true; redirectUrl?: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'client' || !session.user.clientId) {
    return { ok: false, error: 'Non autorizzato.' };
  }

  // Verifica ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      clientId: true,
      stato: true,
      titolo: true,
      codiceProgetto: true,
      client: { select: { emailFatturazione: true } },
    },
  });
  if (!project || project.clientId !== session.user.clientId) {
    return { ok: false, error: 'Progetto non trovato.' };
  }

  // Trova invoice da pagare
  const invoice = await prisma.invoice.findFirst({
    where: { projectId, status: 'emessa' },
    orderBy: { createdAt: 'desc' },
    include: { payments: true },
  });
  if (!invoice) {
    return { ok: false, error: 'Nessuna fattura da pagare.' };
  }
  if (invoice.payments.some((p) => p.status === 'succeeded')) {
    return { ok: false, error: 'Fattura già pagata.' };
  }

  const mockMode = isMockPayments();

  // ============== MOCK PATH ==============
  if (mockMode) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          importoCents: invoice.importoCents,
          metodo: 'stripe',
          status: 'succeeded',
          transactionId: `mock_${Date.now()}`,
          metadata: { mock: true, paidBy: session.user!.email },
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'pagata', paidAt: new Date() },
      });
      await tx.project.update({
        where: { id: projectId },
        data: { stato: 'chiuso', closedAt: new Date() },
      });
      await tx.event.create({
        data: {
          projectId,
          tipo: 'payment.succeeded',
          payload: {
            invoiceId: invoice.id,
            importoCents: invoice.importoCents,
            mock: true,
          },
        },
      });
    });

    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  }

  // ============== REAL STRIPE PATH ==============
  // 1. Crea Payment record con status=pending (verrà aggiornato dal webhook)
  // 2. Crea Stripe Checkout Session
  // 3. Salva sessionId nel Payment
  // 4. Ritorna URL del checkout per redirect client-side
  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      importoCents: invoice.importoCents,
      metodo: 'stripe',
      status: 'pending',
      metadata: { paidBy: session.user!.email },
    },
  });

  try {
    const checkout = await createCheckoutSession({
      paymentId: payment.id,
      amountCents: invoice.importoCents,
      currency: invoice.valuta.toLowerCase(),
      description: `Fattura ${invoice.numero} · ${project.titolo} (${project.codiceProgetto})`,
      customerEmail: project.client.emailFatturazione,
      projectId,
      invoiceId: invoice.id,
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripeSessionId: checkout.sessionId },
    });

    await prisma.event.create({
      data: {
        projectId,
        tipo: 'payment.checkout_created',
        payload: { paymentId: payment.id, sessionId: checkout.sessionId },
      },
    });

    return { ok: true, redirectUrl: checkout.url };
  } catch (e) {
    // Marchiamo il payment come failed così non resta orfano in pending
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', metadata: { error: (e as Error).message } },
    });
    return {
      ok: false,
      error: `Errore Stripe: ${(e as Error).message}`,
    };
  }
}
