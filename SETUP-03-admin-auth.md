# Setup 03 — Autenticazione admin (NextAuth v5)

> Step 3 dello Sprint 0.
> Obiettivo: avere una pagina di login funzionante per Michele, sessione JWT firmata, middleware che protegge tutta la dashboard admin (qualsiasi rotta, eccetto `/login`, richiede di essere autenticati come `admin`).

---

## Cosa stiamo costruendo, in una frase

Un sistema di autenticazione **email + password** per l'app admin, basato su **Auth.js v5** (l'evoluzione di NextAuth.js), con sessione **JWT** (no DB session, no lookup ad ogni request), un nuovo pacchetto `@kansei/auth` per le utility condivise e un seed che crea Michele con una password reale hashata in bcrypt.

### Perché Auth.js v5 e non v4

- v5 è la versione "App Router-native" di NextAuth: API più pulita (`auth()`, `signIn()`, `signOut()` esportati direttamente)
- nessun bisogno della vecchia coppia `getServerSession` + provider scaffold
- supporto Edge runtime nativo (utile più avanti per il middleware)

### Perché credentials provider e non magic link

- Niente provider mail richiesto in V1 (Resend lo aggiungeremo dopo)
- Login immediato per Michele, niente attesa di email
- Schema utente non richiede modifiche (basta `passwordHash`)

### Perché un pacchetto `@kansei/auth` separato

- Le utility (`hashPassword`, `verifyPassword`, lookup con role check) saranno usate sia da admin che da client app nel Setup 04
- L'istanza NextAuth invece **vive in ogni app** (cartella `src/auth.ts`), perché ogni app ha il suo cookie domain, le sue rotte protette, le sue regole di redirect

---

## Stato preparato per te

Tutti i file sono già scritti:

**Nuovo pacchetto `packages/auth/`:**

- `package.json`, `tsconfig.json`
- `src/index.ts` — esporta API pubblica
- `src/password.ts` — hashPassword / verifyPassword via bcryptjs
- `src/schemas.ts` — schema Zod delle credenziali
- `src/types.ts` — tipi `AuthRole`, `AuthenticatedUser`
- `src/authenticate.ts` — lookup utente + verifica password + check ruolo

**App admin:**

- `src/auth.ts` — istanza NextAuth con Credentials provider + JWT
- `src/next-auth.d.ts` — estensione tipi Session/User
- `src/middleware.ts` — protegge tutte le rotte, esclude `/login`
- `src/app/api/auth/[...nextauth]/route.ts` — handler catch-all
- `src/app/login/page.tsx` — server component
- `src/app/login/login-form.tsx` — form client component
- `src/app/login/actions.ts` — server action `signInAction`
- `src/app/page.tsx` — aggiornata con info sessione + bottone logout
- `next.config.ts` — aggiunto `@kansei/auth` a `transpilePackages`
- `package.json` — aggiunte deps (`next-auth@5`, `@kansei/auth`)

**Database:**

- `prisma/seed.ts` — ora crea Michele con password hashata
- `package.json` — aggiunto `bcryptjs`

**Env:**

- `.env.example` — aggiunti `AUTH_SECRET`, `AUTH_TRUST_HOST`, `DEV_ADMIN_PASSWORD`

---

## Step 1 · Aggiorna `.env`

Apri `C:\Users\miche\Kansei Studio Agency\.env` e aggiungi queste tre righe (cancellando le vecchie `NEXTAUTH_SECRET`/`NEXTAUTH_URL` se presenti):

```env
AUTH_SECRET=<da_generare>
AUTH_TRUST_HOST=true
DEV_ADMIN_PASSWORD=kansei-dev-2026!
```

### Genera l'`AUTH_SECRET`

Da PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Atteso: una stringa base64 di 44 caratteri tipo `aB3+Xy7K...=`. Copiala e incollala come valore di `AUTH_SECRET` nel `.env`.

> Questa è la chiave con cui Next.js firma e cifra i JWT della sessione. Se cambia, tutte le sessioni esistenti diventano invalide. **Non condividerla mai.**

### Conferma `DEV_ADMIN_PASSWORD`

Per dev tieni `kansei-dev-2026!`. È la password che userai per loggarti come Michele.

---

## Step 2 · Installa le nuove dipendenze

```powershell
pnpm install
```

pnpm scarica:

- `next-auth@5` per l'app admin
- `bcryptjs` + `@types/bcryptjs` per `@kansei/auth` e per il seed
- `zod` (già presente) per `@kansei/auth`

Tempo: 30-60 secondi.

Verifica:

```powershell
pnpm --filter @kansei/auth type-check
```

Atteso: nessun errore.

---

## Step 3 · Re-esegui il seed (per impostare la password)

Il seed precedente ha creato Michele con `passwordHash: null`. Adesso il seed aggiornato gli imposta una password vera. Lancialo:

```powershell
pnpm db:seed
```

Atteso (parte rilevante):

```
🌱 Seed avviato...
  ✓ Admin user: facecchia@kansei-studio.art (password: kansei-dev-2026!)
  ✓ Pricing models: 6 entries
  ...
```

Il messaggio mostra in chiaro la password solo a fini di sviluppo, perché il seed gira solo in locale. In produzione la rimuoveremo.

### Verifica in Adminer

<http://localhost:8080> → tabella `users` → Select data → riga di Michele.

Adesso il campo `password_hash` non è più NULL: contiene una stringa che inizia con `$2a$12$...` (l'hash bcrypt). Questo è il valore con cui NextAuth confronterà la password che digiterai al login.

---

## Step 4 · Type-check globale

```powershell
pnpm type-check
```

Atteso: 5 pacchetti `successful` (`shared`, `database`, `auth`, `admin`, `client`).

Se vedi errori, verifica di aver lanciato `pnpm install` dopo le modifiche al `package.json`.

---

## Step 5 · Avvia admin e testa il login

```powershell
pnpm --filter @kansei/admin dev
```

### Test 1 · Accesso a route protetta senza login

Apri <http://localhost:3000>.

Atteso: il middleware ti **redirige automaticamente a `/login`** (vedrai l'URL cambiare a `http://localhost:3000/login?callbackUrl=%2F`).

Se vedi la pagina di login, il middleware funziona.

### Test 2 · Login con credenziali sbagliate

Inserisci nel form:

- Email: `facecchia@kansei-studio.art`
- Password: `pippo`

Click su **Accedi**.

Atteso: messaggio rosso `Credenziali non valide.`. La pagina non cambia.

### Test 3 · Login con credenziali corrette

- Email: `facecchia@kansei-studio.art`
- Password: `kansei-dev-2026!` (o quello che hai messo in `DEV_ADMIN_PASSWORD`)

Click su **Accedi**.

Atteso: redirect alla home `/`. Vedi:

- titolo **Dashboard Admin**
- riga "Loggato come **facecchia@kansei-studio.art** · ruolo **admin**" (in verde)
- pulsante **Esci** in alto a destra
- le solite card con Tipi condivisi e Conteggi DB

### Test 4 · Logout

Click su **Esci**.

Atteso: redirect a `/login`. Se provi a riaprire `/`, ti rimanda di nuovo a `/login`.

### Test 5 · Sessione persistente

Re-fai il login. Chiudi la tab del browser. Riapri <http://localhost:3000>.

Atteso: **non** ti chiede di nuovo le credenziali. La sessione è in un cookie HttpOnly che sopravvive alla chiusura del tab. Per scadere è impostata di default a 30 giorni di inattività.

---

## Step 6 · Type-check finale, format e commit

```powershell
pnpm type-check
pnpm format
git add .
git commit -m "feat(auth): autenticazione admin con NextAuth v5 + Credentials provider"
git push
```

---

## Cosa abbiamo raggiunto

- Pagina `/login` funzionante per l'admin
- Sessione JWT firmata (cookie `authjs.session-token`)
- Middleware che protegge **tutte** le rotte tranne `/login`
- Bottone logout che pulisce la sessione e redirige
- Pacchetto `@kansei/auth` riusabile dal client portal nel Setup 04
- Seed con password hashata bcrypt

Questo è uno dei punti dove "vedere il sistema funzionare" diventa concreto: digiti le credenziali, vai dentro, lavori, esci. Stesso pattern di qualsiasi app SaaS in produzione.

---

## Comandi utili

| Comando                           | Cosa fa                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `pnpm --filter @kansei/admin dev` | Avvia admin con auth attiva                                     |
| `pnpm db:seed`                    | Re-imposta utenti e dati seed (password admin viene re-hashata) |
| `pnpm db:studio`                  | UI Prisma per ispezionare gli utenti                            |

### Generare un nuovo `AUTH_SECRET`

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> Cambiarlo in produzione invalida tutte le sessioni esistenti. In dev non è un problema.

---

## Troubleshooting

**"AUTH_SECRET is not set"**
Manca la variabile in `.env`. Generala col comando node sopra e aggiungila.

**"UntrustedHost" durante login**
Manca `AUTH_TRUST_HOST=true` in `.env`. È necessario perché in dev gli host non sono pre-validati.

**"Credenziali non valide" anche con password corretta**
La password nel DB è ancora quella vecchia (NULL). Re-esegui `pnpm db:seed`.

**Loop infinito di redirect tra `/` e `/login`**
Il middleware non riconosce `/login` come pubblica. Verifica che `PUBLIC_PATHS` in `middleware.ts` includa `'/login'`.

**Errore "Module not found: next-auth"**
Manca `pnpm install` dopo aggiornamento del `package.json`. Lancialo.

**Errore TS su `session.user.role` o `session.user.id`**
Il file `src/next-auth.d.ts` non viene riconosciuto. Verifica che esista in `apps/admin/src/` e che `tsconfig.json` includa `**/*.d.ts` (di default sì).

---

## Prossimo step

**Setup 04 — Storage astratto + Auth client.** Implementeremo:

- Pacchetto `@kansei/storage` con `LocalFsProvider` (filesystem locale) e stub `S3Provider`, swappable via env
- Auth per il portale cliente (`apps/client`) con stesso pattern dell'admin ma role check `client`
- Eventualmente: form di registrazione cliente con creazione `Client` + `User` collegati

Quando hai validato che login/logout/protezione funzionano dimmelo: parto col Setup 04.
