# Setup 02 — Database MySQL + Prisma

> Step 2 dello Sprint 0 della roadmap.
> Obiettivo: avere un database MySQL funzionante in locale via Docker, lo schema completo definito in Prisma, le migrazioni applicate, i dati di seed inseriti, e il client Prisma importabile dalle due app Next.js.

Quando finisci questa guida, da PowerShell potrai:

- avviare/spegnere MySQL con un comando
- ispezionare il DB visualmente nel browser (Adminer)
- modificare lo schema Prisma e generare migrazioni in automatico
- usare `prisma` da `apps/admin` o `apps/client` con tipi TypeScript completi

---

## Cosa stiamo costruendo, in una frase

Un container Docker che ospita MySQL 8 (con Adminer come UI), un pacchetto del monorepo (`@kansei/database`) che contiene lo **schema completo del database** dell'agenzia (45+ tabelle: clienti, progetti, brief, preventivi, deliverable, agent runs, token usage, fatture, approvazioni, ecc.), e un **client Prisma** condiviso che le due app Next.js potranno importare con `import { prisma } from '@kansei/database'`.

### Perché Docker e non MySQL nativo

- **Zero installazione invasiva sulla macchina:** spegni Docker e MySQL sparisce, niente servizi Windows residui
- **Stessa identica versione di MySQL** che useremo in produzione, garantita
- **Reset completo in 5 secondi** con `pnpm db:reset` quando serve ripartire pulito
- **Adminer incluso:** UI web per ispezionare i dati (alternativa a MySQL Workbench, ma senza installazioni)

### Perché Prisma e non un ORM "tradizionale"

- **Tipi TypeScript auto-generati** dallo schema: zero possibilità di errori del tipo "ho letto un campo che non esiste"
- **Migrazioni automatiche** dalla diff fra schema attuale e DB
- **Prisma Studio:** UI integrata per esplorare i dati durante lo sviluppo
- **Standard de facto** in ecosistema Next.js / TypeScript moderno

### Perché un pacchetto dedicato `@kansei/database`

In un monorepo è una pessima idea avere il client Prisma duplicato in `admin` e `client`: divergerebbero, ognuno avrebbe il suo schema. Centralizzando in un pacchetto:

- una sola fonte di verità per lo schema
- un singolo `prisma generate` aggiorna i tipi ovunque
- l'eventuale runner n8n (in fase successiva) può importare lo stesso client

---

## Prerequisiti

Oltre a quanto hai già installato per Setup 01 (Node 20, pnpm 9, Git), serve **Docker Desktop**.

### Docker Desktop

Verifica:

```powershell
docker --version
docker compose version
```

Atteso: due versioni stampate. Se mancano:

- Scarica Docker Desktop da <https://www.docker.com/products/docker-desktop/>
- Installa con WSL 2 backend abilitato (è l'opzione di default sui Windows recenti)
- Riavvia se richiesto
- Apri Docker Desktop almeno una volta dopo l'installazione perché il demone parta

> Su Windows Home Docker Desktop richiede WSL 2. Se non lo hai, l'installer ti guida.

### Memoria allocata a Docker

Apri Docker Desktop → Settings → Resources → Advanced. Verifica almeno **4 GB di RAM** allocati. MySQL gira tranquillo con 1 GB ma l'overhead di Docker su Windows è notevole, meglio essere generosi.

---

## Stato attuale del repository

Quello che ho già preparato per te in questa fase:

- `docker-compose.yml` — con MySQL 8 e Adminer
- `.env.example` — template completo delle variabili d'ambiente
- `packages/database/` — pacchetto con schema Prisma e client
  - `package.json`
  - `tsconfig.json`
  - `prisma/schema.prisma` — **lo schema completo del DB** (45+ modelli)
  - `prisma/seed.ts` — popolamento iniziale (admin user, pricing, policy)
  - `src/index.ts` e `src/client.ts` — esport del client Prisma
- aggiornati `package.json` root con script `db:*`, `.gitignore`, `README.md`

Quello che farai tu adesso:

1. Creare il file `.env` reale a partire da `.env.example`
2. Avviare i container Docker
3. Installare le nuove dipendenze del pacchetto `@kansei/database`
4. Generare la prima migrazione e applicarla al DB
5. Eseguire il seed
6. Verificare che il client Prisma sia usabile dalle app

---

## Step 1 · Crea il file `.env`

Da PowerShell, dentro `C:\Users\miche\Kansei Studio Agency`:

```powershell
Copy-Item .env.example .env
```

Apri `.env` con VS Code:

```powershell
code .env
```

Per ora **non modificare nulla**: i valori di default sono già allineati con il `docker-compose.yml`. Verrai a modificare in step successivi le chiavi API quando attiveremo gli agenti.

> Se in futuro committi per sbaglio `.env`, Git lo blocca grazie al `.gitignore` (`.env` è esplicitamente escluso). Sei al sicuro.

---

## Step 2 · Avvia MySQL e Adminer

```powershell
pnpm db:up
```

Questo è uno script che ho aggiunto al `package.json` root. Equivale a `docker compose up -d mysql adminer`. Cosa succede:

1. Docker scarica le immagini `mysql:8.4` e `adminer:4` (~600 MB la prima volta)
2. Crea due container: `kansei-mysql` e `kansei-adminer`
3. MySQL si inizializza (~20-30 secondi la prima volta)
4. Quando il healthcheck di MySQL passa, Adminer parte

Verifica che siano up:

```powershell
docker ps
```

Atteso: due righe, una con `kansei-mysql` (status `Up X seconds (healthy)`), una con `kansei-adminer`.

### Apri Adminer

Vai su <http://localhost:8080>. Vedrai un form di login. Compila così:

- **System:** MySQL
- **Server:** mysql (NB: non `localhost`, perché Adminer parla a MySQL via rete Docker interna)
- **Username:** kansei
- **Password:** kansei_dev_password
- **Database:** kansei_agency

Click su Login. Vedi il database (vuoto, normale: ancora niente tabelle).

### Test connessione da Windows host

Importante verificare che anche il tuo Windows possa parlare a MySQL sulla porta 3307 (è la porta esposta dal container).

```powershell
Test-NetConnection -ComputerName localhost -Port 3307
```

Atteso: `TcpTestSucceeded : True`. Se è `False`, qualcuno sta usando la 3307. Soluzione: stoppa Docker (`pnpm db:down`), modifica nel `docker-compose.yml` il mapping `'3307:3306'` in `'3308:3306'`, aggiorna `DATABASE_URL` in `.env` cambiando `:3307` in `:3308`, e ripeti `pnpm db:up`.

---

## Step 3 · Installa le dipendenze del nuovo pacchetto

Dal root del progetto:

```powershell
pnpm install
```

pnpm vede il nuovo `packages/database/package.json`, scarica `@prisma/client`, `prisma`, `tsx` e li collega. Tempo: 30-90 secondi.

Verifica:

```powershell
pnpm --filter @kansei/database exec prisma --version
```

Atteso: una versione tipo `prisma                  : 5.22.x`.

---

## Step 4 · Formatta lo schema Prisma

Una volta sola, per assicurarsi che lo schema sia ben formattato:

```powershell
pnpm db:format
```

Equivale a `prisma format` lanciato sul package database. Riallinea indentazione, ordina campi, aggiunge import mancanti. Non dovrebbe fare nulla di drammatico (l'ho già scritto formattato), ma è una buona abitudine.

---

## Step 5 · Genera il Prisma Client

```powershell
pnpm db:generate
```

Cosa succede: Prisma legge `schema.prisma`, genera in `node_modules/.prisma/client` un client TypeScript con tipi per tutti i tuoi modelli (User, Client, Project, ecc.). Da questo momento puoi fare `import { PrismaClient } from '@prisma/client'` e ottenere autocompletamento e type-checking completi.

Atteso: `✔ Generated Prisma Client (vX.X.X) to ./node_modules/.prisma/client in Xms`.

> Ogni volta che modifichi `schema.prisma`, devi rilanciare `pnpm db:generate` perché i tipi si rigenerino.

---

## Step 6 · Crea la prima migrazione e applicala al DB

```powershell
pnpm db:migrate
```

Equivale a `prisma migrate dev`. Cosa succede:

1. Prisma confronta lo schema con lo stato attuale del DB (vuoto)
2. Genera un file SQL di migrazione in `packages/database/prisma/migrations/<timestamp>_init/migration.sql`
3. Applica la migrazione al DB
4. Rigenera il Prisma Client automaticamente

Quando ti chiede il **nome della migrazione**, scrivi:

```
init
```

E premi Invio.

Atteso (estratto):

```
✔ Generated Prisma Client (vX.X.X) to ./node_modules/.prisma/client in Xms
The following migration(s) have been created and applied:
  20260508120000_init/
    └─ migration.sql
Already in sync, no schema change or pending migration was found.
```

### Verifica in Adminer

Torna su <http://localhost:8080>, ricarica la pagina. Adesso vedi la lista delle tabelle: `users`, `clients`, `projects`, `briefs`, `quotes`, `quote_items`, `agent_runs`, `token_usage`, `pricing_models`, ecc. Sono **tutte le 30+ tabelle** dello schema.

Click su una qualsiasi (es. `pricing_models`): vedi le colonne con i tipi. È vuota, ovvio: non abbiamo ancora seedato.

---

## Step 7 · Esegui il seed

```powershell
pnpm db:seed
```

Cosa fa lo script `prisma/seed.ts`:

- crea l'utente admin `facecchia@kansei-studio.art`
- popola `pricing_models` con i prezzi attuali di Anthropic, OpenAI, Google (snapshot maggio 2026)
- crea le 8 `approval_policies` (tutte con `automatic = false`, V1)
- inserisce 4 servizi placeholder in `services_catalog` (LOGO_BASIC, IMAGE_PACK_3, VIDEO_REEL_15, SOCIAL_PLAN_MONTH)

Atteso:

```
🌱 Seed avviato...
  ✓ Admin user: facecchia@kansei-studio.art
  ✓ Pricing models: 6 entries
  ✓ Approval policies: 8 entries (tutte manuali)
  ✓ Service catalog: 4 placeholder
🌱 Seed completato.
```

### Verifica in Adminer

Ricarica Adminer. Click su `users` → Select data: vedi il record di Michele. Idem per `pricing_models`, `approval_policies`, `services_catalog`.

---

## Step 8 · Esplora con Prisma Studio

Una UI alternativa, più "Prisma-native":

```powershell
pnpm db:studio
```

Apre <http://localhost:5555> nel browser. Interfaccia tipo Notion: ogni modello è una scheda, click sulla riga per editare, modifiche salvate al volo. Bellissima per inserire/modificare dati di test in dev. **Non usare in produzione**.

`Ctrl+C` per stoppare.

---

## Step 9 · Testa il client da `apps/admin`

Verifichiamo che le app Next.js possano importare e usare il client.

### Aggiungi `@kansei/database` come dipendenza di admin

Apri `apps/admin/package.json` e aggiungi questa entry sotto `"dependencies"` (accanto a `"@kansei/shared"`):

```json
"@kansei/database": "workspace:*",
```

Riallinea:

```powershell
pnpm install
```

### Verifica con un test minimo

Apri `apps/admin/src/app/page.tsx` e sostituisci tutto il contenuto con:

```tsx
import type { Locale, ProjectStatus, ProjectType } from '@kansei/shared';
import { prisma } from '@kansei/database';

// Componenti server-side di Next.js possono essere async e fare query DB
// direttamente. Niente API route necessaria per queste letture base.
export default async function Home() {
  const locale: Locale = 'it';
  const status: ProjectStatus = 'in_attesa_approvazione_admin';
  const type: ProjectType = 'one_shot';

  // Query reali al DB
  const userCount = await prisma.user.count();
  const pricingCount = await prisma.pricingModel.count();
  const servicesCount = await prisma.serviceCatalog.count();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-12 font-sans dark:bg-black">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Kansei-Studio Agency
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dashboard Admin
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Test integrazione <code>@kansei/shared</code> + <code>@kansei/database</code>.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card label="Locale" value={locale} />
          <Card label="Project status" value={status} />
          <Card label="Project type" value={type} />
          <Card label="DB · users" value={String(userCount)} />
          <Card label="DB · pricing" value={String(pricingCount)} />
          <Card label="DB · services" value={String(servicesCount)} />
        </dl>

        <p className="mt-8 text-sm text-zinc-500">
          Se vedi numeri reali nelle tre card &quot;DB ·&quot; il monorepo, lo schema, le migrazioni
          e il seed funzionano end-to-end.
        </p>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </dd>
    </div>
  );
}
```

### Avvia admin e verifica

```powershell
pnpm --filter @kansei/admin dev
```

Apri <http://localhost:3000>. Vedi sei card. Le ultime tre dovrebbero mostrare:

- **DB · users:** `1`
- **DB · pricing:** `6`
- **DB · services:** `4`

Se i numeri sono questi, **tutto è cablato correttamente end-to-end**: schema → migrazione → seed → client → import → render in Next.js.

Stoppa con `Ctrl+C`.

---

## Step 10 · Type-check e commit

```powershell
pnpm type-check
```

Atteso: 4 pacchetti, tutti `successful` (admin, client, shared, database).

Format e commit:

```powershell
pnpm format
git add .
git commit -m "feat(db): schema completo MySQL + Prisma + seed iniziale"
git push
```

---

## Comandi utili che userai spesso

| Comando                  | Cosa fa                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `pnpm db:up`             | Avvia MySQL e Adminer                                         |
| `pnpm db:down`           | Stoppa i container (i dati restano nel volume)                |
| `pnpm db:reset`          | Distrugge i container **e i volumi**, ricrea tutto vuoto      |
| `pnpm db:generate`       | Rigenera il Prisma Client dai tipi                            |
| `pnpm db:migrate`        | Crea e applica una nuova migrazione (dev)                     |
| `pnpm db:migrate:deploy` | Applica le migrazioni esistenti senza crearne di nuove (prod) |
| `pnpm db:studio`         | Apre Prisma Studio su `:5555`                                 |
| `pnpm db:seed`           | Esegue lo script di seed                                      |
| `pnpm db:format`         | Formatta `schema.prisma`                                      |

### Workflow tipico quando modifichi lo schema

1. Modifica `packages/database/prisma/schema.prisma` (aggiungi/modifichi un campo)
2. `pnpm db:format` (opzionale ma raccomandato)
3. `pnpm db:migrate` → ti chiede un nome per la migrazione → genera SQL e applica al DB
4. I tipi sono già aggiornati automaticamente, le app Next.js li vedono al primo reload

---

## Troubleshooting

**`docker compose version` non risponde**
Docker Desktop non è avviato. Aprilo dall'icona nel menu Start, aspetta 30 secondi, riprova.

**MySQL non parte: `Error response from daemon: ports are not available`**
Hai un altro MySQL già in ascolto sulla 3307 (raro ma possibile). Stoppa il container, cambia la porta nel `docker-compose.yml` (es. 3308), aggiorna `DATABASE_URL` in `.env`, riprova.

**`pnpm db:migrate` fallisce con `P1001: Can't reach database server`**
MySQL non è ancora pronto. Verifica `docker ps` che lo status sia `(healthy)`. Se è ancora `(starting)` aspetta 30 secondi e riprova.

**`pnpm db:migrate` chiede di "drift"**
Hai modificato lo schema senza generare migrazione, oppure qualcuno ha toccato il DB a mano. Per resettare in dev: `pnpm db:reset` (distrugge e ricrea), poi `pnpm db:migrate` con nome `init`, poi `pnpm db:seed`.

**Errore TS in admin: `Cannot find module '@kansei/database'`**
Manca la dipendenza `"@kansei/database": "workspace:*"` in `apps/admin/package.json`. Aggiungila e rilancia `pnpm install`.

**`pnpm db:up` lentissimo la prima volta**
Normale: scarica ~600 MB di immagini Docker. Le successive volte è istantaneo perché le immagini sono già in cache.

**Adminer dice "Connection refused"**
Probabilmente hai messo `localhost` come Server invece di `mysql`. Adminer è dentro la rete Docker, deve usare il nome del servizio.

**Voglio cancellare TUTTO il DB e ripartire da zero**

```powershell
pnpm db:reset
pnpm db:migrate
# nome: init
pnpm db:seed
```

Sono 30 secondi.

---

## Cosa abbiamo raggiunto

- Database MySQL 8 funzionante in container Docker, con UI Adminer su `:8080`
- Schema Prisma completo con 30+ modelli e 15 enum (clienti, progetti, brief, preventivi, deliverable, agent runs, token usage, fatture, approvazioni, blocchi, ecc.)
- Migrazione iniziale generata e applicata
- Seed di base (admin, pricing models, approval policies, service catalog placeholder)
- Pacchetto `@kansei/database` riusabile da entrambe le app Next.js
- Test end-to-end funzionante: la dashboard admin legge il DB e mostra i conteggi

---

## Prossimo step

**Setup 03 — Storage astratto + Auth.** Implementeremo l'interfaccia `StorageProvider` con backend filesystem locale e stub S3, configureremo NextAuth con ruoli admin/client, e cabliamo l'upload file. Quando hai validato che questo step funziona dimmelo: parto con la scrittura del Setup 03.
