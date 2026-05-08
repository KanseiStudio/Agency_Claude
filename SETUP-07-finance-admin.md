# Setup 07 — Finance/Admin agent + flusso preventivo cliente

> Step 7 dello Sprint 0.
> Obiettivo: chiudere il primo cerchio "brief → analisi → preventivo → cliente accetta". Aggiungiamo il secondo agente AI (Finance/Admin) e il flusso UI completo per la generazione, invio, accettazione/rifiuto del preventivo.

---

## Cosa stiamo costruendo

### Agente `finance-admin`

Riceve in input: brief, output del Direttore (agenti coinvolti, complessità) e listino servizi attivi. Produce in output:

- `prezzo_min_eur`, `prezzo_max_eur` con **gap massimo 15%** (vincolo enforced via Zod refinement)
- `breakdown` di voci con agente, voce, quantità, prezzo unitario, prezzo totale, opzionale
- `conditions` standard (3 round revisione gratuiti, gating download su pagamento, ecc.)
- `valid_until` (default +30 giorni dalla data odierna)
- `note` opzionale (es. avviso se il budget cliente è troppo basso)

### Persistenza in DB

Una run del Finance/Admin produce in transazione:

- `quotes` — record principale del preventivo (con `status: draft`)
- `quote_items` — N voci dal breakdown
- `project_finance_outputs` — payload completo per audit
- `agent_outputs` / `token_usage` / `agent_runs` — automatici via `runAgent`

### Flusso UI

**Admin:**

1. Click "Genera preventivo" → `runFinanceAdminAction` → preventivo in stato `draft`
2. Mostra preventivo strutturato (tabella voci)
3. Click "Invia preventivo al cliente" → `sendQuoteAction` → quote `inviato`, project `preventivo_inviato`

**Cliente:**

1. Vede il preventivo nella sua dashboard quando project status è `preventivo_inviato`
2. Click "Accetta" → quote `accettato`, project `preventivo_accettato`
3. Click "Rifiuta" → quote `rifiutato`, project torna a `in_analisi`

---

## Stato preparato per te

**Pacchetto `@kansei/agents`:**

- `src/agents/finance-admin/schema.ts` — schemi Zod input/output con vincolo gap 15%
- `src/agents/finance-admin/prompt.ts` — system prompt + user message builder
- `src/agents/finance-admin/mock.ts` — mock response che parsea il userMessage e calcola preventivo coerente
- `src/agents/finance-admin/index.ts` — `financeAdminAgent` definition
- `src/index.ts` — export aggiornato + registrazione mock

**Admin app:**

- `src/app/projects/[id]/actions.ts` — nuove action `runFinanceAdminAction`, `sendQuoteAction`
- `src/app/projects/[id]/finance-buttons.tsx` — bottoni client component
- `src/app/projects/[id]/page.tsx` — sezione "Preventivo" con tabella voci + bottoni

**Client app:**

- `src/app/projects/[id]/quote-actions.ts` — `acceptQuoteAction`, `rejectQuoteAction`
- `src/app/projects/[id]/quote-buttons.tsx` — bottoni accetta/rifiuta
- `src/app/projects/[id]/page.tsx` — banner stato + sezione preventivo + condizioni
- `package.json` + `next.config.ts` — `@kansei/agents` aggiunto

---

## Step 1 · Type-check

```powershell
pnpm type-check
```

Atteso: 7 pacchetti `successful`. Se vedi errori, copiameli.

---

## Step 2 · Avvia entrambe le app

```powershell
pnpm dev
```

---

## Step 3 · Test admin: genera preventivo

Login admin, vai su un progetto in stato `in_analisi` con il **Direttore Operativo già eseguito**. Se non l'hai, esegui prima il Direttore (Setup 06).

Sotto la sezione Direttore vedi una nuova sezione **Preventivo (Finance/Admin)** con bottone violetto **Genera preventivo**.

Click.

Atteso (in mock, ~300ms):

- la sezione si popola con:
  - 4 card: Min, Max, Gap (≤ 15%), Valido fino
  - **tabella voci** del preventivo (Voce, Agente, Quantità, Unitario, Totale)
  - eventuali voci `opzionale` con badge
- header sezione mostra `v1 · draft`

### Verifica DB su Adminer

- `quotes`: 1 riga in stato `draft`, version 1, `prezzo_min_cents`, `prezzo_max_cents`, `gap_pct`
- `quote_items`: N righe con agente + voce + prezzi
- `project_finance_outputs`: 1 riga con payload completo
- `agent_runs` / `token_usage` / `agent_outputs`: nuove righe `agente: finance-admin`

---

## Step 4 · Test admin: invia preventivo

Click **Invia preventivo al cliente**.

Atteso:

- la sezione mostra ora `v1 · inviato`
- il box bottone sparisce, sostituito da banner blu "Preventivo inviato al cliente. In attesa di risposta."
- badge stato progetto cambia in **preventivo inviato**
- in `events` nuova riga `project.quote_sent`

---

## Step 5 · Test cliente: visualizza preventivo

In altro browser/incognito, login cliente, apri il progetto.

Atteso:

- banner viola "È arrivato il preventivo"
- badge stato `preventivo inviato`
- nuova sezione **Preventivo · v1 · inviato** con:
  - 4 card riassuntive
  - tabella voci (senza colonna "Agente" perché meno rilevante per il cliente)
  - lista condizioni standard
  - bottoni **Accetta preventivo** (verde) e **Rifiuta** (rosso)

---

## Step 6 · Test accettazione

Click **Accetta preventivo**.

Atteso:

- banner verde "Preventivo accettato. Il team partirà a breve con la produzione."
- sezione preventivo mostra ora `v1 · accettato`
- bottoni spariscono
- badge stato `preventivo accettato`

Lato admin (ricarica pagina):

- sezione preventivo mostra `v1 · accettato`
- banner verde "Preventivo accettato dal cliente. Si può procedere con la produzione."
- in `events` riga `project.quote_accepted`

---

## Step 7 · Test rifiuto

Crea un nuovo progetto, falla arrivare fino a `preventivo_inviato`. Lato cliente click **Rifiuta**.

Atteso:

- sezione preventivo mostra `v1 · rifiutato`
- badge progetto torna a `in_analisi`
- lato admin: banner rosso "Preventivo rifiutato dal cliente. Genera un nuovo preventivo dopo aver rivisto il piano."

A questo punto l'admin può cliccare **Genera preventivo** di nuovo per produrre una v2.

---

## Step 8 · Format, commit, push

```powershell
pnpm format
git add .
git commit -m "feat(agents): finance-admin agent + flusso preventivo cliente"
git push
```

---

## Cosa abbiamo raggiunto

- Secondo agente AI funzionante con stesso pattern del primo (zero overhead di codice)
- Flusso preventivo end-to-end: brief → analisi Direttore → preventivo Finance/Admin → invio → cliente decide → stato progetto avanza
- Vincolo gap 15% applicato a livello di schema Zod (rifiuto a parsing se output LLM viola)
- Versioning preventivi: ogni rifiuto + rigenerazione produce una nuova `version` mantenendo lo storico

Da qui in poi, il progetto può andare in produzione: i prossimi step gestiranno l'esecuzione (Creative Lead → Copy/Design/Video → QA → Deliverable → Pagamento → Download).

---

## Comandi utili

| Comando          | Cosa fa                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `pnpm dev`       | Entrambe le app                                                       |
| `pnpm db:studio` | UI per ispezionare `quotes`, `quote_items`, `project_finance_outputs` |

---

## Troubleshooting

**"Esegui prima il Direttore Operativo"**
Click "Genera preventivo" prima di aver eseguito il Direttore. Esegui prima il Direttore.

**"Output Direttore non valido. Rieseguilo."**
L'output salvato non rispetta lo schema. Click sul bottone "Esegui analisi Direttore Operativo" che lo rigenera.

**Gap > 15% nel mock**
Non dovrebbe succedere col mock (calcola sempre 12% esatto). Se accade, è bug nel mock. Controlla `mock.ts`.

**Errore "Nessun preventivo da accettare"**
Lato cliente click su "Accetta" ma il quote non è in stato `inviato`. Verifica che lato admin sia stato cliccato "Invia al cliente".

**Cliente vede "preventivo inviato" ma niente sezione preventivo**
Bug di query. Verifica che la query in `page.tsx` cerchi `status: { in: ['inviato', 'accettato', 'rifiutato'] }`.

---

## Prossimo step

**Setup 08 — Creative Lead + Copy/Design/Video agents (produzione).**

Quando il cliente accetta il preventivo, lo stato è `preventivo_accettato`. Il Direttore Operativo deve ora orchestrare gli agenti specialisti (Creative Lead → Copy/Design/Video) per produrre i deliverable veri. Setup 08 introduce questi agenti e la pipeline di produzione.

Quando hai validato che il flusso preventivo funziona end-to-end (genera → invia → cliente accetta → admin vede stato aggiornato), dimmelo.
