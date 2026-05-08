# Setup 04 — Storage astratto + Auth client portal

> Step 4 dello Sprint 0.
> Obiettivo: avere un'astrazione storage che funziona oggi su filesystem locale e domani su S3 senza refactor, e il portale cliente con login funzionante (mirror dell'admin) per Cliente Demo.

---

## Cosa stiamo costruendo

### A. Pacchetto `@kansei/storage`

Un'interfaccia `StorageProvider` con due implementazioni intercambiabili:

- **`LocalFsProvider`** (default in dev): scrive/legge file dal filesystem in `./storage/`. Pronto per essere usato da Next.js, n8n, script di seed.
- **`S3Provider`** (stub): metodi che lanciano "not implemented". L'implementazione reale arriverà quando passeremo il deployment in produzione.

Il selettore avviene via env `STORAGE_PROVIDER=local|s3`. **Nessun consumer del codice sa quale backend è attivo:** parla solo con l'interfaccia. Domani, quando swappi `local` con `s3`, niente cambia nel codice di business.

### B. Auth completa nel client portal

Stesso pattern di Setup 03 ma applicato a `apps/client`:

- istanza NextAuth con role check `client`
- middleware che protegge tutte le rotte tranne `/login`
- pagina `/login` con form
- home aggiornata con info sessione, conteggio progetti del cliente, bottone logout

### C. Demo Client + User nel seed

Il seed adesso crea anche:

- **`Cliente Demo S.r.l.`** come `Client` in DB
- **`cliente.demo@example.com`** come `User` con role `client` collegato al Client demo

Così puoi testare il login lato cliente senza dover prima costruire il flusso di registrazione (lo faremo nello Setup 05).

---

## Stato preparato per te

**Nuovo pacchetto `packages/storage/`:**

- `package.json`, `tsconfig.json`
- `src/types.ts` — interfaccia `StorageProvider`
- `src/local.ts` — `LocalFsProvider` (filesystem)
- `src/s3.ts` — `S3Provider` (stub)
- `src/factory.ts` — `getStorage()` singleton basato su env
- `src/index.ts` — entry point

**Client app:**

- `src/auth.ts` — istanza NextAuth con role `client`
- `src/next-auth.d.ts` — estensione tipi
- `src/middleware.ts` — protezione rotte
- `src/app/api/auth/[...nextauth]/route.ts` — handler
- `src/app/login/page.tsx` + `login-form.tsx` + `actions.ts`
- `src/app/page.tsx` — aggiornata con sessione + conteggio progetti
- `package.json` — aggiunte deps (`next-auth`, `@kansei/auth`, `@kansei/database`, `@kansei/storage`)
- `next.config.ts` — `transpilePackages` aggiornato

**Admin app:**

- `src/app/page.tsx` — aggiunta card "Storage attivo" che mostra provider e root
- `package.json` + `next.config.ts` — `@kansei/storage` aggiunto

**Database:**

- `prisma/seed.ts` — aggiunto Cliente Demo + utente collegato

**Env:**

- `.env.example` — aggiunta `DEV_CLIENT_PASSWORD`

---

## Step 1 · Aggiorna `.env`

Apri `.env` e aggiungi (se non c'è già):

```env
DEV_CLIENT_PASSWORD=cliente-dev-2026!
```

> Le altre variabili storage (`STORAGE_PROVIDER=local`, `STORAGE_LOCAL_ROOT=./storage`) sono già nel tuo `.env` dal Setup 02. Verifica che ci siano. Se mancano, copiale dal `.env.example`.

---

## Step 2 · Installa le nuove dipendenze

```powershell
pnpm install
```

Atteso: pnpm vede il nuovo `packages/storage/` e le nuove dipendenze su `apps/client` (next-auth, kansei/\*). Tempo: 10-30 secondi.

---

## Step 3 · Re-esegui il seed

Per creare il cliente demo:

```powershell
pnpm db:seed
```

Atteso (nuovo nei log):

```
🌱 Seed avviato...
  ✓ Admin user: facecchia@kansei-studio.art (password: kansei-dev-2026!)
  ✓ Demo client user: cliente.demo@example.com (password: cliente-dev-2026!)
  ✓ Demo client company: Cliente Demo S.r.l.
  ✓ Pricing models: 6 entries
  ...
```

### Verifica in Adminer

<http://localhost:8080> → tabella `users` → adesso vedi 2 righe: Michele (admin) e Cliente Demo (client).

Tabella `clients` → 1 riga: `Cliente Demo S.r.l.`.

---

## Step 4 · Type-check globale

```powershell
pnpm type-check
```

Atteso: 6 pacchetti `successful` (`shared`, `database`, `auth`, `storage`, `admin`, `client`).

---

## Step 5 · Verifica admin invariato + storage card

```powershell
pnpm --filter @kansei/admin dev
```

Apri <http://localhost:3000>, fai login (`facecchia@kansei-studio.art` / `kansei-dev-2026!`).

Atteso, oltre a quello che già vedevi: **una nuova sezione "Storage attivo"** con due card:

- **provider:** `local`
- **root:** `./storage`

Stoppa con `Ctrl+C`.

---

## Step 6 · Test completo del client portal

```powershell
pnpm --filter @kansei/client dev
```

Apri <http://localhost:3001>.

### Test 1 · Redirect a login

Atteso: redirect automatico a <http://localhost:3001/login?callbackUrl=%2F>.

### Test 2 · Admin NON può loggarsi nel portale cliente

Prova a entrare con le credenziali di Michele (admin):

- Email: `facecchia@kansei-studio.art`
- Password: `kansei-dev-2026!`

Atteso: `Credenziali non valide.` Il role check fallisce (un admin non può loggarsi nel client portal). Questa è una **garanzia di sicurezza**: anche se un attaccante prendesse le credenziali admin, non avrebbe accesso al portale cliente o viceversa.

### Test 3 · Login con cliente demo

- Email: `cliente.demo@example.com`
- Password: `cliente-dev-2026!`

Atteso: redirect a `/`. Vedi:

- titolo **Area Cliente**
- "Loggato come **cliente.demo@example.com** · ruolo **client**"
- card **I tuoi progetti: 0** (ovvio, non ne hai ancora)
- pill list dei provider AI
- bottone **Esci**

### Test 4 · Logout

Click **Esci**. Redirect a `/login`. Riprovando ad andare a `/` ti rimanda di nuovo a login.

### Test 5 · Le due app non si calpestano

Mentre il client portal gira su `:3001`, prova ad aprire <http://localhost:3000>: l'admin (se è in dev) ti chiede ancora il login admin separato. **Le sessioni sono completamente isolate** perché vivono su domini/porte diverse e ogni app ha il suo cookie.

---

## Step 7 · Lancio in parallelo via Turbo

Stoppa eventuali server attivi. Dal root:

```powershell
pnpm dev
```

Turbo lancia entrambe le app insieme. Apri:

- <http://localhost:3000> → admin login
- <http://localhost:3001> → client login

Funzionano indipendentemente.

---

## Step 8 · Format, commit e push

```powershell
pnpm format
git add .
git commit -m "feat: storage astratto + auth client portal + demo client nel seed"
git push
```

---

## Cosa abbiamo raggiunto

- Pacchetto `@kansei/storage` con `LocalFsProvider` funzionante e `S3Provider` stub. Pronto per le put/get reali nel prossimo step.
- Portale cliente con login funzionante, role check rigoroso, sessione JWT.
- Cliente demo nel DB per i test.
- Card "Storage attivo" nella dashboard admin per debug.

Adesso lo schema è completo: due app autenticate, due ruoli isolati, layer storage astratto, schema DB completo. Manca solo il **flusso applicativo** (creazione progetto, upload brief, preventivo, ecc.), che sarà il Setup 05.

---

## Comandi utili

| Comando                            | Cosa fa                                        |
| ---------------------------------- | ---------------------------------------------- |
| `pnpm dev`                         | Avvia entrambe le app insieme via Turbo        |
| `pnpm --filter @kansei/admin dev`  | Solo admin (`:3000`)                           |
| `pnpm --filter @kansei/client dev` | Solo client (`:3001`)                          |
| `pnpm db:seed`                     | Re-crea Michele + Cliente Demo + dati iniziali |
| `pnpm db:studio`                   | UI Prisma per vedere users e clients           |

---

## Troubleshooting

**Login client con credenziali admin: passa**
Bug serio. Controlla `apps/client/src/auth.ts`: il parametro passato a `authenticateByCredentials` deve essere `'client'`, non `'admin'`. Stessa verifica per `apps/admin/src/auth.ts` (deve essere `'admin'`).

**`Cannot find module '@kansei/storage'`**
Manca la dep in `package.json` o non è stato lanciato `pnpm install`. Aggiungi `"@kansei/storage": "workspace:*"` nelle deps dell'app e re-installa.

**`Module not found: Can't resolve './local'` / `./types`**
`@kansei/storage` non è in `transpilePackages` del `next.config.ts` dell'app. Aggiungilo.

**Errore TS `Property 'name' does not exist on type 'StorageProvider'`**
Hai modificato `types.ts` senza re-esportarlo o hai una vecchia cache. Lancia `pnpm clean && pnpm install`.

**Login cliente: "Credenziali non valide" anche con password corretta**
Il seed non è stato re-eseguito dopo l'introduzione del cliente demo. Lancia `pnpm db:seed`.

**Errore `STORAGE_PROVIDER non riconosciuto`**
Hai messo un valore sbagliato in `.env`. Valori validi: `local` o `s3`.

---

## Prossimo step

**Setup 05 — Primo flusso applicativo: brief intake.** Combineremo tutto quello che abbiamo costruito finora:

- Form per il cliente per inviare un brief con file allegati (auth + storage + DB)
- Coda di approvazione admin in dashboard
- Bottone "Approva" che cambia lo stato del progetto
- Eventi tracciati nella tabella `events`

È il primo flusso end-to-end del modello Kansei. Quando hai validato che tutti i test del Setup 04 passano dimmelo: parto col Setup 05.
