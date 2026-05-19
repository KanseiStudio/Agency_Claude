# Setup 15 — Email Composer + invio SMTP

> Step 15 dello Sprint 0.
> Obiettivo: avere un agente che compone email transazionali (preventivo inviato, deliverable pronti, pagamento confermato, ecc.) in italiano con tono umano, e un mailer SMTP che le invia davvero da `agency@kansei-studio.art`.

---

## Cosa stiamo costruendo

### A. Email Composer Agent

Agente LLM (o mock template-based) che riceve `kind + context` e produce `subject + body_text + body_html + preheader`. Supporta 10 kind:

| Kind | Quando inviarla |
|---|---|
| `quote_sent` | Subito dopo invio preventivo |
| `quote_reminder` | Se il cliente non risponde da N giorni |
| `production_started` | Brief approvato, produzione in corso |
| `deliverables_ready` | Pubblicazione al cliente |
| `revision_completed` | Round revisione chiuso |
| `invoice_issued` | Fattura emessa |
| `payment_confirmed` | Pagamento ricevuto |
| `payment_reminder` | Fattura non pagata da N giorni |
| `project_completed` | Progetto chiuso |
| `custom` | Note libere dell'admin |

### B. Mailer SMTP

`apps/admin/src/lib/mailer.ts` — wrapper nodemailer con auto-detect mock mode.

- **MOCK_EMAILS=true** o **SMTP_HOST mancante** → logga in console
- altrimenti → invia via SMTP (default porta 465, SSL/TLS)

### C. Admin UI

- Sezione "Email cliente" nella project page admin
- Dropdown coi 10 kind + textarea note (per kind=custom)
- Bottone "Genera e invia email"
- Log delle ultime 5 email inviate per quel progetto, col body espandibile

### D. EmailMessage log

Model in DB (`email_messages`) con: kind, to, from, subject, body, status (queued/sent/failed), smtp_message_id, error_message, sent_at.

---

## Stato preparato per te

**Schema Prisma:**
- `EmailMessage` (nuovo model)
- `EmailKind` enum (10 valori)
- `EmailStatus` enum (queued/sent/failed)

**packages/agents:**
- `agents/email-composer/{schema,prompt,mock,index}.ts` (4 file)
- `index.ts` aggiornato con export + mock registration

**apps/admin:**
- `lib/mailer.ts` — nodemailer wrapper
- `app/projects/[id]/actions.ts` — `composeAndSendEmailAction(projectId, kind, customNotes)`
- `app/projects/[id]/email-button.tsx` — dropdown UI
- `app/projects/[id]/page.tsx` — sezione email + log
- `package.json` — aggiunto `nodemailer` + `@types/nodemailer`

**Env:**
- `.env.example` — sezione SMTP per `agency@kansei-studio.art`

---

## Step 1 · Installa dipendenze

```powershell
pnpm install
```

(Scarica `nodemailer` e i suoi types.)

---

## Step 2 · Migration DB

```powershell
pnpm db:migrate
```

Nome migration: `add_email_messages`.

Verifica su Adminer che la tabella `email_messages` esista con tutti i campi.

---

## Step 3 · Configura `.env` con la password reale

Apri `.env` (NON `.env.example`) e aggiungi/aggiorna:

```env
MOCK_EMAILS=false
SMTP_HOST=mail.kansei-studio.art
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=agency@kansei-studio.art
SMTP_PASSWORD=la_tua_password_reale_qui
MAIL_FROM_ADDRESS=agency@kansei-studio.art
MAIL_FROM_NAME="Kansei-Studio Agency"
```

⚠️ La password vera resta SOLO nel tuo `.env` locale. Non finisce mai nel repo perché `.env` è in `.gitignore`.

---

## Step 4 · Test in mock mode (consigliato prima)

Prima di inviare email reali, testa in mock:

```env
MOCK_EMAILS=true
```

`pnpm dev` → apri un progetto → sezione "Email cliente" → scegli **Deliverable pronti** → click **Genera e invia email**.

Atteso:
- Banner verde "✓ Email inviata"
- Nel terminale di `pnpm dev` vedi `[mailer:MOCK] To: ... | Subject: ...`
- Nel log "Ultime email" appare la mail con status `sent` (etichetta `mock`)
- Apri l'accordion: vedi il body in plain text

---

## Step 5 · Test invio reale SMTP

Imposta `MOCK_EMAILS=false` (o rimuovilo, default è false).

Restart `pnpm dev` per ricaricare le env.

Ripeti l'invio dal pannello. Atteso:
- Banner verde
- Nel log "Ultime email" status `sent` con `smtp_message_id` valorizzato
- Apri la inbox del cliente (o, se la mail è la tua per test, la tua inbox): l'email arriva entro 5-30 secondi

### Test smoke connessione

Se vuoi verificare che SMTP risponda senza inviare:

```typescript
// in qualsiasi route/api di debug
import { verifySmtpConnection } from '@/lib/mailer';
const r = await verifySmtpConnection();
console.log(r); // { ok: true, message: 'Connessione SMTP ok (mail.kansei-studio.art).' }
```

---

## Step 6 · Verifica DB

```sql
SELECT id, kind, status, to_address, subject, sent_at, smtp_message_id, error_message
FROM email_messages
ORDER BY created_at DESC
LIMIT 5;
```

Atteso: l'ultima email con `status='sent'`, `smtp_message_id` non-null se reale, `error_message` null.

---

## Step 7 · Format, commit, push

```powershell
pnpm format
git add .
git commit -m "feat: Email Composer agent + SMTP mailer"
git push
```

⚠️ Verifica `git diff --cached .env.example`: assicurati che la sezione SMTP abbia solo placeholder, NON la tua password vera. Il file `.env` (la tua copia locale) deve restare ignorato da git — controllo veloce: `git status` non deve elencare `.env`.

---

## Cosa abbiamo raggiunto

- 10 tipi di email generabili con tono italiano professionale
- Invio reale via SMTP (porta 465 SSL/TLS) o mock per dev
- Tracking completo in `email_messages`: stato, errori, smtp message-id
- UI admin con dropdown + log
- Fail-soft: errore SMTP non rollbacka l'azione, l'email message resta in DB

---

## Cosa NON abbiamo fatto (volutamente)

- **Auto-trigger**: per ora le email vanno mandate manualmente dal pannello. In V2 collegheremo i trigger nelle action correlate (es. `publishToClientAction` invia automaticamente `deliverables_ready`).
- **Queue + retry**: invio sincrono nel server action. Per volumi più alti serve una coda (BullMQ/Inngest/Cloudflare Queues).
- **Inbound** (leggere risposte clienti): IMAP non integrato. La porta 993 è documentata nell'env per il futuro.
- **Allegati**: non supportati nel composer (es. invoice PDF in attach). In V2.
- **Bounce handling**: se la mail bouncia, non lo sappiamo (servirebbero webhook del provider SMTP).

---

## Troubleshooting

**"Authentication failed" / "Invalid credentials"**
Password sbagliata o utente sbagliato. Verifica che SMTP_USER sia l'email completa (`agency@kansei-studio.art`) e SMTP_PASSWORD esatta. Controlla anche che il provider non blocchi login da nuovo IP (in alcuni casi serve abilitare "app password" o "less secure apps" — dipende dall'hoster).

**"Connection timeout"**
SMTP_PORT sbagliata o firewall. La porta 465 (SSL/TLS) è la giusta per `mail.kansei-studio.art`. Se non funziona, prova 587 con `SMTP_SECURE=false` (STARTTLS).

**Email arriva in spam**
- Verifica record DNS del dominio: SPF, DKIM, DMARC tutti configurati e validi
- Subject e body non devono contenere SPAM phrases (gli abbiamo evitati nel prompt)
- Da una nuova mailbox, "warm up" graduale: invia poche email/giorno per le prime 2 settimane

**"socket hang up"**
TLS handshake fallito. Verifica `SMTP_SECURE` coerente con la porta:
- 465 → `SMTP_SECURE=true`
- 587 → `SMTP_SECURE=false`

**Mock mode anche con SMTP_HOST settato**
Verifica che `MOCK_EMAILS` non sia "true". Se è "true" o non specificata e SMTP_HOST è vuota, il mailer va in mock.

---

## Prossimo step

Tra i 3 agenti rimanenti della roadmap V1:

- **QA Agent** — valida output di Copy/Art prima della pubblicazione (mustHaves/mustAvoids, brand voice, refusi)
- **Client Onboarding Bot** — chatbot intervista nuovi clienti per popolare il brief
- **Analytics Agent** — report mensile (margini, costi LLM, fatturato)

Quando hai validato l'invio email, dimmi quale preferisci.
