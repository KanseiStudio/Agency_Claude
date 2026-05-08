# Kansei-Studio Agency

Agenzia di comunicazione virtuale AI-driven.

**Stack:** Next.js (TypeScript) · MySQL · Prisma · n8n · Anthropic + OpenAI + Google AI + fal.ai

**Documentazione operativa:**

- [`ROADMAP.md`](./ROADMAP.md) — roadmap completa del progetto, dalle fondamenta agli agenti V2.
- [`SETUP-01-monorepo.md`](./SETUP-01-monorepo.md) — Step 1: setup iniziale del monorepo.
- [`SETUP-02-database.md`](./SETUP-02-database.md) — Step 2: database MySQL + Prisma.
- [`SETUP-03-admin-auth.md`](./SETUP-03-admin-auth.md) — Step 3: autenticazione admin (NextAuth v5).
- [`SETUP-04-storage-and-client-auth.md`](./SETUP-04-storage-and-client-auth.md) — Step 4: storage astratto + autenticazione client portal.
- [`SETUP-05-brief-intake.md`](./SETUP-05-brief-intake.md) — Step 5: primo flusso end-to-end (brief intake + approvazione admin).

## Struttura del repository

```
kansei-studio-agency/
├── apps/
│   ├── admin/         # Dashboard amministratore (Next.js)
│   └── client/        # Portale cliente (Next.js)
├── packages/
│   ├── shared/        # Tipi, schemi, definizioni agenti condivise
│   ├── database/      # Schema Prisma + client DB (MySQL)
│   ├── auth/          # Helper auth condivisi (bcrypt, lookup utente)
│   └── storage/       # StorageProvider (LocalFs + S3 stub)
├── docker-compose.yml # MySQL + Adminer per dev locale
├── package.json       # Root workspace
├── pnpm-workspace.yaml
├── turbo.json         # Configurazione Turborepo (orchestrazione build)
├── tsconfig.base.json # TypeScript config condiviso
├── .editorconfig      # Regole comuni per editor/IDE
├── .prettierrc.json   # Formattazione codice
├── .gitignore
└── .nvmrc             # Versione Node richiesta (20 LTS)
```

## Quick start

```bash
# Verifica versione Node (richiesta: 20 LTS)
node -v

# Installa pnpm globalmente se non presente
npm install -g pnpm@9

# Installa dipendenze (esegui una volta dopo il clone)
pnpm install

# Avvia tutte le app in dev mode
pnpm dev

# Type-check su tutto il monorepo
pnpm type-check

# Format del codice
pnpm format
```

## Stato del progetto

Versione corrente: **0.1.0** — setup iniziale del monorepo (Sprint 0, step 1).

Roadmap dettagliata in `ROADMAP.md`.
