# Setup 12 — Workflow revisioni admin + pagamento (mock) + download gating

> Step 12 dello Sprint 0.
> Obiettivo: chiudere il loop economico. Admin chiude i round di revisione, crea la fattura; cliente paga (mock per ora) e sblocca i download dei deliverable, serviti via route handler che verifica il pagamento.

---

## Cosa stiamo costruendo

### A. Workflow revisioni admin

Bottone **Marca round come completato** nelle revisioni del cliente. Quando l'admin ha processato le richieste (eventualmente rigenerando Copy/Art&Design + ripubblicando), marca il round come `completata`. Questo:
- Aumenta il counter "round gratuiti consumati"
- Permette al cliente di vedere lo storico "round 1 ✓ completato il …"
- Sblocca la creazione della fattura finale

### B. Fatturazione

Bottone **Crea fattura per il cliente** lato admin. Crea record `Invoice` (`status: emessa`) basato sul prezzo MAX del preventivo accettato. Numero progressivo annuale (`KSA-INV-2026-0001`).

### C. Pagamento (mock V1)

Cliente vede bottone verde **Paga € X e sblocca i download**. In modalità `MOCK_PAYMENTS=true` (default):
- Click → crea `Payment` con `status: succeeded` immediato
- Marca `Invoice` come `pagata`
- Marca `Project` come `chiuso`
- Cliente vede subito i bottoni download

In modalità `MOCK_PAYMENTS=false` (futuro): redirect a Stripe Checkout, webhook conferma, stesso effetto finale.

### D. Download gating

Route handler `/api/client-files/[...key]` nel client portal che, per ogni richiesta:
1. Verifica auth client + ownership progetto
2. Verifica esistenza payment confermato per quel progetto
3. Se sì → serve il file con `Content-Disposition: attachment`
4. Se no → 401/403/402

Differente da `/api/storage/[...key]` dell'admin (admin-only, ignora payment).

---

## Stato preparato per te

**Admin app:**
- `actions.ts` — nuove `markRevisionRoundCompletedAction`, `createInvoiceAction`
- `revision-round-button.tsx` — bottone "Marca round completato"
- `invoice-button.tsx` — bottone "Crea fattura"
- `page.tsx` — sezione "Fatturazione e pagamento" con stato + storico payments; bottone Marca completato inline nei round

**Client app:**
- `payment-actions.ts` — `payProjectAction` con switch mock/Stripe
- `pay-button.tsx` — bottone client component
- `api/client-files/[...key]/route.ts` — handler download gated
- `page.tsx` — banner "Pagamento confermato", box fattura + Paga, bottoni "Scarica" per ogni deliverable (visibili solo se pagato)

**Env:**
- `.env.example` — `MOCK_PAYMENTS=true` default in dev

---

## Step 1 · Aggiorna `.env`

Aggiungi se manca:

```env
MOCK_PAYMENTS=true
```

---

## Step 2 · Type-check + dev

```powershell
pnpm type-check
pnpm dev
```

Atteso: 7 pacchetti `successful`.

---

## Step 3 · Test workflow admin

Login admin, apri un progetto che è in `in_revisione` con richieste di revisione pendenti (dal Setup 11).

In **Revisioni richieste dal cliente**, in fondo al round vedi nuovo bottone arancione **Marca round come completato**.

Click. Atteso:
- il round mostra `✓ Completato il <timestamp>` invece del bottone
- in `revision_rounds` su Adminer: `status: completata`, `completedAt` valorizzato
- in `events`: nuova riga `revision.round_completed`

Nella sezione **Pubblicazione al cliente** se ricarichi, vedi nuova sezione **Fatturazione e pagamento** con bottone **Crea fattura per il cliente**.

Click. Atteso:
- la sezione si popola con la fattura creata (numero `KSA-INV-2026-XXXX`, importo, data emissione, status `emessa`)
- in `invoices` su Adminer: nuova riga collegata al quote del progetto

---

## Step 4 · Test pagamento cliente

In altro browser/incognito, login cliente, apri il progetto.

Atteso:
- nella sezione **Deliverable in revisione** vedi un nuovo box verde grande con:
  - "Fattura KSA-INV-...
  - Importo da pagare: € X.XXX
  - Bottone verde grande **Paga € X.XXX e sblocca i download**
  - Disclaimer "Pagamento simulato in dev"

Click **Paga**. Atteso (in mock, istantaneo):
- pagina si aggiorna
- box verde sparisce, sostituito da banner verde "✓ Pagamento confermato. I file sono scaricabili."
- ogni card deliverable mostra un nuovo bottone verde **Scarica file**
- badge stato progetto cambia in **chiuso**

---

## Step 5 · Test download

Click **Scarica file** su un deliverable visivo (immagine SVG). Atteso: download del file con il nome del deliverable.

Click su un deliverable testuale (.md). Atteso: download del file markdown.

### Verifica gating

Apri una scheda incognito non loggata e prova a navigare a `/api/client-files/deliverables/...`. Atteso: `401 Unauthorized`.

Loggato come cliente ma con un progetto **non** pagato: `402 Payment Required`.

---

## Step 6 · Verifica DB

- `invoices`: status `pagata`, `paidAt` valorizzato
- `payments`: riga `metodo: stripe`, `status: succeeded`, `transactionId: mock_<timestamp>`
- `projects`: `stato: chiuso`, `closedAt` valorizzato
- `events`: `payment.succeeded`

---

## Step 7 · Format, commit, push

```powershell
pnpm format
git add .
git commit -m "feat: workflow revisioni admin + pagamento (mock) + download gating"
git push
```

---

## Cosa abbiamo raggiunto

- Loop completo cliente: brief → preventivo → produzione → revisioni → pagamento → download
- Tutti gli stati del progetto attivati (`bozza` → `chiuso`)
- Architettura pronta per Stripe Checkout reale (basta sostituire la logica nella action)
- Gating download a livello di route handler (auth + ownership + payment)
- Storico pagamenti tracciabile

---

## Comandi utili

| Comando | Cosa fa |
|---------|---------|
| `pnpm db:studio` | Esplora `invoices`, `payments`, `revision_rounds` |
| `MOCK_PAYMENTS=true` | Pagamento simulato (default dev) |
| `MOCK_PAYMENTS=false` | Richiede integrazione Stripe (TODO) |

---

## Troubleshooting

**"Nessun preventivo accettato per cui fatturare"**
Il preventivo deve essere in stato `accettato`. Verifica che il cliente abbia accettato il preventivo nei setup precedenti.

**"Esiste già una fattura attiva per questo progetto"**
C'è già un'`Invoice` in stato `draft` o `emessa`. Annullala manualmente da Adminer se vuoi crearne un'altra.

**Bottone "Scarica file" non funziona**
- Cliente non pagato: il route handler ritorna 402. Paga prima.
- File non trovato in storage: verifica `Get-ChildItem -Recurse storage/deliverables` che il file esista.

**"Payment required" 402 dopo aver pagato**
Cache del browser. Ricarica con `Ctrl+Shift+R`.

**Admin vede bottone "Crea fattura" anche se progetto non è pronto**
Per V1 mostriamo il bottone se ci sono deliverable. In V2 lo nasconderemo se ci sono round revisione ancora aperti.

---

## Prossimo step

**Setup 13 — Stripe Checkout reale + webhook**, oppure **Setup 13 — Image generation reale (Higgsfield)**, oppure **Setup 13 — Video/Audio Agent**.

Stripe è il più "business-critical" da sbloccare prima di andare live. Higgsfield e Video sono i più "wow" per testing visuale.

E, come da promessa: torniamo anche sul problema delle immagini non visibili che hai segnalato — quando hai tempo dimmi cosa vedi esattamente (icona x rotta? errore in console?) e indaghiamo.

Quando hai validato il flusso pagamento end-to-end, dimmelo.
