# Setup 14 — Stripe Checkout reale (con fallback mock)

> Step 14 dello Sprint 0.
> Obiettivo: portare il flusso pagamento dalla simulazione istantanea a un vero Stripe Checkout. Default in dev resta MOCK (zero setup); per attivare Stripe reale (modalità test = nessuna spesa) basta riempire 2 env var.

---

## Cosa stiamo costruendo

### A. Stripe service centrale (`lib/stripe.ts`)

Singleton del client Stripe, helper `isMockPayments()` e `createCheckoutSession()`. Auto-disable se `STRIPE_SECRET_KEY` non è configurata.

### B. `payProjectAction` con due path

- **Mock path** (default): crea Payment `succeeded` istantaneo + marca Invoice pagata + Project chiuso. Nessuna chiamata HTTP.
- **Stripe path**: crea Payment `pending`, crea Stripe Checkout Session, salva `stripeSessionId`, ritorna `redirectUrl` per redirect client-side. Il pagamento diventa `succeeded` solo dopo il webhook.

### C. Webhook `/api/stripe/webhook`

Riceve eventi Stripe (`checkout.session.completed`, `payment_intent.payment_failed`), verifica firma con `STRIPE_WEBHOOK_SECRET`, aggiorna Payment + Invoice + Project.

### D. Pagine success/cancel

`/projects/[id]/payment-success?session_id=...` mostrata dopo checkout completato.
`/projects/[id]/payment-cancel` se l'utente annulla.

---

## Stato preparato per te

**Schema Prisma:**
- `Payment.stripeSessionId` (unique, popolato al submit)
- `Payment.stripePaymentIntentId` (unique, popolato dal webhook)

**Client app:**
- `lib/stripe.ts` — wrapper singleton + helpers
- `app/projects/[id]/payment-actions.ts` — `payProjectAction` rifatto
- `app/projects/[id]/pay-button.tsx` — gestisce redirect Stripe
- `app/api/stripe/webhook/route.ts` — handler eventi
- `app/projects/[id]/payment-success/page.tsx` — landing post-checkout
- `app/projects/[id]/payment-cancel/page.tsx` — landing annullamento

**Env:**
- `MOCK_PAYMENTS`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `APP_CLIENT_URL`

---

## Step 1 · Installa la dependency Stripe

```powershell
pnpm install
```

(Il `stripe` package è stato aggiunto in `apps/client/package.json`).

---

## Step 2 · Applica la migration Prisma

I nuovi campi `stripe_session_id` e `stripe_payment_intent_id` su `payments`:

```powershell
pnpm db:migrate
```

Quando ti chiede il nome della migration: `add_stripe_payment_fields`.

---

## Step 3 · Verifica modalità mock (default)

Assicurati che in `.env`:

```env
MOCK_PAYMENTS=true
```

Lancia `pnpm dev` e fai un pagamento di test → dovrebbe funzionare istantaneo come prima (zero modifiche al UX).

---

## Step 4 · Attiva Stripe in test mode

### 4.1 · Crea account Stripe

1. Vai su [stripe.com](https://stripe.com), registra account business
2. **Non serve** verificare l'identità per usare test mode — funziona da subito

### 4.2 · Recupera le test keys

1. Dashboard Stripe → **Developers → API keys** (con toggle "Viewing test data" ON)
2. Copia:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

### 4.3 · Aggiorna `.env`

```env
MOCK_PAYMENTS=false
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx
APP_CLIENT_URL=http://localhost:3001
```

Restart `pnpm dev` per caricare le env nuove.

---

## Step 5 · Setup webhook locale (Stripe CLI)

Il webhook è essenziale: senza, Stripe Checkout completa il pagamento ma la nostra app non lo sa.

### 5.1 · Installa Stripe CLI

Windows (con Scoop):
```powershell
scoop install stripe
```
oppure scarica da [github.com/stripe/stripe-cli/releases](https://github.com/stripe/stripe-cli/releases).

### 5.2 · Login

```powershell
stripe login
```

Apre il browser, autorizza, chiudi.

### 5.3 · Forwarding eventi a localhost

In un terminale dedicato (lascialo aperto durante lo sviluppo):

```powershell
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

La CLI stampa una **webhook signing secret** del tipo:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxx
```

### 5.4 · Aggiorna `.env`

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
```

Restart `pnpm dev`.

---

## Step 6 · Test end-to-end

1. Login cliente, apri un progetto con fattura emessa
2. Click **Paga € X**
3. Vieni reindirizzato a Stripe Checkout (URL `checkout.stripe.com/c/pay/cs_test_...`)
4. Usa carta di test:
   ```
   Numero: 4242 4242 4242 4242
   Scadenza: qualsiasi data futura (es. 12/30)
   CVC: qualsiasi 3 cifre (es. 123)
   ZIP: qualsiasi (es. 00100)
   Email: la tua email
   ```
5. Click **Pay**
6. Stripe completa il pagamento e ridirige a `/projects/[id]/payment-success?session_id=cs_test_...`
7. Nel terminale `stripe listen` vedi l'evento `checkout.session.completed` inoltrato
8. Nel terminale `pnpm dev` vedi il webhook ricevuto e il payment aggiornato
9. Click "Vai al progetto" → vedi banner verde "Pagamento confermato" + bottoni "Scarica file"

### Carte di test utili

| Scenario | Numero |
|---|---|
| Pagamento OK | `4242 4242 4242 4242` |
| Pagamento rifiutato | `4000 0000 0000 9995` |
| Carta scaduta | `4000 0000 0000 0069` |
| 3D Secure richiesto | `4000 0027 6000 3184` |

Lista completa: [stripe.com/docs/testing#cards](https://stripe.com/docs/testing#cards).

---

## Step 7 · Verifica DB

```sql
SELECT id, status, stripe_session_id, stripe_payment_intent_id, transaction_id
FROM payments
ORDER BY created_at DESC
LIMIT 5;
```

Atteso: il payment più recente ha `status='succeeded'`, `stripe_session_id` valorizzato (cs_test_...), `stripe_payment_intent_id` valorizzato (pi_...).

---

## Step 8 · Format, commit, push

```powershell
pnpm format
git add .
git commit -m "feat: Stripe Checkout reale (test mode) + webhook"
git push
```

---

## Cosa abbiamo raggiunto

- Pagamento reale via Stripe Checkout (test mode, no spese vere)
- Webhook con verifica firma per conferma asincrona
- Fallback mock automatico se `STRIPE_SECRET_KEY` non configurata
- DB tracking di `stripe_session_id` e `stripe_payment_intent_id` per audit
- UX: redirect a Stripe → pagina success → ritorno al progetto coi download sbloccati
- Pronto per **produzione**: basta sostituire `sk_test_...` con `sk_live_...` e configurare webhook su Dashboard Stripe (URL pubblico)

---

## Passaggio a Stripe Live (prod)

Quando sarai pronto per soldi veri:

1. **Verifica account**: Dashboard Stripe → Activate your account → segui i passi (documenti, IBAN, ecc.)
2. **Keys live**: Dashboard → API keys (toggle "Viewing test data" OFF) → copia `sk_live_...` e `pk_live_...`
3. **Webhook prod**: Dashboard → Webhooks → Add endpoint → URL pubblico del tuo client portal (es. `https://app.kansei-studio.art/api/stripe/webhook`) → eventi: `checkout.session.completed`, `payment_intent.payment_failed` → copia il signing secret
4. `.env.production`: sostituisci `sk_test_` con `sk_live_`, aggiorna `STRIPE_WEBHOOK_SECRET`, `APP_CLIENT_URL` col dominio reale
5. Test con una transazione minima (€1) prima di andare live ufficialmente

---

## Troubleshooting

**"Webhook signature verification failed"**
`STRIPE_WEBHOOK_SECRET` non corrisponde a quello che la CLI sta usando. Rilancia `stripe listen` e copia di nuovo il secret.

**Redirect non funziona dopo Checkout**
Verifica `APP_CLIENT_URL` in `.env`. Se accedi al client via IP/dominio diverso da localhost, mettilo lì.

**Payment resta in "pending" anche dopo aver pagato**
Il webhook non sta arrivando. Verifica che `stripe listen --forward-to localhost:3001/api/stripe/webhook` sia ancora attivo nel suo terminale.

**"Stripe non configurato" anche con MOCK_PAYMENTS=false**
`STRIPE_SECRET_KEY` è vuota o non valida. Verifica che inizi con `sk_test_` o `sk_live_`.

---

## Prossimo step

**Setup 15 — Email transazionali via Resend** (conferma ordine, conferma pagamento, deliverable pronti) — completa il loop di comunicazione col cliente.

Oppure: **Setup 15 — Prossimo agente** (Email Composer / QA Agent / Project Manager AI dalla roadmap).

Dimmi tu quando hai validato il pagamento Stripe end-to-end e decidiamo il prossimo passo.
