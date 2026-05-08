# Setup 06 — Framework agenti + Direttore Operativo

> Step 6 dello Sprint 0.
> Obiettivo: introdurre il **primo agente AI** del sistema (il Direttore Operativo) e l'infrastruttura riusabile (`@kansei/agents`) che ogni agente futuro userà per chiamate LLM, tracking token, costi, retry.

---

## Cosa stiamo costruendo

### Pacchetto `@kansei/agents`

Framework che astrae il "run di un agente" dietro una singola funzione:

```ts
const result = await runAgent(direttoreOperativoAgent, input, { projectId });
```

Quello che `runAgent` fa per te dietro le quinte:

1. Valida l'input contro lo schema Zod dell'agente
2. Apre un record `agent_runs` (status `running`)
3. Costruisce system prompt + user message
4. Chiama l'LLM (Anthropic / OpenAI / Mock — switch automatico)
5. Parsa il JSON di risposta (tollerante a markdown wrapping)
6. Valida l'output contro lo schema Zod
7. Calcola il costo dai token usando `pricing_models`
8. Persiste `token_usage` (per analisi costi)
9. Persiste `agent_outputs` (payload completo)
10. Logga in `agent_logs`
11. Chiude `agent_runs` (status, latency)

**Niente di tutto questo lo scriverà ogni nuovo agente.** Aggiungere un agente significa scrivere: schema, prompt, mock response. La pipeline è già pronta.

### Direttore Operativo

Primo agente reale. Riceve il brief approvato e produce un piano strutturato:

- `summary`: 2-3 frasi di riepilogo
- `required_agents`: lista di specialisti da coinvolgere
- `execution_plan`: step ordinato con agent, descrizione, durata stimata
- `priority`: low/medium/high
- `estimated_complexity`: simple/moderate/complex/very_complex
- `risks`: rischi che potrebbero rallentare
- `missing_information`: cosa serve chiedere al cliente
- `requires_human_approval`: bool

### Modalità Mock di default

In dev senza API key, l'agente risponde con dati canned ma **coerenti**:
mappa i deliverable richiesti agli agenti necessari, stima ore, calcola complessità in base al numero di deliverable. Output realistico, niente token consumati.

Quando metti `ANTHROPIC_API_KEY` reale e `MOCK_LLM=false`, switch automatico al provider Anthropic. Stesso codice, stessa interfaccia.

---

## Stato preparato per te

**Pacchetto `packages/agents/`:**

- `package.json` — deps `@anthropic-ai/sdk`, `openai`, `zod`
- `src/runtime/types.ts` — tipi `AgentDefinition`, `LLMResponse`, `AgentRunResult`
- `src/runtime/runner.ts` — `runAgent()` con tracking completo
- `src/runtime/cost.ts` — `computeCost()` da `pricing_models`
- `src/runtime/llm/anthropic.ts` — wrapper Anthropic SDK
- `src/runtime/llm/openai.ts` — wrapper OpenAI SDK
- `src/runtime/llm/mock.ts` — provider mock con response provider registrabile
- `src/runtime/llm/factory.ts` — `callLLM()` con switch automatico mock/real
- `src/agents/direttore-operativo/` — agent definition + prompt + schema + mock response

**Admin app:**

- `src/app/projects/[id]/actions.ts` — nuova action `runDirettoreOperativoAction`
- `src/app/projects/[id]/direttore-button.tsx` — bottone client component
- `src/app/projects/[id]/page.tsx` — sezione "Direttore Operativo" con bottone se non ancora eseguito, output strutturato se completato
- `package.json` + `next.config.ts` — `@kansei/agents` aggiunto

**Env:**

- `.env.example` — `MOCK_LLM=true` come default sicuro per dev

---

## Step 1 · Aggiorna `.env`

Apri `.env` e aggiungi (se manca):

```env
MOCK_LLM=true
```

Le chiavi `ANTHROPIC_API_KEY` e `OPENAI_API_KEY` lasciale vuote per ora. Lo metteremo quando passeremo agli LLM reali.

---

## Step 2 · Installa le nuove dipendenze

```powershell
pnpm install
```

Atteso: scarica `@anthropic-ai/sdk`, `openai` (~10-30 MB).

---

## Step 3 · Type-check

```powershell
pnpm type-check
```

Atteso: 7 pacchetti `successful` (`shared`, `database`, `auth`, `storage`, `agents`, `admin`, `client`).

---

## Step 4 · Test in modalità mock

### 4a · Avvia admin

```powershell
pnpm --filter @kansei/admin dev
```

Login admin, vai su un progetto **già approvato** (stato `in_analisi`). Se non ne hai uno, fanne uno: invia un brief lato cliente, approvalo lato admin.

### 4b · Sezione Direttore

In fondo alla pagina dettaglio progetto admin, sotto le sezioni Brief / File / Eventi, vedi una nuova sezione **Direttore Operativo** con un bottone blu **Esegui analisi Direttore Operativo**.

Click sul bottone.

Atteso (in mock, ~300ms):

- bottone diventa "Direttore al lavoro…" e poi torna normale
- la pagina si aggiorna automaticamente (revalidatePath)
- la sezione si popola con:
  - **summary** in italiano
  - **priorità** e **complessità** badge
  - **piano di esecuzione** numerato con agente + descrizione + ore
  - **rischi** in lista
  - eventuale **missing_information** in giallo
- header sezione mostra `Run success · ~300 ms · NNN token · $0.0000` (in mock il costo è 0 perché non c'è pricing per il modello "mock(...)" - normale)

### 4c · Verifica DB

Apri Adminer → tabelle:

- `agent_runs`: una riga con `agente: direttore-operativo`, `status: success`, `latency_ms` valorizzato
- `agent_outputs`: una riga con `payload` JSON contenente la risposta
- `token_usage`: una riga con `input_tokens`, `output_tokens` (numeri stimati dal mock)
- `agent_logs`: una riga `info` con il sommario della run
- `events`: una nuova riga `agent.direttore_operativo.success`

### 4d · Re-esegui

Premi di nuovo il bottone. L'output viene rigenerato (sovrascritto come ultima `agent_output`). Utile dopo un cambio di prompt per testare differenze.

---

## Step 5 · (Opzionale) Test con LLM reale

Quando vuoi testare con Anthropic vero:

1. Ottieni una API key da <https://console.anthropic.com/>
2. In `.env`:
   ```env
   MOCK_LLM=false
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Riavvia il dev server (le env si caricano all'avvio)
4. Re-esegui il Direttore: stavolta vedrai latency reale (5-15s) e costi reali in `token_usage`

**Costo stimato per run:** con Sonnet 4 sui prompt brevi del Direttore, ~$0.005 a invocazione. Dieci test = 5 cent.

---

## Step 6 · Format, commit, push

```powershell
pnpm format
git add .
git commit -m "feat(agents): framework runAgent + Direttore Operativo (primo agente AI)"
git push
```

---

## Cosa abbiamo raggiunto

- Framework agenti `@kansei/agents` riusabile
- Tracking completo di token e costi automatico (per ogni run, una riga in `token_usage`)
- Provider switching trasparente (mock/anthropic/openai)
- Direttore Operativo funzionante end-to-end: input → LLM → output strutturato → DB → UI
- Piattaforma pronta a ricevere il prossimo agente con il minimo di codice (basta replicare il pattern di `direttore-operativo/`)

---

## Comandi utili

| Comando                                | Cosa fa                                                         |
| -------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                             | Entrambe le app                                                 |
| `pnpm db:studio`                       | UI per ispezionare `agent_runs`, `token_usage`, `agent_outputs` |
| `MOCK_LLM=true` in env                 | Forza modalità mock (default raccomandato in dev)               |
| `MOCK_LLM=false` + `ANTHROPIC_API_KEY` | Modalità reale con Anthropic                                    |

---

## Troubleshooting

**Errore "ANTHROPIC_API_KEY non configurata"**
Hai impostato `MOCK_LLM=false` senza fornire la key. Mettila o rimetti `MOCK_LLM=true`.

**Output del Direttore non corrisponde allo schema**
Errore `Output non aderente allo schema`. Significa che l'LLM ha prodotto JSON con campi mancanti o tipi sbagliati. In V1 fallisce. In V2 aggiungeremo retry con prompt più stretto.

**Costo `$0.0000` con LLM reale**
Manca pricing in DB per quel `provider/model`. Verifica `pricing_models` su Adminer. Re-esegui `pnpm db:seed` per repopolare.

**`Cannot find module '@kansei/agents'`**
Manca dep o `transpilePackages`. Re-lancia `pnpm install` e verifica `next.config.ts`.

**Run dura tantissimo (con mock)**
Il mock ha latenza simulata 100-300ms. Se vedi >2s con mock, c'è qualcosa che non va — controlla i log.

---

## Prossimo step

**Setup 07 — Finance/Admin + flusso preventivo cliente.**

Il Direttore ha prodotto il piano. Adesso serve trasformarlo in un preventivo per il cliente. Setup 07 aggiunge:

- agente `finance-admin` con OpenAI Structured Outputs (output garantito JSON-valido)
- preventivo salvato in `quotes` + `quote_items` (gap max 15%)
- pagina `/projects/[id]/preventivo` lato cliente con bottoni Accetta/Rifiuta
- transizione di stato: `in_analisi` → `preventivo_inviato` → `preventivo_accettato`

Quando hai validato che il Direttore funziona end-to-end (UI + DB), dimmelo: parto col Setup 07.
