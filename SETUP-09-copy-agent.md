# Setup 09 — Copy Agent (testi con varianti A/B/C)

> Step 9 dello Sprint 0.
> Obiettivo: produrre contenuti testuali concreti (post social, newsletter, landing copy, claim, comunicati stampa) partendo dal concept del Creative Lead e dal brief operativo. Ogni deliverable ha **2-3 varianti** per permettere a Michele di scegliere.

---

## Cosa stiamo costruendo

### Agente `copy-agent`

Riceve in input:

- Brief originale, concept del Creative Lead, brief copy operativo
- Mood keywords, must haves, must avoids
- Lista deliverable richiesti (filtra autonomamente quelli testuali)

Produce in output un array di `deliverables`, ciascuno con:

- `type`: `social_post` | `newsletter` | `landing_page` | `press_release` | `claim` | `altro`
- `title`: nome user-friendly (es. "Post social 1 · angolo lancio")
- `variants` (1-3): label A/B/C, headline, body, cta, hashtags, length_chars
- `rationale`: 1-2 frasi che spiegano l'angolo scelto

### Caratteristiche varianti

- Sostanzialmente **diverse** tra loro (diversa angolazione, registro, lunghezza), non variazioni minori
- Lunghezze rispettose dei vincoli di piattaforma (220 char body per IG, 280 per X, 700 per LinkedIn)
- Hashtag solo per social_post
- CTA dove ha senso

### Trigger

- Visibile in admin se il Creative Lead è già stato eseguito
- Bottone indaco "Esegui Copy Agent"
- Output salvato in `agent_outputs` (payload JSON con tutti i deliverable)

---

## Stato preparato per te

**Pacchetto `@kansei/agents`:**

- `src/agents/copy-agent/schema.ts` — Zod input/output con tipo deliverable enum
- `src/agents/copy-agent/prompt.ts` — system + user prompt con linee guida per ogni tipo
- `src/agents/copy-agent/mock.ts` — mock che genera contenuti coerenti per ogni tipo richiesto
- `src/agents/copy-agent/index.ts` — agent definition
- `src/index.ts` — export aggiornato + registrazione mock

**Admin app:**

- `src/app/projects/[id]/actions.ts` — `runCopyAgentAction`
- `src/app/projects/[id]/copy-button.tsx` — bottone client component
- `src/app/projects/[id]/page.tsx` — sezione "Copy Agent" con deliverable + varianti espandibili (details/summary)

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

## Step 3 · Test admin: esegui Copy Agent

Login admin, vai su un progetto con **Creative Lead già eseguito** (stato `in_produzione`). Se non l'hai, esegui prima Creative Lead (Setup 08).

Sotto la sezione Creative Lead vedi una nuova sezione **Copy Agent** con bottone indaco **Esegui Copy Agent**.

Click.

Atteso (mock, ~300ms):

- la sezione si popola con N card deliverable, ciascuna con:
  - **title** + badge tipo (social_post, newsletter, ecc.)
  - **rationale** in corsivo
  - **varianti** A/B/C in `<details>` espandibili
  - per ogni variante: headline (se presente), body, CTA (se presente), hashtags (per social), conteggio caratteri
- header sezione mostra il conteggio totale deliverable

### Verifica DB

- `agent_runs` / `token_usage` / `agent_outputs`: nuove righe `agente: copy-agent`
- `events`: nuova riga `agent.copy_agent.success`
- In `agent_outputs.payload` trovi l'intero JSON con tutti i deliverable

---

## Step 4 · Esplora i contenuti

Per ciascun deliverable click su una variante per espanderla. Vedi il testo completo come sarebbe pubblicato.

I tipi generati dipendono dai deliverable richiesti nel brief:

- `social_plan` → 3 `social_post` (angoli: lancio, storia, community)
- `newsletter` → 1 `newsletter` con oggetto + body + CTA
- `landing_page` → 1 `landing_page` con headline + body
- `press_release` → 1 `press_release` strutturato
- `logo`, `image_pack`, `video_reel`, `altro` → 1 `claim` (3 varianti)

---

## Step 5 · Format, commit, push

```powershell
pnpm format
git add .
git commit -m "feat(agents): copy-agent (testi con varianti A/B/C)"
git push
```

---

## Cosa abbiamo raggiunto

- Quarto agente AI funzionante
- Pipeline di produzione che adesso copre: piano (Direttore) → preventivo (Finance) → concept (Creative) → **testi (Copy)**
- UI espandibile per esplorare le varianti senza sovraccaricare la pagina
- Output strutturato JSON facilmente esportabile (futuri setup: PDF brief, copy.md, ecc.)

---

## Comandi utili

| Comando          | Cosa fa                                        |
| ---------------- | ---------------------------------------------- |
| `pnpm dev`       | Entrambe le app                                |
| `pnpm db:studio` | Esplora `agent_outputs` con payload Copy Agent |

---

## Troubleshooting

**"Esegui prima il Creative Lead"**
Il Copy Agent legge concept + brief copy dal Creative Lead. Lancialo prima.

**Sezione Copy Agent non appare**
Manca l'output del Creative Lead. Lo vede solo quando creativeOutput è presente.

**Varianti tutte uguali**
In mock i contenuti sono canned generici. In produzione (LLM reale) le varianti saranno differenti per davvero. Se vedi roba sospetta in real, controlla che il prompt insista sul "sostanzialmente diverse".

---

## Prossimo step

**Setup 10 — Art & Design Agent (visual + generazione immagini)**.

Il Copy Agent ha prodotto i testi. Adesso servono i visual. Setup 10 introdurrà l'Art & Design Agent con:

- Generazione **prompt immagini** strutturati dal concept
- Integrazione **Nano Banana (Gemini Flash Image) via Google AI** o **fal.ai** per generazione reale
- Sempre fallback mock con immagini placeholder generate localmente
- Salvataggio asset in storage (`@kansei/storage`)
- UI admin con preview delle immagini generate

È il primo agente "multimodale" che esce dall'ambito testuale puro. Quando hai validato il Copy Agent end-to-end, dimmelo: parto col Setup 10.
