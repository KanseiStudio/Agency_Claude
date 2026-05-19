# Setup 11 — Deliverable cliente + flusso revisioni

> Step 11 dello Sprint 0.
> Obiettivo: chiudere il cerchio cliente. L'admin pubblica i deliverable prodotti da Copy e Art & Design; il cliente li vede in preview e può richiedere fino a 3 round di revisione gratuiti (4° round registrato come "a pagamento" — il gating Stripe vero arriverà nel Setup 12).

---

## Cosa stiamo costruendo

### Lato admin

- **Bottone "Pubblica al cliente"** che, in una transazione, prende l'output più recente di Copy + Art & Design e crea record `Deliverable`:
  - Per il Copy Agent: una entry per ogni copy deliverable, con tutte le varianti scritte come `.md` nello storage
  - Per l'Art & Design: una entry per ogni asset visivo (storage_key già esistente)
- **Idempotente**: cliccare di nuovo cancella i deliverable precedenti e li ricrea (utile dopo rigenerazioni)
- **Stato progetto** → `in_revisione`
- **Lista deliverable pubblicati** in card
- **Sezione "Revisioni richieste"** in box ambra con tutte le richieste del cliente raggruppate per round, con riferimento al deliverable

### Lato cliente

- **Banner ambra** "I primi deliverable sono pronti" con contatore round gratuiti rimasti
- **Sezione "Deliverable in revisione"**: card per ogni deliverable
  - Per le **immagini**: preview inline (servita via `/api/storage/...`)
  - Per i **testi**: placeholder che dice "scaricabile dopo pagamento" (i .md sono comunque in storage, ma non li mostriamo inline al cliente prima del pagamento)
  - Per ogni deliverable: bottone **Richiedi revisione** che apre un form inline
- **Form revisione**: textarea + bottoni "Invia" / "Annulla". Submit crea una `RevisionRequest` agganciata al round corrente (o crea nuovo round)
- **Avviso round a pagamento** dopo il 3°: messaggio chiaro che il prossimo round avrà costo (placeholder € 50, configurabile via codice)

### Logica round

- Round 1-3: tipo `incluso` (gratuiti), `prezzoCents: 0`
- Round 4+: tipo `extra_a_pagamento`, `prezzoCents: 5000` (€50 placeholder)
- Tutte le richieste fatte nella stessa "sessione" (round aperto) si aggregano in un singolo `RevisionRound` con N `RevisionRequest`
- Lo stato del round resta `richiesta` finché l'admin non lo processa (Setup successivo)

---

## Stato preparato per te

**Admin app:**
- `src/app/projects/[id]/actions.ts` — nuova action `publishToClientAction` (transazione: crea deliverable + state change + event)
- `src/app/projects/[id]/publish-button.tsx` — bottone client component
- `src/app/projects/[id]/page.tsx` — sezione "Pubblicazione al cliente" con bottone + lista deliverable, sezione "Revisioni richieste" raggruppate per round

**Client app:**
- `src/app/projects/[id]/revision-actions.ts` — `requestRevisionAction` con tracking round gratuiti/paid
- `src/app/projects/[id]/revision-form.tsx` — form client component inline (toggle, validation, success state)
- `src/app/projects/[id]/page.tsx` — banner `in_revisione`, sezione "Deliverable in revisione" con preview immagini + form revisione per deliverable, avviso round a pagamento

---

## Step 1 · Type-check

```powershell
pnpm type-check
```

Atteso: 7 pacchetti `successful`.

---

## Step 2 · Avvia entrambe le app

```powershell
pnpm dev
```

---

## Step 3 · Test admin: pubblica deliverable

Login admin. Vai su un progetto in stato `in_produzione` con **Copy Agent e/o Art & Design già eseguiti**.

In fondo alla pagina dovresti vedere una nuova sezione **Pubblicazione al cliente** con bottone verde **Pubblica al cliente**.

Click.

Atteso:
- la sezione si popola con la lista dei deliverable creati (es. "Post social 1 · angolo 'lancio'", "Logo principale", ecc.) con status `qa_passed`
- badge stato progetto cambia in **in revisione**
- in `deliverables` su Adminer ci sono N righe nuove
- per i copy, su `./storage/deliverables/<projectId>/copy/...` trovi i `.md`
- in `events` riga `project.published_to_client`

---

## Step 4 · Test cliente: vede deliverable

In altro browser/incognito, login cliente, apri il progetto.

Atteso:
- banner ambra "I primi deliverable sono pronti..." con `3 round gratuiti rimasti su 3`
- nuova sezione **Deliverable in revisione**
- per ogni immagine: preview visibile inline
- per ogni copy: placeholder con messaggio "scaricabile dopo pagamento"
- per ogni deliverable: link "Richiedi revisione →"

---

## Step 5 · Test richiesta revisione

Click "Richiedi revisione →" su un deliverable. Si apre form ambra.

Compila con almeno 10 caratteri:
```
La palette è troppo desaturata. Vorrei accenti più caldi tipo arancione bruciato.
```

Click **Invia richiesta**.

Atteso:
- il form si chiude
- messaggio verde "Revisione richiesta · round 1 (gratuito)"
- contatore round gratuiti rimasti: 2

Verifica DB:
- `revision_rounds`: 1 riga `numero: 1, tipo: incluso, prezzoCents: 0, status: richiesta`
- `revision_requests`: 1 riga con `descrizioneModifica`
- `events`: riga `revision.requested`

---

## Step 6 · Test admin vede revisione

Torna su admin, ricarica il progetto.

Atteso: nuova sezione **Revisioni richieste dal cliente** in box ambra grande con:
- Round 1 · incluso
- la tua richiesta sotto il titolo del deliverable
- timestamp

---

## Step 7 · Test 3+ round e gating "a pagamento"

Ripeti la richiesta revisione altre 3 volte (variando il deliverable). Al 4° tentativo:

Atteso lato cliente:
- banner ambra "Hai esaurito i 3 round gratuiti..."
- il form funziona comunque (per V1 non blocchiamo)
- il round 4 viene creato come `tipo: extra_a_pagamento`, `prezzoCents: 5000`

Verifica DB: `revision_rounds` ora ha 4 righe, l'ultima con `tipo: extra_a_pagamento`.

> Nel Setup 12 aggiungeremo il vero gating Stripe sul 4° round.

---

## Step 8 · Format, commit, push

```powershell
pnpm format
git add .
git commit -m "feat: pubblicazione deliverable + flusso revisioni cliente (3 free + paid)"
git push
```

---

## Cosa abbiamo raggiunto

- Flusso end-to-end cliente: vede deliverable → richiede revisioni → admin riceve → cicla
- Tabelle `deliverables`, `revision_rounds`, `revision_requests` finalmente popolate da flusso reale
- Storage delle copy come `.md` (utile per export futuri: download zip, share link, ecc.)
- Sistema di counting round gratuiti/paid pronto per il gating Stripe

---

## Comandi utili

| Comando | Cosa fa |
|---------|---------|
| `pnpm dev` | Entrambe le app |
| `pnpm db:studio` | Esplora `deliverables`, `revision_rounds`, `revision_requests` |
| `Get-ChildItem -Recurse storage/deliverables` | Vede i `.md` salvati |

---

## Troubleshooting

**"Stato progetto X non consente la pubblicazione"**
Il progetto è in uno stato precedente a `preventivo_accettato`. Fai accettare il preventivo al cliente.

**"Nessun output da Copy o Art & Design da pubblicare"**
Non hai eseguito né Copy né Art & Design. Lancia almeno uno dei due dalla pagina admin.

**Cliente non vede la sezione Deliverable**
Lo stato deve essere `in_revisione` (o comunque ci devono essere `deliverables` nel DB). Verifica che l'admin abbia cliccato "Pubblica al cliente".

**Cliente vede "Non sei autorizzato" quando richiede revisione**
La session è scaduta. Logout/login.

**Round counter sbagliato**
Il contatore conta `revisionRounds.filter(r => r.status === 'completata').length`. In V1 i round restano in `richiesta` finché non li processiamo manualmente. Quindi "completati" sono 0 anche se ci sono richieste pendenti. Verremo lì nel Setup 12-13.

---

## Prossimo step

**Setup 12 — Pagamento + download gating + workflow revisioni admin.**

Tre cose insieme:
1. **Stripe Checkout** per pagare le revisioni extra (con conferma webhook)
2. **Download gating**: una volta pagato l'intero progetto, l'admin marca i deliverable come `consegnato` e il cliente può scaricarli via signed URL (LocalFsProvider.getSignedUrl da implementare)
3. **Workflow admin revisioni**: bottone "Marca round come completato" che attiva la trigger per rigenerare gli agenti coinvolti sui deliverable specifici

Quando hai validato che pubblicazione + revisione funzionano end-to-end, dimmelo.
