# Setup 08 — Creative Lead (terzo agente AI)

> Step 8 dello Sprint 0.
> Obiettivo: dopo l'accettazione del preventivo, attivare il primo agente di **produzione**: il Creative Lead, che traduce brief + analisi Direttore in **concept creativo** + **brief operativi** per gli agenti specialisti (Copy, Design, Video).

---

## Cosa stiamo costruendo

### Agente `creative-lead`

Riceve in input: brief, riepilogo Direttore, complessità, deliverable richiesti. Produce in output:

- `concept_principale`: idea-guida memorabile (2-4 frasi)
- `alternative_concepts`: 1-3 alternative come opzioni B/C
- `brief_copy`: istruzioni per Copy Agent (tono, claim, lunghezza, payoff)
- `brief_design`: istruzioni per Art & Design Agent (palette, tipografia, riferimenti)
- `brief_video`: istruzioni per Video/Audio Agent (se nei deliverable)
- `mood_keywords`: 5-10 parole chiave dell'estetica
- `must_haves`: cose imprescindibili
- `must_avoids`: cose da evitare
- `note`: note interne per Michele (revisione)

### Trigger e transizione di stato

- Visibile in admin solo se `project.stato` è `preventivo_accettato` o `in_produzione`
- Esecuzione: bottone "Esegui Creative Lead" da admin
- Effetto: salva output + transizione `preventivo_accettato` → `in_produzione`

---

## Stato preparato per te

**Pacchetto `@kansei/agents`:**

- `src/agents/creative-lead/schema.ts` — Zod input/output
- `src/agents/creative-lead/prompt.ts` — system + user prompt
- `src/agents/creative-lead/mock.ts` — mock response strutturata
- `src/agents/creative-lead/index.ts` — agent definition
- `src/index.ts` — export aggiornato + registrazione mock

**Admin app:**

- `src/app/projects/[id]/actions.ts` — `runCreativeLeadAction` (transazione + transizione stato)
- `src/app/projects/[id]/creative-button.tsx` — bottone client component
- `src/app/projects/[id]/page.tsx` — sezione "Creative Lead" con concept + brief operativi visualizzati

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

## Step 3 · Test admin: esegui Creative Lead

Login admin, vai su un progetto in stato `preventivo_accettato` (cliente ha già accettato il preventivo nel Setup 07). Se non l'hai, fanne uno: brief → approva → Direttore → Finance → invia → cliente accetta.

Sotto la sezione Preventivo vedi una nuova sezione **Creative Lead** con bottone fucsia **Esegui Creative Lead**.

Click.

Atteso (mock, ~300ms):

- la sezione si popola con:
  - **concept principale** in box fucsia in italics
  - **concept alternativi** (1-3) in lista
  - **Brief Copy** + **Brief Design** + **Brief Video** (se applicabile) in tre box
  - **mood keywords** come pill list
  - **must have** + **must avoid** in due colonne (verde/rosso)
- header sezione mostra `v1`
- badge stato progetto cambia in **in produzione**

### Verifica DB su Adminer

- `project_creative_outputs`: 1 riga con `concept_principale`, `brief_copy`, `brief_design`, ecc.
- `agent_runs` / `token_usage` / `agent_outputs`: nuove righe `agente: creative-lead`
- `events`: nuova riga `agent.creative_lead.success`

---

## Step 4 · Re-esegui

Click di nuovo **Esegui Creative Lead** in fondo alla sezione (bottone presente anche dopo la prima esecuzione).

Atteso: nuovo record `project_creative_outputs` con `version: 2`. La pagina mostra l'ultimo (più recente). Lo storico delle versioni precedenti rimane in DB per audit.

---

## Step 5 · Format, commit, push

```powershell
pnpm format
git add .
git commit -m "feat(agents): creative-lead (concept + brief operativi)"
git push
```

---

## Cosa abbiamo raggiunto

- Terzo agente AI funzionante con stesso pattern del Direttore e Finance
- Transizione di stato automatica `preventivo_accettato` → `in_produzione`
- Concept + 3 brief operativi pronti per essere passati a Copy / Design / Video nei prossimi setup
- Versioning dei concept per gestire iterazioni

---

## Comandi utili

| Comando          | Cosa fa                                       |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Entrambe le app                               |
| `pnpm db:studio` | UI per ispezionare `project_creative_outputs` |

---

## Troubleshooting

**"Esegui prima il Direttore Operativo"**
Il Creative Lead richiede l'output del Direttore (per `summary` e `complexity`). Esegui prima il Direttore.

**Sezione Creative Lead non appare**
Lo stato del progetto è ancora `in_analisi` o `preventivo_inviato`. Per sbloccarla il cliente deve accettare il preventivo (così lo stato passa a `preventivo_accettato`).

**Output Creative Lead non aderente allo schema**
La run va in failed. Verifica `agent_logs` per il dettaglio. In mock non dovrebbe mai succedere.

---

## Prossimo step

**Setup 09 — Copy Agent (testi)** o **Setup 09 — Art & Design Agent (visual)**.

I due agenti possono essere fatti in parallelo. Setup 09 = Copy Agent perché è il più pulito: input strutturato, output testuale, niente integrazione con generatori esterni di immagini.

Setup 10 = Art & Design Agent (con integrazione Nano Banana / fal.ai per generazione immagini reale, sempre con fallback mock).

Quando hai validato che il Creative Lead funziona end-to-end, dimmelo: scegliamo se procedere con Copy o Art & Design.
