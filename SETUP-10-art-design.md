# Setup 10 — Art & Design Agent (art direction + generazione immagini)

> Step 10 dello Sprint 0.
> Obiettivo: introdurre il primo agente **multimodale**. Produce l'art direction (palette, tipografia, riferimenti) e le specifiche degli asset visivi, poi un image generator separato crea le immagini vere (SVG placeholder in dev, pronto per Nano Banana / fal.ai in prod).

---

## Cosa stiamo costruendo

### Pipeline a due fasi

**Fase 1 (LLM):** l'agente Art & Design riceve concept + brief design e produce:
- **Art direction**: palette (3-6 colori con hex e ruolo), tipografia (font headline + body), riferimenti, style keywords
- **Asset specs**: lista di asset da generare con `image_prompt` pronto per modelli image-gen, dimensioni, aspect ratio

**Fase 2 (image generator):** la server action prende le specs e per ogni asset:
- Chiama `generateImage` (mock SVG in dev, in V2 chiamata reale a Nano Banana via Google AI / fal.ai)
- Salva l'immagine via `@kansei/storage` in `assets/<projectId>/<runId>/asset-NN.svg`
- Arricchisce il payload `agent_outputs` con storage_key, mime, bytes

### Mock placeholder

In dev (default `MOCK_LLM=true`), il generator produce un SVG con:
- Sfondo nella palette del progetto
- Titolo dell'asset al centro in serif
- Prompt scritto sotto (truncato) come reference
- Cornice colorata + watermark "MOCK · WxH · Kansei-Studio"

In produzione (con `GOOGLE_AI_API_KEY` + `MOCK_LLM=false`), chiamerà Nano Banana (Gemini 2.5 Flash Image). Per V1 lo stub lancia un'eccezione esplicativa: implementeremo la chiamata reale in un setup successivo.

### Route handler `/api/storage/[...key]`

Per mostrare le immagini in UI serve un URL servibile. Ho aggiunto un route handler admin-protected che legge dallo storage e streamma il file. Pattern: `<img src="/api/storage/assets/PROJECT/RUN/asset-01.svg">`. Auth check su ogni richiesta.

---

## Stato preparato per te

**Pacchetto `@kansei/agents`:**
- `src/agents/art-design/schema.ts` — Zod con palette, typography, asset specs, generated assets
- `src/agents/art-design/prompt.ts` — system prompt che istruisce a produrre prompt pronti per image-gen
- `src/agents/art-design/mock.ts` — mock con 2 palette pre-impostate + asset specs per ogni deliverable
- `src/agents/art-design/index.ts` — agent definition
- `src/runtime/image-gen.ts` — `generateImage()` dispatcher (mock SVG | TODO real)
- `src/index.ts` — export aggiornato + registrazione mock

**Admin app:**
- `src/app/projects/[id]/actions.ts` — `runArtDesignAction` (agent + image gen + storage put + payload update)
- `src/app/projects/[id]/art-button.tsx` — bottone client rose
- `src/app/projects/[id]/page.tsx` — sezione "Art & Design" con palette, tipografia, riferimenti, **gallery asset**
- `src/app/api/storage/[...key]/route.ts` — handler admin-only che serve i file da storage

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

## Step 3 · Test: esegui Art & Design

Login admin. Vai su un progetto con **Creative Lead già eseguito**.

Sotto la sezione Copy Agent vedi nuova sezione **Art & Design** con bottone rosa **Esegui Art & Design**.

Click.

Atteso (mock, ~500ms — più lento perché genera SVG per ogni asset e li salva su filesystem):

- la sezione si popola con:
  - **Palette**: badge colorati con nome, hex, ruolo
  - **Tipografia**: headline + body font + style notes
  - **Riferimenti**: lista di stili descrittivi
  - **Style keywords**: pill list
  - **Asset generati**: gallery con thumbnail SVG, titolo, badge tipo (logo / social_post_image / brand_image / ecc.), dimensioni in pixel, peso in KB
  - per ogni asset, `<details>` espandibile col prompt completo
- header sezione mostra il numero asset

### Verifica filesystem

I file SVG vengono scritti in `./storage/assets/<projectId>/<runId>/asset-NN.svg`. Verifica:

```powershell
Get-ChildItem -Recurse storage/assets
```

Dovresti vedere N file SVG (uno per asset).

### Verifica DB

- `agent_runs` / `token_usage` / `agent_outputs`: nuove righe `agente: art-design`
- In `agent_outputs.payload.assets` ogni entry ha `storage_key`, `mime`, `bytes` (post-arricchimento)
- `events`: nuova riga `agent.art_design.success` con `generatedAssets: N`

---

## Step 4 · Apri un singolo asset

Click su un'immagine nella gallery. Si apre nel browser (o `/api/storage/assets/...`). Dovresti vedere l'SVG renderizzato.

Se ricevi `401 Unauthorized`, significa che sei loggato come cliente o non loggato. L'endpoint richiede ruolo admin.

---

## Step 5 · Format, commit, push

```powershell
pnpm format
git add .
git commit -m "feat(agents): art-design (art direction + image generation, mock SVG)"
git push
```

---

## Cosa abbiamo raggiunto

- Quinto agente AI funzionante (primo multimodale)
- Pipeline a due fasi: LLM produce specs, image generator produce file
- Storage realmente usato: file SVG salvati in `./storage/`, serviti via route handler admin-protected
- UI gallery che mostra preview + metadata + prompt
- Architettura pronta per integrazione Nano Banana / fal.ai cambiando solo `image-gen.ts`

---

## Comandi utili

| Comando | Cosa fa |
|---------|---------|
| `pnpm dev` | Entrambe le app |
| `pnpm db:studio` | Esplora `agent_outputs` payload Art & Design |
| `Get-ChildItem -Recurse storage/assets` | Vede i file SVG generati |

---

## Troubleshooting

**"Esegui prima il Creative Lead"**
L'Art & Design legge concept + brief design dal Creative Lead. Esegui prima quello.

**Sezione Art & Design non appare**
Manca l'output del Creative Lead. Visibile solo se `creativeOutput` esiste.

**Immagini "rotte" in UI (icona x)**
Il browser non riesce a caricare via `/api/storage/...`. Verifica:
- Sei loggato come admin
- Lo storage provider è `local` (vedi `.env`: `STORAGE_PROVIDER=local`)
- Il file SVG esiste in `./storage/assets/...`

**Errore "Image generation reale non ancora implementata"**
Hai impostato `MOCK_LLM=false` ma il generator non ha ancora l'integrazione Nano Banana / fal.ai (V2). Rimetti `MOCK_LLM=true` per ora.

**Cache image stale dopo rigenerazione**
Hard reload del browser (Ctrl+Shift+R). Il route handler imposta `Cache-Control: private, max-age=3600`.

---

## Prossimo step

**Setup 11 — Integrazione Nano Banana / fal.ai (image generation reale)** oppure **Setup 11 — Video/Audio Agent** oppure **Setup 11 — Vista cliente dei deliverable + revisioni**.

Tre direzioni possibili. La scelta migliore dipende da cosa vuoi validare:
- **Image gen reale**: vedere immagini vere generate da Nano Banana, validare prompt quality e costi
- **Video/Audio**: chiudere il set degli agenti V1 di produzione
- **Vista cliente deliverable**: chiudere il flusso end-to-end con preview, revisioni, download gated dal pagamento

Quando hai validato Art & Design con la gallery di SVG visibile in admin, dimmi quale direzione preferisci.
