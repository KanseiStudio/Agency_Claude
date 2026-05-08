# Setup 01 — Scaffolding del monorepo

> Step 1 dello Sprint 0 della roadmap.
> Obiettivo: avere un monorepo funzionante con due app Next.js (admin + client) e un pacchetto condiviso, gestito con **pnpm workspaces** + **Turborepo**.

Questa guida è scritta per essere seguita riga per riga. Ogni comando è spiegato. Ogni file è motivato. Quando finisci, dovresti avere un'app web che parte in localhost e una solida base su cui costruire tutto il resto.

---

## Cosa stiamo costruendo, in una frase

Un singolo repository (un singolo `git` repo) che contiene **due applicazioni Next.js separate** (una per te admin, una per il cliente) e un **pacchetto di codice condiviso** che entrambe usano. Tutto viene gestito da un singolo `pnpm install`, e build/dev/test partono con un singolo comando grazie a Turborepo.

### Perché monorepo

- Tipi TypeScript condivisi: se cambio lo schema di un agente in un punto, entrambe le app lo vedono subito.
- Una sola pipeline CI/CD.
- Una sola lista di dipendenze, niente versioni divergenti tra le due app.
- Refactor cross-app indolori.

### Perché pnpm e non npm

- È **molto più veloce** (link simbolici invece di copie).
- Risparmia spazio su disco grosso modo del 50-80% sui monorepo.
- Ha un supporto nativo per i workspace (pnpm-workspace.yaml).
- Ha una gestione delle peer dependencies più rigorosa: ti accorgi prima di problemi di versioni.

### Perché Turborepo

- Esegue task (build, dev, lint, type-check) **in parallelo** su tutti i pacchetti.
- Ha cache intelligente: se ricompili e nulla è cambiato in `packages/shared`, salta. Su una build di sviluppo questo significa dai 30 secondi ai 5 minuti risparmiati.
- È fatto da Vercel (gli stessi di Next.js), si integra benissimo.

---

## Prerequisiti

Prima di tutto verifica di avere installato sulla tua macchina i tool di base.

### 1. Node.js 20 LTS

Apri il terminale (su Windows: PowerShell o terminale di Visual Studio Code) e lancia:

```bash
node -v
```

Atteso: una stringa che inizia con `v20.` (per esempio `v20.18.1`). Se non hai Node, oppure hai una versione diversa:

- **Windows:** scarica l'installer da <https://nodejs.org/> (versione LTS) e installa.
- **macOS/Linux:** consiglio `nvm` (Node Version Manager) — `nvm install 20 && nvm use 20`.

Verifica anche:

```bash
npm -v
```

Atteso: `10.x.x`.

### 2. pnpm 9

Installa pnpm globalmente. Da terminale:

```bash
npm install -g pnpm@9
```

Verifica:

```bash
pnpm -v
```

Atteso: `9.x.x` (idealmente `9.12.x`).

> Su Windows pnpm a volte richiede di abilitare l'esecuzione degli script PowerShell. Se al primo `pnpm` ricevi un errore di policy, esegui PowerShell come amministratore e lancia: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

### 3. Git

```bash
git --version
```

Atteso: una qualsiasi versione recente (`2.40+` va benissimo). Se manca:

- Windows: <https://git-scm.com/>
- macOS: viene già con gli Xcode Command Line Tools (`xcode-select --install`).
- Linux: `sudo apt install git` o equivalente.

### 4. Editor

Consigliato: **Visual Studio Code** con queste estensioni installate:

- ESLint
- Prettier — Code formatter
- EditorConfig for VS Code
- Prisma (la useremo dal prossimo step)
- Tailwind CSS IntelliSense (la useremo dal frontend)

---

## Stato attuale della cartella

Sei già nella cartella di progetto a `C:\Users\miche\Kansei Studio Agency`. Al momento contiene:

- `ROADMAP.md` — la roadmap completa
- `SETUP-01-monorepo.md` — questa guida
- `README.md` — il README del progetto
- `.gitignore`, `.editorconfig`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`
- `package.json` — root del monorepo
- `pnpm-workspace.yaml` — definizione dei workspace
- `turbo.json` — configurazione Turborepo
- `tsconfig.base.json` — TypeScript config condiviso
- `packages/shared/` — pacchetto condiviso con tipi e interfacce agenti

Quello che manca (e che costruiamo insieme adesso):

- Inizializzazione `git`
- Installazione delle dipendenze
- Le due app Next.js (`apps/admin` e `apps/client`)
- Verifica che tutto funzioni

---

## Step 1 — Inizializza Git e fai il primo commit di scaffolding

Apri il terminale **dentro la cartella del progetto**.

Su Windows con VS Code: apri la cartella `Kansei Studio Agency` con VS Code e poi `Terminale → Nuovo Terminale`. Il terminale si apre già nel percorso giusto.

Lancia:

```bash
git init
```

Cosa fa: crea la cartella `.git/` invisibile dove Git tiene la storia del progetto. Da questo momento la cartella è un repository.

Imposta il nome del branch principale a `main` (convenzione moderna, vecchi repo usavano `master`):

```bash
git branch -m main
```

Verifica che `git status` veda i file che abbiamo già creato:

```bash
git status
```

Dovresti vedere una lista di file "Untracked" tra cui `ROADMAP.md`, `package.json`, `turbo.json`, ecc. **Non** `node_modules/` perché lo escludiamo via `.gitignore`.

Fai il primo commit:

```bash
git add .
git commit -m "chore: monorepo scaffolding (turbo + pnpm workspaces + shared package)"
```

> Se Git ti chiede di configurare nome ed email, lancia:
>
> ```bash
> git config --global user.name "Michele Facecchia"
> git config --global user.email "facecchia@kansei-studio.art"
> ```

---

## Step 2 — Capire cosa c'è in ognuno dei file root

Prima di installare qualunque cosa ti spiego file per file il "perché" di quello che hai sotto mano. Conoscere queste configurazioni ti permetterà di modificarle in autonomia in futuro.

### `package.json` (root)

È il file più importante. Definisce il monorepo come un singolo pacchetto privato che orchestra gli altri.

Punti chiave:

- `"private": true` — non pubblicheremo mai il root su npm.
- `"packageManager": "pnpm@9.12.3"` — costringe chi usa il repo a usare la versione corretta di pnpm.
- `"engines"` — dichiara la versione minima di Node e pnpm. Errore visibile se qualcuno prova ad usare versioni diverse.
- `"scripts"` — comandi proxy verso Turborepo. Quando lanci `pnpm dev` da qui, Turbo orchestra il `dev` di tutti i pacchetti che hanno quello script.
- `"devDependencies"` — solo i tool che servono al monorepo nel suo insieme: prettier (formattazione), turbo (orchestratore), typescript, rimraf (per il `clean` cross-platform).

### `pnpm-workspace.yaml`

Una sola informazione: "i miei sotto-pacchetti vivono in `apps/*` e `packages/*`". pnpm li tratterà come pacchetti collegabili tra loro tramite link simbolici. Esempio: `apps/admin` può importare `@kansei/shared` come se fosse pubblicato su npm, ma in realtà sono entrambi nel tuo repo.

### `turbo.json`

Definisce le "task" che Turborepo sa orchestrare. Le importanti:

- `build` — `dependsOn: ["^build"]` significa "prima di buildare un pacchetto, builda tutti quelli da cui dipende". `outputs` dice a Turbo cosa cachare.
- `dev` — `cache: false` (non cacchiamo il dev), `persistent: true` (è un processo che resta in piedi).
- `type-check` — eseguire `tsc --noEmit` su ogni pacchetto.

### `tsconfig.base.json`

Configurazione TypeScript di base, ereditata da ogni pacchetto del monorepo. Le opzioni qui sono "rigide ma sensate":

- `strict: true` + `noUncheckedIndexedAccess: true` — niente accessi tipo `array[0]` che ti danno `T` invece di `T | undefined`. Ti salva da NPE.
- `moduleResolution: "Bundler"` — la risoluzione moderna usata da Next.js, Vite, Bun.
- `incremental: true` — type-check più veloci grazie alla cache.

### `.editorconfig`, `.prettierrc.json`, `.prettierignore`

Regole di stile. Quando un altro sviluppatore (o tu su un altro PC) apre un file, l'editor rispetta automaticamente queste regole. Prettier formatta il codice in modo consistente quando salvi (con l'estensione VS Code installata) o quando lanci `pnpm format`.

### `.gitignore`

Lista delle cose che Git deve ignorare. Le categorie principali:

- dipendenze (`node_modules/`)
- output di build (`.next/`, `dist/`, ecc.)
- cache Turbo (`.turbo/`)
- file di ambiente (`.env`) — **mai** committare segreti
- storage locale dei file caricati dai clienti
- file IDE personali

### `.nvmrc`

Solo `20`. Se usi `nvm`, basta lanciare `nvm use` nella cartella e ti porta automaticamente a Node 20.

---

## Step 3 — Installazione dipendenze

Adesso facciamo scaricare a pnpm tutto quello che serve.

```bash
pnpm install
```

Cosa succede:

1. pnpm legge `package.json` (root) e tutti i `package.json` dei workspace dichiarati in `pnpm-workspace.yaml`.
2. Risolve le dipendenze di tutti i pacchetti, calcola un albero unificato, lo scrive in `pnpm-lock.yaml`.
3. Crea `node_modules/` al root con i pacchetti reali, e in ogni sotto-cartella crea `node_modules/` "virtuali" pieni di link simbolici.

Ti aspetti questo output (semplificato):

```
Lockfile is up to date, resolution step is skipped
Progress: resolved X, reused Y, downloaded Z, added W
Done in N seconds
```

Se vedi warning sulle peer dependencies, ignorali per ora (sono normali).

Verifica:

```bash
ls node_modules
```

Dovresti vedere cartelle come `.pnpm`, `turbo`, `prettier`, `typescript`. Se le vedi, è andata.

---

## Step 4 — Verifica il pacchetto shared

Prima di scaffoldare le app Next.js, assicuriamoci che il pacchetto condiviso compili.

```bash
cd packages/shared
pnpm type-check
cd ../..
```

`type-check` esegue `tsc --noEmit`. Se ti restituisce zero output, è perfetto: significa che TypeScript non ha trovato errori. Se ti dice "Cannot find module 'zod'", esegui `pnpm install` di nuovo dal root.

Tornando al root:

```bash
pnpm type-check
```

Turborepo esegue il `type-check` su tutti i pacchetti. Al momento c'è solo `shared`, quindi vedrai un solo output. Bonus: la prossima volta che lanci `pnpm type-check` senza modifiche, Turbo userà la cache e sarà istantaneo.

---

## Step 5 — Crea l'app admin (dashboard per Michele)

Adesso scaffoldiamo la prima app Next.js. Dal root del progetto:

```bash
pnpm dlx create-next-app@latest apps/admin --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-pnpm
```

Spiegazione bandiera per bandiera:

- `pnpm dlx create-next-app@latest` — esegue il tool ufficiale Next.js senza installarlo globalmente
- `apps/admin` — la cartella di destinazione
- `--typescript` — TypeScript invece di JavaScript
- `--tailwind` — preconfigura Tailwind CSS
- `--app` — usa il moderno App Router (la modalità su cui costruiremo)
- `--src-dir` — codice in `src/` invece che alla root della app (più pulito)
- `--import-alias "@/*"` — `@/components/...` invece dei path relativi orribili
- `--no-eslint` — saltiamo per ora, configureremo ESLint a livello monorepo nel prossimo setup
- `--use-pnpm` — usa pnpm invece di npm

Durante lo scaffolding `create-next-app` chiederà se vuoi usare Turbopack: rispondi **Yes** (è il bundler veloce di Next.js, default ormai).

Risultato: la cartella `apps/admin` viene creata con la struttura Next.js standard.

### Aggiusta il package.json di apps/admin

Per integrarlo bene nel monorepo, apri `apps/admin/package.json` e fai due modifiche.

1. Cambia il nome del pacchetto in `@kansei/admin`:

   ```json
   "name": "@kansei/admin",
   ```

2. Aggiungi la dipendenza al pacchetto condiviso (sezione `dependencies`):

   ```json
   "@kansei/shared": "workspace:*",
   ```

3. Aggiungi lo script `type-check` (sezione `scripts`):
   ```json
   "type-check": "tsc --noEmit"
   ```

Salva.

Riallinea le dipendenze:

```bash
pnpm install
```

> `workspace:*` è la sintassi pnpm che dice "prendi questo pacchetto dal workspace locale, non da npm". Funziona con qualunque versione locale.

### Verifica che l'app admin parta

Dal root:

```bash
pnpm --filter @kansei/admin dev
```

Dopo qualche secondo dovresti vedere:

```
  ▲ Next.js 15.x.x (Turbopack)
  - Local:        http://localhost:3000
  - Ready in Xms
```

Apri il browser su <http://localhost:3000> — vedi la pagina di benvenuto di Next.js. Vuol dire che funziona.

Stoppa con `Ctrl+C` nel terminale.

---

## Step 6 — Crea l'app client (portale clienti)

Stesso scaffolding, cartella diversa:

```bash
pnpm dlx create-next-app@latest apps/client --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-pnpm
```

Anche qui scegli **Yes** per Turbopack.

Apri `apps/client/package.json` e applica le stesse tre modifiche di prima:

1. `"name": "@kansei/client"`
2. Aggiungi `"@kansei/shared": "workspace:*"` in `dependencies`.
3. Aggiungi `"type-check": "tsc --noEmit"` in `scripts`.

C'è un dettaglio in più: le due app Next.js useranno entrambe la porta 3000 di default, quindi l'app client deve usare un'altra porta. Modifica i suoi script `dev` e `start`:

```json
"scripts": {
  "dev": "next dev --port 3001 --turbopack",
  "build": "next build",
  "start": "next start --port 3001",
  "lint": "echo 'lint placeholder'",
  "type-check": "tsc --noEmit"
}
```

L'admin gira su `:3000`, il client su `:3001`. Niente conflitti.

Riallinea:

```bash
pnpm install
```

Verifica che parta:

```bash
pnpm --filter @kansei/client dev
```

Apri <http://localhost:3001>. Stessa pagina di benvenuto, conferma che è OK. Stoppa con `Ctrl+C`.

---

## Step 7 — Avvia tutto insieme con Turborepo

Il bello viene adesso. Dal root:

```bash
pnpm dev
```

Turbo lancia in parallelo `dev` su entrambe le app. Vedi i log delle due app intercalati. Apri sia <http://localhost:3000> che <http://localhost:3001>: entrambe rispondono.

Stoppa con `Ctrl+C` (Turbo killa tutti i processi figli in modo pulito).

---

## Step 8 — Verifica che il pacchetto shared sia importabile

Per essere sicuri che il link tra le app e `@kansei/shared` funzioni, facciamo un test minimo.

Apri (o crea) `apps/admin/src/app/page.tsx`. Per default `create-next-app` ci ha messo un homepage di default; sostituisci il contenuto del file con:

```tsx
import type { Locale, ProjectStatus } from '@kansei/shared';

export default function Home() {
  const locale: Locale = 'it';
  const status: ProjectStatus = 'in_attesa_approvazione_admin';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Kansei-Studio · Admin</h1>
      <p className="mt-4 text-lg">
        Locale: <strong>{locale}</strong> · Stato di esempio: <strong>{status}</strong>
      </p>
      <p className="mt-2 text-sm text-gray-500">
        Se vedi questa pagina e i tipi sopra non causano errori, il monorepo è cablato
        correttamente.
      </p>
    </main>
  );
}
```

Salva, lancia `pnpm dev` dal root, apri <http://localhost:3000>.

Devi vedere il titolo "Kansei-Studio · Admin" e il testo. Se TypeScript dovesse darti un errore di "module not found", esegui `pnpm install` di nuovo. Se l'errore persiste, manca probabilmente `"@kansei/shared": "workspace:*"` nelle dipendenze di `apps/admin/package.json`.

Stoppa con `Ctrl+C`.

---

## Step 9 — Type-check e format dell'intero monorepo

Adesso che ci sono tutti i pacchetti, lancia il type-check globale:

```bash
pnpm type-check
```

Turbo esegue il type-check di `shared`, `admin`, `client` in parallelo. Tempo: 5-15 secondi alla prima esecuzione, istantaneo alle successive grazie alla cache.

Se passa senza errori, è tutto a posto.

Formatta tutto il codice con Prettier:

```bash
pnpm format
```

Verifica il formato:

```bash
pnpm format:check
```

Atteso: `All matched files use Prettier code style!`.

---

## Step 10 — Secondo commit

Conserviamo il lavoro fatto:

```bash
git add .
git commit -m "feat: scaffold apps/admin e apps/client (Next.js 15 + Tailwind + App Router)"
```

A questo punto la storia git è:

```
* feat: scaffold apps/admin e apps/client (Next.js 15 + Tailwind + App Router)
* chore: monorepo scaffolding (turbo + pnpm workspaces + shared package)
```

---

## Cosa abbiamo raggiunto

Riepilogo dello stato del progetto al termine di questo step:

- Repository Git inizializzato e con due commit puliti.
- Monorepo pnpm + Turborepo funzionante.
- Due app Next.js 15 (App Router + Tailwind + TypeScript) operative su porte separate.
- Pacchetto condiviso `@kansei/shared` con tipi base e interfaccia `AgentDefinition`.
- TypeScript strict mode, type-check parallelo cross-pacchetto.
- Prettier configurato e funzionante.
- File di ambiente, `.gitignore`, editor config tutti a posto.

```
kansei-studio-agency/
├── apps/
│   ├── admin/              # Next.js 15, port 3000  ← @kansei/admin
│   │   ├── src/app/
│   │   ├── package.json
│   │   └── ...
│   └── client/             # Next.js 15, port 3001  ← @kansei/client
│       └── ...
├── packages/
│   └── shared/             # @kansei/shared
│       ├── src/
│       │   ├── agents/types.ts
│       │   ├── types/index.ts
│       │   └── index.ts
│       └── package.json
├── package.json            # root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── ROADMAP.md
├── SETUP-01-monorepo.md
└── README.md
```

---

## Comandi utili che userai spesso

| Comando                                   | Cosa fa                                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                                | Avvia tutte le app in dev mode (admin :3000, client :3001) |
| `pnpm build`                              | Build di produzione di tutte le app                        |
| `pnpm type-check`                         | Type-check su tutto il monorepo                            |
| `pnpm format`                             | Formatta tutto il codice con Prettier                      |
| `pnpm format:check`                       | Verifica solo il formato senza modificare                  |
| `pnpm --filter @kansei/admin dev`         | Avvia solo l'app admin                                     |
| `pnpm --filter @kansei/client dev`        | Avvia solo l'app client                                    |
| `pnpm --filter @kansei/shared type-check` | Type-check solo del pacchetto shared                       |
| `pnpm install`                            | Reinstalla/aggiorna le dipendenze                          |
| `pnpm clean`                              | Pulisce le cartelle dist/.turbo/.next                      |

---

## Troubleshooting comune

**`pnpm install` molto lento la prima volta**
Normale: scarica circa 500 MB di pacchetti. Le successive sono nell'ordine dei secondi.

**Errore "EACCES: permission denied" su Windows**
Esegui PowerShell come amministratore una volta sola e lancia `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

**`port 3000 already in use`**
Hai un altro processo Node sulla 3000 (forse un dev server di un altro progetto). Killalo o cambia la porta dell'admin nello script `dev`.

**Type-check fallisce con "Cannot find module '@kansei/shared'"**
Manca la dipendenza `"@kansei/shared": "workspace:*"` nel `package.json` dell'app. Aggiungila e rilancia `pnpm install`.

**Turbo non parte: "command not found"**
Esegui di nuovo `pnpm install` al root. Turbo viene installato come devDependency del root.

**`error TS2688: Cannot find type definition file for 'node'`**
Il `tsconfig.json` di un pacchetto richiede esplicitamente `@types/node` ma non è installato. Soluzione corretta: **non** dichiarare `"types": ["node"]` in pacchetti come `shared` che devono restare isomorfici (utilizzabili sia server-side che browser-side). I tipi Node vanno usati solo in pacchetti server-only, dove vanno installati con `pnpm add -D @types/node`.

**Ho fatto casino, voglio ripartire**
Dal root:

```bash
pnpm clean
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

(Su Windows PowerShell sostituisci `rm -rf` con `Remove-Item -Recurse -Force`.)

---

## Prossimo step

**Setup 02 — Database MySQL + Prisma.** Definiremo lo schema completo (clienti, progetti, briefs, preventivi, deliverable, agent_runs, token_usage, ecc.) e configureremo Prisma come ORM condiviso fra le due app. Quando hai validato che questo step funziona dimmelo: parto con la scrittura della guida 02 e dello schema.
