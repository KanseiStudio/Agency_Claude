# Setup 05 — Primo flusso end-to-end: brief intake + approvazione admin

> Step 5 dello Sprint 0.
> Obiettivo: il primo flusso applicativo che attraversa **tutti i layer costruiti finora** — auth (Setup 03/04), database (Setup 02) e storage (Setup 04) — producendo un risultato visibile dal punto di vista del cliente E dell'admin.

---

## Cosa stiamo costruendo

### Lato cliente (`apps/client`)

- **`/projects/new`** — form per inviare un nuovo brief con titolo, descrizione, deliverable richiesti (multi-select), deadline opzionale, budget indicativo e file di reference (PDF/immagini/ZIP, max 25 MB)
- **`/projects`** — lista dei propri progetti con stato visualizzato a badge
- **`/projects/[id]`** — dettaglio del proprio progetto (brief inviato, file, stato), con messaggi di stato dedicati (in attesa, approvato, rifiutato)

### Lato admin (`apps/admin`)

- **`/projects`** — lista di TUTTI i progetti, ordinati per stato + data
- **`/projects/[id]`** — dettaglio con brief, file, timeline eventi, e — **se il brief è in attesa di approvazione** — i pulsanti **Approva** / **Rifiuta**

### Server actions

- **`createProjectAction`** (cliente) — valida brief, salva file su storage, crea `Project` + `Brief` + `ProjectFile` + `Approval` + `Event` in transazione DB, redirige al dettaglio
- **`approveBriefAction`** (admin) — promuove progetto a stato `in_analisi`, chiude approval, scrive evento
- **`rejectBriefAction`** (admin) — annulla progetto, chiude approval con motivo, scrive evento

### Tabelle DB usate (tutte già presenti dallo schema Setup 02)

- `projects` (status: `in_attesa_approvazione_admin` → `in_analisi` o `annullato`)
- `briefs`
- `project_files`
- `approvals` (checkpoint `brief_iniziale`)
- `events` (`project.created`, `project.brief_approved`, `project.brief_rejected`)

---

## Stato preparato per te

**Pacchetto `@kansei/shared`:**

- `src/codes/project-code.ts` — generatore `KSA-YYYY-NNNN`
- `src/schemas/brief.ts` — schema Zod del brief + tipologie deliverable
- `src/index.ts` — export aggiornato

**Client app:**

- `src/app/projects/page.tsx` — lista
- `src/app/projects/new/page.tsx` — form page
- `src/app/projects/new/brief-form.tsx` — form client component
- `src/app/projects/new/actions.ts` — `createProjectAction`
- `src/app/projects/[id]/page.tsx` — dettaglio
- `src/app/page.tsx` — aggiornata con bottoni "Vedi tutti" e "+ Nuovo brief"

**Admin app:**

- `src/app/projects/page.tsx` — lista
- `src/app/projects/[id]/page.tsx` — dettaglio
- `src/app/projects/[id]/actions.ts` — `approveBriefAction`, `rejectBriefAction`
- `src/app/projects/[id]/approval-buttons.tsx` — UI client-side dei due bottoni
- `src/app/page.tsx` — aggiunte card "Approvazioni pendenti" e "Progetti totali"

---

## Step 1 · Crea la cartella storage locale

I file caricati dai clienti finiranno in `./storage/` (path configurato in `.env` come `STORAGE_LOCAL_ROOT=./storage`). La cartella viene creata al volo dalla LocalFsProvider la prima volta che viene scritto un file, ma è buona prassi crearla esplicitamente:

```powershell
New-Item -ItemType Directory -Path "storage" -Force
```

> La cartella `storage/` è già nel `.gitignore` (escluso ai vari livelli per sicurezza). I file dei clienti non finiranno mai su GitHub.

---

## Step 2 · Type-check

Visto che abbiamo aggiunto file in tutti i pacchetti, verifichiamo che tutto compili:

```powershell
pnpm type-check
```

Atteso: 6 pacchetti `successful` (`shared`, `database`, `auth`, `storage`, `admin`, `client`).

---

## Step 3 · Avvia entrambe le app

```powershell
pnpm dev
```

Atteso: Turborepo lancia `@kansei/admin` su `:3000` e `@kansei/client` su `:3001`.

---

## Step 4 · Test cliente — invio nuovo brief

Apri <http://localhost:3001>, fai login con il cliente demo:

- Email: `cliente.demo@example.com`
- Password: `cliente-dev-2026!`

In home dovresti vedere la card "I tuoi progetti" con il numero `0` e i pulsanti **Vedi tutti** + **+ Nuovo brief**.

### Test 4a · Click su "+ Nuovo brief"

Atteso: pagina `/projects/new` con il form completo.

### Test 4b · Compila il brief

Riempi il form così:

- **Titolo:** Rebranding ristorante Il Tavolo
- **Descrizione:** Vorremmo modernizzare il logo e la palette del nostro ristorante storico, mantenendo il legame con la tradizione campana ma con un'estetica più contemporanea. Tono caldo e familiare, evitare design troppo minimal.
- **Deliverable:** seleziona `Logo / brand identity` e `Pacchetto immagini`
- **Deadline:** una data futura (es. 30/06/2026)
- **Budget indicativo €:** 3000
- **File:** opzionale — se vuoi, allega un PDF qualsiasi sotto i 25 MB

Click **Invia brief**.

Atteso:

- redirect a `/projects/<id>`
- vedi il banner ambra "Il tuo brief è in attesa di approvazione"
- brief mostrato correttamente, file (se caricato) listato
- nello storage locale (cartella `./storage/uploads/<clientId>/<projectId>/`) il file è effettivamente presente. Verifica:

```powershell
Get-ChildItem -Recurse storage
```

Dovresti vedere il tuo file con un timestamp prefissato.

### Test 4c · Lista progetti

Click "← I miei progetti" o vai a `/projects`. Atteso: tabella con il progetto appena creato, badge **in attesa approvazione admin**.

---

## Step 5 · Test admin — approvazione brief

In **un altro browser** o **finestra in incognito** (così le sessioni non si calpestano), apri <http://localhost:3000>, fai login come admin:

- Email: `facecchia@kansei-studio.art`
- Password: `kansei-dev-2026!`

### Test 5a · Card "Approvazioni pendenti"

In home admin dovresti vedere la card **Approvazioni pendenti: 1** in giallo. Click sopra.

### Test 5b · Lista progetti admin

Pagina `/projects`: vedi una tabella con il progetto del cliente, colonna Cliente popolata con `Cliente Demo S.r.l.`, badge **in attesa approvazione admin**.

Click sul codice progetto (es. `KSA-2026-0001`).

### Test 5c · Pagina di dettaglio

Atteso:

- header con codice + titolo
- box giallo grande "Approvazione richiesta · brief iniziale" con due bottoni
- sezione "Brief" con descrizione completa, deliverable, deadline, budget
- sezione "File allegati" (se hai caricato un file)
- sezione "Timeline eventi" con `project.created`

### Test 5d · Approvazione

Click **Approva brief**.

Atteso:

- la pagina si aggiorna
- il box giallo "Approvazione richiesta" sparisce
- il badge di stato cambia da **in attesa approvazione admin** a **in analisi**
- nella timeline appare `project.brief_approved`

### Test 5e · Verifica lato cliente

Torna sul browser del cliente, ricarica `/projects/<id>`.

Atteso:

- il banner ambra "in attesa di approvazione" è sostituito dal banner blu **"Brief approvato! Il team sta analizzando il progetto…"**
- il badge è **in analisi**

---

## Step 6 · Test rifiuto

Crea un secondo brief lato cliente (puoi essere veloce, mettere dati minimi). Lato admin apri il dettaglio e click **Rifiuta**, scrivi un motivo (es. "Budget non coerente con i deliverable richiesti"), click **Conferma rifiuto**.

Atteso:

- lato admin: badge **annullato**
- lato cliente: banner rosso "Brief rifiutato"

---

## Step 7 · Verifica eventi e approval in DB

Apri Adminer su <http://localhost:8080>, login `kansei` / `kansei_dev_password`.

- Tabella `events`: vedrai righe per ogni evento (`project.created`, `project.brief_approved`, `project.brief_rejected`)
- Tabella `approvals`: due record (uno approvato, uno rifiutato), entrambi con `decided_by` valorizzato all'ID di Michele
- Tabella `project_files`: i file caricati con `storage_key` corrispondente al path su filesystem

---

## Step 8 · Format, commit, push

```powershell
pnpm format
git add .
git commit -m "feat: primo flusso end-to-end (brief intake cliente + approvazione admin)"
git push
```

---

## Cosa abbiamo raggiunto

Abbiamo costruito **il primo vertical slice** dell'applicazione: dalla form-fill del cliente, passando per validazione, salvataggio file su storage, persistenza DB transazionale, propagazione stato, dashboard admin con approvazione, fino al feedback al cliente. Tutti i layer principali partecipano:

- `@kansei/auth` per session + role check
- `@kansei/database` per Prisma transactions
- `@kansei/storage` per persistenza file (LocalFsProvider in dev)
- `@kansei/shared` per validation Zod e generazione codici
- Server actions Next.js per mutazioni atomiche
- App Router per routing dinamico (`/projects/[id]`)

Da qui in poi ogni nuova feature riusa lo stesso pattern.

---

## Comandi utili

| Comando                          | Cosa fa                                           |
| -------------------------------- | ------------------------------------------------- |
| `pnpm dev`                       | Avvia entrambe le app                             |
| `pnpm db:studio`                 | UI Prisma per ispezionare progetti, brief, eventi |
| `Get-ChildItem -Recurse storage` | Vede i file caricati dai clienti                  |

---

## Troubleshooting

**Form submit dà "Non autorizzato"**
La sessione del cliente non ha `clientId` valorizzato. Rifai `pnpm db:seed` per ricreare il cliente demo correttamente collegato.

**Errore "STORAGE_PROVIDER non riconosciuto" sul submit**
Manca `STORAGE_PROVIDER=local` in `.env`. Aggiungi (o riprendi dal `.env.example`).

**Il file è stato caricato ma non lo vedo nel filesystem**
Il LocalFsProvider scrive sotto `STORAGE_LOCAL_ROOT` (default `./storage`). Verifica il path:

```powershell
echo $env:STORAGE_LOCAL_ROOT
Get-ChildItem -Recurse storage
```

**Type-error su `project.briefs[0]`**
Il tipo è `Brief | undefined` perché potrebbe non esserci. Il codice controlla con `if (brief)`. Se hai modificato la pagina e tolto il check, rimettilo.

**`P2002 unique constraint codice_progetto`**
Race condition: due progetti generati con lo stesso codice. La server action ritenta fino a 5 volte. Se vedi quest'errore, è perché hai più di 5 collisioni concorrenti — molto improbabile in dev.

---

## Prossimo step

**Setup 06 — Direttore Operativo + Finance/Admin (primi due agenti via n8n).**

Quando approvi un brief, oggi il progetto va in `in_analisi` ma poi non succede niente. Nel Setup 06 colleghiamo n8n: l'approvazione triggera un webhook che fa partire il workflow del Direttore Operativo, che a sua volta chiama il Finance/Admin per produrre il preventivo. Il preventivo viene salvato in DB e mostrato al cliente per accettazione.

È il primo step in cui gli **agenti AI veri** entrano in gioco. Quando hai validato che il flusso brief-intake funziona end-to-end dimmelo.
