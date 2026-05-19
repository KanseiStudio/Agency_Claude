# Setup 13 — Higgsfield: image + video generation reali

> Step 13 dello Sprint 0.
> Obiettivo: collegare il sistema a Higgsfield per generare **immagini e video reali** (modelli Soul, Flux, Nano Banana per le immagini; Seedance, Kling, Veo, Wan, Sora2 per i video). In dev resta attivo il mock SVG di default; quando vuoi testare con la API reale basta cambiare due variabili in `.env`.

---

## Cosa stiamo costruendo

### A. Client HTTP Higgsfield (`packages/agents/src/runtime/higgsfield.ts`)

Un client unico che parla con la **Cloud API diretta** (`cloud.higgsfield.ai`) **oppure** con il **proxy Segmind serverless** (`api.segmind.com`). La scelta è solo questione di env var: header di auth, prefisso, endpoint sono tutti configurabili.

Pattern async universale: submit job → polling dello status URL → download del file generato. Timeout configurabile (default 3s × 60 tentativi = ~3 minuti).

### B. Dispatcher unificato per le immagini (`runtime/image-gen.ts`)

`generateImage()` decide a runtime se usare il mock (SVG placeholder) o Higgsfield in base a:

- `MOCK_LLM=true` → mock
- `HIGGSFIELD_API_KEY` mancante → mock (fallback automatico)
- altrimenti → Higgsfield (modello default: `soul`)

Risposta unificata: `{ bytes, mime, meta: { provider, modelUsed, creditsCost, elapsedMs } }`. Il caller salva i `bytes` in storage e usa il `meta` per il cost tracking.

### C. Dispatcher unificato per i video (`runtime/video-gen.ts`)

Stesso pattern di `generateImage` ma per video. Modello default: `seedance`. In mock genera un SVG placeholder con play button + meta (durata, risoluzione, AR) — utile per validare il flusso senza spesa.

### D. Cost tracking

La server action `runArtDesignAction` registra una riga in `external_api_usage` per ogni immagine generata via Higgsfield, con `provider`, `endpoint` (model usato), `units` (crediti consumati) e `unitType=credits`. I costi USD/EUR sono lasciati a 0 finché non calibri la conversione crediti→€ in base al tuo piano Higgsfield.

---

## Stato preparato per te

**packages/agents:**

- `runtime/higgsfield.ts` — client HTTP completo (image + video + polling + download asset)
- `runtime/image-gen.ts` — dispatcher refactored: mock | higgsfield
- `runtime/video-gen.ts` — nuovo, stesso pattern per i video
- `index.ts` — export di `generateVideo`, tipi e funzioni Higgsfield low-level

**apps/admin:**

- `app/projects/[id]/actions.ts` — `runArtDesignAction` passa `aspectRatio` al dispatcher e registra in `external_api_usage` per le call reali

**Env:**

- `.env.example` — sezione HIGGSFIELD documentata con preset cloud diretto e Segmind

---

## Step 1 · Scegli il provider Higgsfield

Hai due strade:

### Opzione A — Cloud Higgsfield diretto (consigliato)

L'API ufficiale Higgsfield vive su `platform.higgsfield.ai` (NON `cloud.higgsfield.ai/api/v1`, che era una mia scommessa iniziale errata). L'auth è in formato `Authorization: Key KEY_ID:KEY_SECRET` — quindi serve la **coppia** id+secret separata da `:`.

1. Installa la CLI ufficiale (opzionale ma comodo per test):
   ```powershell
   npm install -g @higgsfield/cli
   higgsfield auth login
   ```
   La CLI ti porta nel browser e crea automaticamente le credenziali.
2. Recupera la coppia `KEY_ID:KEY_SECRET` dal dashboard su [platform.higgsfield.ai](https://platform.higgsfield.ai) → sezione **API Keys** / **Developers**.
3. In `.env` (questi sono già i default in `.env.example`):

```env
HIGGSFIELD_API_KEY=KEY_ID:KEY_SECRET
HIGGSFIELD_API_BASE_URL=https://platform.higgsfield.ai
HIGGSFIELD_AUTH_HEADER=Authorization
HIGGSFIELD_AUTH_PREFIX=Key
HIGGSFIELD_IMAGE_ENDPOINT=/v1/text2image/soul
HIGGSFIELD_VIDEO_ENDPOINT=/v1/image2video/dop
HIGGSFIELD_IMAGE_QUALITY=HD
HIGGSFIELD_VIDEO_MODEL=dop-turbo
```

Il client aggiunge automaticamente lo spazio tra `Key` e la key (`Authorization: Key KEY_ID:KEY_SECRET`), quindi non serve mettere virgolette o spazi trailing in `.env`.

**Riferimento ufficiale:** [github.com/higgsfield-ai/higgsfield-js](https://github.com/higgsfield-ai/higgsfield-js).

**Vantaggio:** prezzo nativo, tutti i modelli (Soul, DoP, Speak, Flux), retention crediti su piano mensile.

> ⚠️ **Nota su Higgsfield video**: la loro API non fa text-to-video puro — DoP (Director of Photography) è un endpoint **image-to-video**. Quindi il flusso reale è: prima genera un'immagine con Soul, poi anima quell'immagine con DoP passando l'`imageUrl` in `higgsfieldGenerateVideo`. Per text-to-video diretto (Seedance, Kling, Veo) bisogna usare gli endpoint V2 modello-specifici.

### Opzione B — Segmind serverless proxy

1. Vai su [segmind.com](https://segmind.com), crea account, genera API key
2. In `.env`:

```env
HIGGSFIELD_API_KEY=SG_xxxxxxxxxxxxxxxx
HIGGSFIELD_API_BASE_URL=https://api.segmind.com/v1
HIGGSFIELD_AUTH_HEADER=x-api-key
HIGGSFIELD_AUTH_PREFIX=
HIGGSFIELD_IMAGE_ENDPOINT=/higgsfield-soul
HIGGSFIELD_VIDEO_ENDPOINT=/higgsfield-seedance
```

**Vantaggio:** pay-per-request senza piano mensile, comodo per testare. **Svantaggio:** prezzi leggermente più alti del cloud diretto.

### Opzione C — Skill cowork (per la sessione con Claude)

Se vuoi che IO (Claude, in questa sessione cowork) abbia best practice aggiornate su Higgsfield, lancia:

```powershell
npx skills add higgsfield-ai/skills
```

Lo skill non cambia il codice runtime del progetto — è solo un extra di contesto per me quando lavoriamo insieme. Le credenziali in `.env` restano comunque necessarie per la chiamata server-side del progetto Next.js.

---

## Step 2 · Abilita la modalità reale

In `.env` cambia:

```env
MOCK_LLM=false
```

> ⚠️ Mantenere `MOCK_LLM=true` lascia tutto in mock anche con la chiave Higgsfield configurata: utile se vuoi spegnere temporaneamente la spesa senza rimuovere la key.

---

## Step 3 · Type-check + dev

```powershell
pnpm type-check
pnpm dev
```

Atteso: 7 pacchetti `successful`.

---

## Step 4 · Smoke test immagini

1. Login admin, apri un progetto che ha già passato Creative Lead (dal Setup 8)
2. Click **Esegui Art & Design**
3. Aspetta: rispetto al mock istantaneo, la chiamata Higgsfield può prendere 30–90s per asset (il dispatcher fa polling automatico)
4. Verifica:
   - in `agent_runs`: nuova riga `art-design` con status `success`
   - in `external_api_usage`: una riga per ogni asset generato, `provider: higgsfield`, `units` valorizzato con i crediti se la risposta API li espone
   - in `storage/assets/<projectId>/<runId>/`: file `.png` (o `.webp`) reali invece di `.svg`
5. Apri la card asset nel client portal (Setup 11): l'immagine reale appare nel preview

---

## Step 5 · Smoke test video (manuale per ora)

Non c'è ancora un agente "Video/Audio" cablato nelle action admin (verrà in un setup successivo), ma puoi invocare `generateVideo()` da uno script di test:

```typescript
// scripts/test-video.ts
import 'dotenv/config';
import { generateVideo } from '@kansei/agents';
import fs from 'node:fs';

const res = await generateVideo({
  prompt: 'Cinematic shot of a hand picking up a phone, soft natural light',
  durationSeconds: 5,
  resolution: '720p',
  aspectRatio: '9:16',
  model: 'seedance',
});

fs.writeFileSync(`./test-video.${res.mime.includes('mp4') ? 'mp4' : 'svg'}`, res.bytes);
console.log('Generated:', res.meta);
```

Lancialo con `pnpm tsx scripts/test-video.ts`. Atteso (modalità reale): MP4 da ~5s salvato nella cartella corrente.

---

## Step 6 · Verifica DB

```sql
-- ultime call esterne registrate
SELECT created_at, agente, provider, endpoint, units, unit_type
FROM external_api_usage
ORDER BY created_at DESC
LIMIT 10;
```

Atteso: una riga per ogni asset, `provider=higgsfield`, `endpoint` con il nome del modello usato (es. `image:soul`).

---

## Step 7 · Format, commit, push

```powershell
pnpm format
git add .
git commit -m "feat: integra Higgsfield per generazione immagini e video reali"
git push
```

---

## Cosa abbiamo raggiunto

- Generazione immagini reali tramite Higgsfield (Soul, Flux, Nano Banana)
- Generazione video pronta a essere chiamata (Seedance, Kling, Veo, Wan, Sora2)
- Switch mock ↔ reale governato da una sola variabile (`MOCK_LLM`)
- Cost tracking di base via `external_api_usage` (crediti registrati per asset)
- Architettura provider-agnostic: passare da cloud diretto a Segmind richiede solo cambiare 4 env vars

---

## Troubleshooting

**`HIGGSFIELD_API_KEY non configurata`**
Hai messo `MOCK_LLM=false` ma la key è vuota. O metti la key, o rimetti `MOCK_LLM=true`.

**`Higgsfield image submit failed (404) @ POST ...`**
URL endpoint sbagliato. Verifica che `HIGGSFIELD_API_BASE_URL=https://platform.higgsfield.ai` (NON `cloud.higgsfield.ai`) e che `HIGGSFIELD_IMAGE_ENDPOINT=/v1/text2image/soul`. Le rotte sono cambiate nel tempo: se vedi ancora 404 con questi default, apri devtools del client Higgsfield ufficiale (rete) e cattura l'URL reale.

**`Higgsfield image submit failed (401)` / `(403)`**
Key invalida, scaduta, o formato sbagliato. Per il cloud diretto la key deve essere `KEY_ID:KEY_SECRET` (due parti separate da `:`). Verifica nel dashboard Higgsfield/Segmind. Per Segmind ricorda `HIGGSFIELD_AUTH_HEADER=x-api-key` (NON `Authorization`).

**`Higgsfield video: campo imageUrl obbligatorio`**
Higgsfield DoP fa image-to-video, non text-to-video. Genera prima un'immagine con `higgsfieldGenerateImage`, prendi la sua URL pubblica e passa quella come `imageUrl` a `higgsfieldGenerateVideo`.

**`timeout dopo 60 tentativi`**
Il job ha impiegato più di 3 minuti. Aumenta `HIGGSFIELD_MAX_POLL_ATTEMPTS` (es. 120) o `HIGGSFIELD_POLL_INTERVAL_MS` (es. 5000). Tipico per video lunghi o modelli premium.

**`risposta non riconosciuta (manca status_url e url diretto)`**
La response shape della API è diversa da quella attesa. Apri devtools network nel client Higgsfield ufficiale per vedere il formato e adatta `extractImageUrl` / `extractVideoUrl` in `higgsfield.ts`. Le chiavi cercate sono già abbastanza permissive (`image_url`, `output_url`, `url`, `result_url`, oltre ad array `images`/`output`/`results`).

**Crediti registrati a 0 in `external_api_usage`**
Alcune response Higgsfield/Segmind non ritornano `credits_cost` nel payload. Va bene: la riga viene comunque creata e puoi calibrare il costo a livello di pricing seed (Step futuro). Se vuoi i crediti precisi, attiva il webhook usage reporting di Higgsfield e linkalo a un endpoint server-side.

**Asset visualizzati come "x rotta" nel client portal**
Verifica:
1. Il file esiste in `storage/assets/<projectId>/<runId>/asset-XX.png`
2. Il route handler `/api/client-preview/[...key]` ritorna il file con `Content-Type` corretto (per asset reali è `image/png`, non `image/svg+xml`)
3. In `deliverables` su Adminer, il record ha `mime` valorizzato correttamente

---

## Comandi utili

| Comando | Cosa fa |
|---------|---------|
| `MOCK_LLM=true` | Forza mock (default dev) |
| `MOCK_LLM=false` | Usa Higgsfield reale (se key configurata) |
| `pnpm db:studio` → `external_api_usage` | Vedi crediti consumati per progetto |
| `pnpm db:studio` → `agent_runs` | Vedi runtime e status delle generazioni |

---

## Prossimo step

Tornare a chiudere il **Setup 12 — pagamento + invoice download** end-to-end e validare con asset reali nel preview cliente.

Successivamente: **Setup 14 — Video/Audio Agent** (l'agente che pianifica gli asset video) + **Setup 15 — Stripe Checkout reale**.

Quando hai una key Higgsfield e vuoi testare la generazione reale, fammelo sapere e seguiamo insieme la prima call live.
