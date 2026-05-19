// =========================================================================
// STRIPE SERVICE
// =========================================================================
//
// Wrapper centrale per le chiamate Stripe lato client portal.
//
// Modalità:
//   - MOCK (default in dev): MOCK_PAYMENTS=true OR STRIPE_SECRET_KEY mancante
//     → payProjectAction crea Payment con status='succeeded' subito,
//     niente chiamate esterne, niente redirect
//   - STRIPE TEST/LIVE: STRIPE_SECRET_KEY valorizzata + MOCK_PAYMENTS=false
//     → crea Checkout Session reale, redirect client al checkout
//     Le sk_test_... attivano test mode (carte di test, no soldi veri)
//     Le sk_live_... attivano live mode (carte reali, soldi veri)
//
// Env supportate:
//   - MOCK_PAYMENTS              (default "true")
//   - STRIPE_SECRET_KEY          (sk_test_... o sk_live_...)
//   - STRIPE_WEBHOOK_SECRET      (whsec_..., usata per verifica firma)
//   - STRIPE_API_VERSION         (default "2025-03-31.basil")
//   - APP_CLIENT_URL             (default "http://localhost:3002", per
//                                 success/cancel URLs)
//
// =========================================================================

import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Singleton client Stripe. Restituisce null se non configurato (mock mode).
 */
export function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) return null;
  _stripe = new Stripe(apiKey, {
    apiVersion: (process.env.STRIPE_API_VERSION ?? '2025-03-31.basil') as Stripe.LatestApiVersion,
    typescript: true,
  });
  return _stripe;
}

/**
 * True se siamo in mock mode (no chiamate reali a Stripe).
 *   - MOCK_PAYMENTS=true OPPURE
 *   - STRIPE_SECRET_KEY mancante
 */
export function isMockPayments(): boolean {
  if (process.env.MOCK_PAYMENTS !== 'false') return true; // default true
  if (!process.env.STRIPE_SECRET_KEY) return true;
  return false;
}

/**
 * True se Stripe è in test mode (chiave sk_test_...). Live mode = sk_live_...
 */
export function isStripeTestMode(): boolean {
  const k = process.env.STRIPE_SECRET_KEY ?? '';
  return k.startsWith('sk_test_');
}

interface CreateCheckoutSessionInput {
  /** ID univoco interno del Payment (lo passiamo come metadata + client_reference_id). */
  paymentId: string;
  /** Importo in centesimi (Stripe vuole minor units). */
  amountCents: number;
  /** Valuta ISO 4217 minuscola: "eur", "usd", ecc. */
  currency: string;
  /** Descrizione mostrata al cliente nel checkout. */
  description: string;
  /** Email del cliente (precompila il campo email del checkout). */
  customerEmail: string;
  /** ID del progetto (per redirect dopo pagamento). */
  projectId: string;
  /** ID della fattura (metadata). */
  invoiceId: string;
}

/**
 * Crea una Checkout Session Stripe per un pagamento singolo.
 * Ritorna URL del checkout dove redirigere il cliente.
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error(
      'Stripe non configurato. Imposta STRIPE_SECRET_KEY in .env oppure usa MOCK_PAYMENTS=true.',
    );
  }

  const baseUrl = process.env.APP_CLIENT_URL ?? 'http://localhost:3002';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: input.amountCents,
          product_data: {
            name: input.description,
          },
        },
        quantity: 1,
      },
    ],
    customer_email: input.customerEmail,
    client_reference_id: input.paymentId,
    metadata: {
      paymentId: input.paymentId,
      projectId: input.projectId,
      invoiceId: input.invoiceId,
    },
    success_url: `${baseUrl}/projects/${input.projectId}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/projects/${input.projectId}/payment-cancel`,
  });

  if (!session.url) {
    throw new Error('Stripe Checkout: session creata ma senza URL.');
  }

  return { sessionId: session.id, url: session.url };
}

/**
 * Verifica la firma di un webhook Stripe.
 * Lancia se la firma non è valida.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    throw new Error('Stripe webhook non configurato (STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET mancanti).');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
