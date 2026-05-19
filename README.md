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
- [`SETUP-06-direttore-operativo.md`](./SETUP-06-direttore-operativo.md) — Step 6: framework agenti + Direttore Operativo (primo agente AI).
- [`SETUP-07-finance-admin.md`](./SETUP-07-finance-admin.md) — Step 7: Finance/Admin agent + flusso preventivo cliente.
- [`SETUP-08-creative-lead.md`](./SETUP-08-creative-lead.md) — Step 8: Creative Lead (concept + brief operativi).
- [`SETUP-09-copy-agent.md`](./SETUP-09-copy-agent.md) — Step 9: Copy Agent (testi con varianti A/B/C).
- [`SETUP-10-art-design.md`](./SETUP-10-art-design.md) — Step 10: Art & Design Agent (art direction + generazione immagini).
- [`SETUP-11-deliverables-revisioni.md`](./SETUP-11-deliverables-revisioni.md) — Step 11: vista cliente deliverable + flusso revisioni.
- [`SETUP-12-pagamento-download.md`](./SETUP-12-pagamento-download.md) — Step 12: workflow revisioni admin + pagamento (mock) + download gating.
- [`SETUP-13-higgsfield.md`](./SETUP-13-higgsfield.md) — Step 13: Higgsfield — image + video generation reali (cloud diretto o Segmind proxy).
- [`SETUP-14-stripe.md`](./SETUP-14-stripe.md) — Step 14: Stripe Checkout reale (test mode + webhook + redirect).
- [`SETUP-15-email-composer.md`](./SETUP-15-email-composer.md) — Step 15: Email Composer Agent + invio SMTP via nodemailer.

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
│   ├── storage/       # StorageProvider (LocalFs + S3 stub)
│   └── agents/        # Framework agenti AI + Direttore Operativo
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
