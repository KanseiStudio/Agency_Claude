// =========================================================================
// STRIPE WEBHOOK HANDLER
// =========================================================================
//
// Riceve gli eventi da Stripe e conferma il pagamento lato DB.
//
// Eventi gestiti:
//   - checkout.session.completed     → Payment.status = succeeded,
//                                       Invoice.status = pagata,
//                                       Project.stato = chiuso
//   - payment_intent.payment_failed  → Payment.status = failed
//
// Sicurezza:
//   - Stripe firma ogni request con header `stripe-signature`
//   - Verifichiamo con STRIPE_WEBHOOK_SECRET (whsec_...)
//   - Se la firma non matcha → 400 (la request non è di Stripe)
//
// Setup webhook in dev (vedi SETUP-14-stripe.md):
//   1. stripe login
//   2. stripe listen --forward-to localhost:3002/api/stripe/webhook
//   3. La CLI stampa whsec_... → copialo in STRIPE_WEBHOOK_SECRET
//
// =========================================================================

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@kansei/database';
import { verifyWebhookSignature } from '@/lib/stripe';
import { safelyTriggerEmail } from '@/lib/notifications';

export async function POST(req: Request): Promise<NextResponse> {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // Stripe richiede il BODY RAW per la verifica firma (non parsato JSON).
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(rawBody, signature);
  } catch (e) {
    console.error('[stripe webhook] signature verification failed:', (e as Error).message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        // Eventi non gestiti: log e ack 200 così Stripe non ritenta.
        console.log(`[stripe webhook] unhandled event type: ${event.type}`);
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[stripe webhook] handler error:', (e as Error).message);
    return NextResponse.json(
      { error: `Handler error: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const paymentId = session.client_reference_id ?? session.metadata?.paymentId;
  if (!paymentId) {
    throw new Error('Checkout completed senza client_reference_id/paymentId');
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { project: true } } },
  });
  if (!payment) {
    throw new Error(`Payment ${paymentId} non trovato`);
  }

  // Idempotenza: se già succeeded, no-op
  if (payment.status === 'succeeded') {
    console.log(`[stripe webhook] payment ${paymentId} già succeeded, skip`);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'succeeded',
        stripePaymentIntentId: paymentIntentId,
        transactionId: paymentIntentId ?? `stripe_${session.id}`,
        metadata: {
          ...((payment.metadata as Record<string, unknown> | null) ?? {}),
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        },
      },
    });
    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: 'pagata', paidAt: new Date() },
    });
    await tx.project.update({
      where: { id: payment.invoice.projectId },
      data: { stato: 'chiuso', closedAt: new Date() },
    });
    await tx.event.create({
      data: {
        projectId: payment.invoice.projectId,
        tipo: 'payment.succeeded',
        payload: {
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          importoCents: payment.importoCents,
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        },
      },
    });
  });

  // Auto-trigger email cliente: "pagamento ricevuto, grazie + download sbloccati"
  // FUORI dalla transazione: l'email non deve bloccare la conferma del pagamento.
  await safelyTriggerEmail({
    projectId: payment.invoice.projectId,
    kind: 'payment_confirmed',
  });
}

async function handlePaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
  // Cerca il Payment via stripePaymentIntentId (se valorizzato) o via metadata
  const payment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: intent.id },
    include: { invoice: true },
  });
  if (!payment) {
    console.log(`[stripe webhook] payment_intent ${intent.id} non trovato in DB, skip`);
    return;
  }
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'failed',
      metadata: {
        ...((payment.metadata as Record<string, unknown> | null) ?? {}),
        stripeError: intent.last_payment_error?.message ?? 'unknown',
      },
    },
  });
  await prisma.event.create({
    data: {
      projectId: payment.invoice.projectId,
      tipo: 'payment.failed',
      payload: {
        paymentId: payment.id,
        stripePaymentIntentId: intent.id,
        error: intent.last_payment_error?.message,
      },
    },
  });
}
