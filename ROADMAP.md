# Roadmap Operativa — Kansei-Studio Agency

> Versione 1.0 — Maggio 2026
> Stack: **Next.js** (frontend cliente + dashboard admin) · **MySQL** (database) · **n8n** (orchestrazione agenti) · **Storage** (S3/MinIO da definire)
> Decisore umano: **Michele** (unico punto di approvazione nel ciclo V1)

---

## Indice delle fasi

1. **Fase 0** — Fondamenta tecniche (infrastruttura, DB, n8n, Next.js)
2. **Fase 1** — Core layer condiviso (schema, API base, sistema agenti)
3. **Fase 2** — Sviluppo dei 10 agenti V1, uno per uno
4. **Fase 3** — Workflow end-to-end (brief → preventivo → produzione → revisioni → pagamento → download)
5. **Fase 4** — Dashboard amministratore
6. **Fase 5** — Frontend cliente
7. **Fase 6** — QA, hardening, deploy
8. **Fase 7** — Espansione V2 (agenti aggiuntivi non in V1)

---

# FASE 0 — Fondamenta tecniche

Obiettivo: avere il terreno di gioco pronto prima di scrivere logica di business.

## 0.1 Setup repository

- Decidere architettura: **monorepo** consigliato (Turborepo o pnpm workspaces) con tre pacchetti:
  - `apps/admin` — dashboard Next.js per Michele
  - `apps/client` — area cliente Next.js (può essere stessa app con due aree protette da ruolo)
  - `packages/shared` — tipi TypeScript, schemi Zod, costanti, listino, schema agenti
- Definire convenzioni: ESLint, Prettier, Husky (pre-commit), commit conventional
- Configurare `.env.example` con tutte le variabili (DB, n8n webhook URLs, storage, auth secret, mail provider, payment provider)

## 0.2 Database MySQL

- Provisioning DB (locale via Docker, staging, produzione)
- Scelta ORM: **Prisma** consigliato (tipi auto-generati condivisibili)
- Setup migrazioni e seed (clienti demo, listino base, utente admin)
- Setup backup automatici e retention policy

## 0.3 n8n

- Provisioning istanza n8n (Docker self-hosted con Postgres come metadata DB)
- Creazione utenze e API keys
- Setup folder/tag per organizzare i workflow per agente
- Definizione convenzioni: ogni workflow agente espone un webhook `POST /agent/{nome_agente}` e risponde con JSON standard
- Configurazione credenziali condivise (DB MySQL, OpenAI/Anthropic key, storage, mail)

## 0.4 Storage file (uploads + deliverable)

- **In dev:** filesystem locale sulla macchina di sviluppo, root configurabile via env.
- **In prod (da decidere prima del go-live):** stesso VPS di n8n (volume montato) o S3 AWS.
- **Astrazione obbligatoria:** interfaccia `StorageProvider` con due implementazioni `LocalFsProvider` e `S3Provider`, switch via env. Stessa interfaccia usata da Next.js e da n8n (HTTP wrapper interno per n8n).
- Bucket/cartelle logiche: `uploads-clienti` (reference brief), `working` (file di lavoro), `deliverables` (output finali).
- Policy: deliverables protetti, accessibili solo via signed URL emesso dopo verifica pagamento.
- Mai esporre path raw nel DB: salvare solo `storage_key` opaco, risolto dal provider attivo.

## 0.5 Autenticazione

- NextAuth.js con due ruoli: `admin` e `client`
- Login email/password + magic link
- 2FA opzionale per admin (Michele)
- Session JWT con scadenza ragionevole

## 0.6 Logging e osservabilità

- Sentry o equivalente per errori frontend/backend
- Log strutturati lato n8n salvati in tabella `agent_logs`
- Dashboard di health check basilare

---

# FASE 1 — Core layer condiviso

## 1.1 Schema database completo

Tabelle minime da creare in MySQL.

### Anagrafica

- `users` (id, email, password_hash, role, locale, created_at)
- `clients` (id, ragione_sociale, p_iva, email_fatturazione, indirizzo, locale_preferito, note, created_at)

### Progetti

- `projects` (id, client_id, codice_progetto, titolo, project_type, parent_subscription_id, stato, language, created_at, closed_at)
  - `project_type`: `one_shot` | `recurring_cycle`
  - stati: `bozza`, `in_attesa_approvazione_admin`, `in_analisi`, `preventivo_inviato`, `preventivo_accettato`, `in_produzione`, `in_revisione`, `chiuso`, `annullato`, `sospeso_costi`

### Subscription (lavori ricorrenti)

- `subscription_plans` (id, codice, nome, descrizione, deliverable_per_ciclo_json, prezzo_mensile, billing_cycle, attivo)
- `subscriptions` (id, client_id, plan_id, stripe_subscription_id, status, started_at, ended_at, next_billing_at, current_cycle_project_id)
- `subscription_deliveries` (id, subscription_id, cycle_project_id, cycle_start, cycle_end, status)
- `briefs` (id, project_id, descrizione, obiettivi_json, deliverable_richiesti_json, deadline, budget_indicativo, files_json, created_at)
- `project_files` (id, project_id, tipo, path_storage, mime, dimensione, uploaded_by, created_at)

### Preventivo e produzione

- `quotes` (id, project_id, version, prezzo_min, prezzo_max, gap_pct, breakdown_json, valid_until, status, created_at)
  - status: `draft`, `inviato`, `accettato`, `rifiutato`, `scaduto`
- `quote_items` (id, quote_id, agente, voce, quantità, prezzo_unitario, prezzo_totale, opzionale_bool)
- `production_runs` (id, project_id, quote_id, started_at, completed_at, stato)

### Revisioni

- `revision_rounds` (id, project_id, numero, tipo, prezzo, status, requested_at, completed_at)
  - tipo: `incluso` (1-3) o `extra_a_pagamento`
- `revision_requests` (id, round_id, deliverable_id, descrizione_modifica, asset_riferimento)

### Output agenti

- `agent_outputs` (id, project_id, agente, run_id, payload_json, status, version, created_at)
  - status: `pending`, `success`, `failed`, `needs_human_review`
- `agent_logs` (id, project_id, agente, run_id, livello, messaggio, payload, created_at)
- Tabelle dedicate per output strutturati (vedi singoli agenti):
  - `project_strategy_outputs`
  - `project_research_outputs`
  - `project_creative_outputs`
  - `project_finance_outputs`
  - `project_account_outputs`

### Consumo token e costi (vedi Fase 1.5 per dettaglio)

- `agent_runs` (id, project_id, agente, workflow_id, started_at, ended_at, status, latency_ms)
- `token_usage` (id, run_id, project_id, agente, provider, model, input_tokens, output_tokens, cached_tokens, total_tokens, cost_usd, cost_eur, created_at)
- `external_api_usage` (id, run_id, project_id, agente, provider, endpoint, units, unit_type, cost_usd, cost_eur, created_at) — per costi non-LLM (image gen, video gen, TTS, web search)
- `pricing_models` (id, provider, model, input_price_per_1k, output_price_per_1k, cached_price_per_1k, valid_from, valid_to)
- `cost_alerts` (id, scope, soglia, attuale, project_id, agente, raised_at, resolved_at)

### Deliverable e materiali finali

- `deliverables` (id, project_id, tipo, titolo, path_storage, mime, agente_creatore, status, created_at)
  - status: `bozza`, `qa_passed`, `approvato_cliente`, `consegnato`
- `deliverable_versions` (id, deliverable_id, version, path_storage, note, created_at)

### Pagamenti

- `invoices` (id, project_id, numero, importo, valuta, status, issued_at, paid_at)
- `payments` (id, invoice_id, importo, metodo, transaction_id, status, created_at)

### Approvazioni umane

- `approvals` (id, project_id, checkpoint_code, payload_json, requested_at, decided_at, decided_by, esito, note)
- `approval_policies` (id, checkpoint_code, automatic, auto_rule_json, description)
  - checkpoint_code: `brief_iniziale`, `concept_creativo`, `testi_finali`, `materiali_finali`, `preventivo`, `extra_revision`, `cost_overrun_yellow`, `cost_overrun_red`
  - In V1 tutti i record hanno `automatic = false`. Toggle futuro per automazione progressiva senza modifica codice.

### Blocchi cliente

- `client_blocks` (id, project_id, area, motivo, attivo_from, importo_rimborsato_o_ridotto)
  - area: `social_campaign`, `press_campaign`

### Lookup

- `services_catalog` (id, codice, descrizione, prezzo_base_min, prezzo_base_max, agente_responsabile)

## 1.2 Sistema di tracking token e costi

Componente trasversale a tutti gli agenti. Obiettivo: sapere in ogni momento quanti token sta consumando ogni agente, ogni progetto, e l'intera agenzia, con i relativi costi monetari.

### 1.2.1 Cosa tracciare

- **Token LLM:** input, output, e cached/prompt-cached (Anthropic e OpenAI hanno tariffe dedicate per i cached)
- **Chiamate non-LLM a costo:**
  - generazione immagini (DALL-E, Midjourney via API, Flux, SD)
  - generazione video (Runway, Sora, Pika, Veo) — costi a secondo o a clip
  - TTS / voice (ElevenLabs, OpenAI Voice) — costi a carattere o a minuto
  - Speech-to-text (Whisper) — costi al minuto
  - Web search (Tavily, Serper, Perplexity) — costi a query
  - Embeddings — costi a token
- **Metadati:** progetto, agente, workflow_id, run_id, modello usato, latenza, status

### 1.2.2 Dove tracciare

- Ogni workflow n8n di ogni agente, dopo la chiamata a un provider, scrive una riga in `token_usage` (LLM) o `external_api_usage` (altri servizi)
- Nodo n8n riusabile (sub-workflow `log-usage`) richiamato da tutti gli agenti per evitare duplicazione di logica
- Hook lato API Next.js per le chiamate fatte direttamente dal backend (non via n8n)

### 1.2.3 Calcolo costi

- File **`pricing.yaml`** versionato nel repo con tariffe per provider/modello, validità temporale.
- Aggiornamento **manuale al primo del mese** (i provider LLM non espongono pricing API affidabili).
- Cron job mensile che alza un warning in dashboard se il file ha età > 35 giorni.
- Tabella `pricing_models` popolata via seed dal `pricing.yaml` ad ogni deploy + endpoint admin per ricarica manuale.
- Conversione USD→EUR con tasso giornaliero (cron BCE/exchangerate API), salvato anche `cost_eur` per analisi locale
- Formula standard:
  `cost = (input_tokens/1000) * input_price + (output_tokens/1000) * output_price + (cached_tokens/1000) * cached_price`

### 1.2.4 Soglie e alert

- **Pre-flight estimator:** prima di emettere preventivo, funzione che stima il costo agenti del progetto basata su `services_catalog` e medie storiche. In V1 con tabelle euristiche tarate da Michele.
- **Real-time monitor** durante esecuzione, soglie di default:
  - **100% del costo stimato** → flag giallo, notifica dashboard a Michele.
  - **130% del costo stimato** → flag rosso, notifica push/email a Michele, bottoni `Continua` / `Sospendi` sul progetto. **No auto-decision: Michele sceglie.**
  - **200% del costo stimato** (configurabile) → **hard stop di sicurezza:** workflow auto-sospeso, progetto in stato `sospeso_costi`, sblocco manuale richiesto. Protezione runaway loop, non sostituisce decisione di business.
- **Anti-loop per singola run:** alert immediato se una singola run agente supera $5 (configurabile). Protezione tecnica indipendente dal budget di progetto.
- Soglie aggiuntive predisposte per costo totale agenzia (giornaliero/settimanale/mensile), inizialmente non attive ma il sistema le supporta.

### 1.2.5 Integrazione con Finance/Admin Agent

- Finance/Admin legge `token_usage` aggregato per progetto per calcolare il **costo reale** vs il **costo stimato** in preventivo
- Marginalità per progetto = (importo fatturato - costo agenti - costo API esterne - overhead) / importo fatturato
- Storico per stima preventivi futuri: "progetti simili sono costati N token medi"

### 1.2.6 Vista admin token & costi

Dashboard dedicata con:

- KPI top: token totali oggi/settimana/mese, costo totale, costo medio per progetto, modello più costoso
- Grafico time-series consumo token per giorno (stack per agente)
- Tabella per agente: token totali, costo, n. run, costo medio per run, latenza media
- Tabella per progetto: token consumati, costo accumulato, % vs preventivo, marginalità prevista
- Drill-down per run: prompt (troncato), risposta, token, costo, latenza, errori
- Export CSV per analisi extra

## 1.3 Convenzioni n8n

- **Pattern webhook → executor → DB write → response**
- Ogni workflow agente ha:
  - Trigger Webhook con autenticazione (header secret)
  - Validazione input (schema Zod replicato lato n8n via Function node)
  - Inizio `agent_runs` (started_at, status=`running`)
  - Chiamata LLM con prompt versionato
  - **Estrazione `usage` dalla risposta provider** (input_tokens, output_tokens, cached_tokens) e scrittura in `token_usage`
  - **Per chiamate non-LLM** (image gen, TTS, ecc.) scrittura in `external_api_usage`
  - Validazione output JSON contro schema
  - Persistenza in `agent_outputs` (sempre) + tabella dedicata se prevista
  - Chiusura `agent_runs` (ended_at, latency_ms, status=`success/failed`)
  - Logging strutturato in `agent_logs`
  - Gestione errore: ritento esponenziale (max 3), poi `status=failed` + alert
  - Risposta sincrona se rapida, asincrona con callback se lunga
- Sub-workflow riusabile **`log-usage`** richiamato da ogni agente: riceve `(run_id, provider, model, usage_object)` e scrive su DB calcolando il costo dalla `pricing_models` corrente

## 1.4 Template agente (riusabile per tutti)

- File `packages/shared/agents/template.ts` con interfaccia `AgentDefinition`
- Per ogni agente serve definire: `name`, `inputSchema` (Zod), `outputSchema` (Zod), `prompt` (versionato), `n8nWebhookEnvKey`, `dbTable`, **`provider`** (anthropic/openai/google/fal), **`model`** (es. `claude-sonnet-4-6`, `gpt-4o`, `gemini-2.5-flash-image`).
- API Next.js: `POST /api/agents/{name}/run` proxy verso n8n
- Helper `runAgent(name, input)` lato server con timeout, retry, telemetria

### Mapping provider/modello per agente V1

Punto di partenza, da affinare con i test reali:

| Agente                              | Provider        | Modello                                        | Razionale                                       |
| ----------------------------------- | --------------- | ---------------------------------------------- | ----------------------------------------------- |
| Direttore Operativo                 | Anthropic       | claude-sonnet-4-6                              | Routing complesso, ragionamento multi-step      |
| Account Manager                     | Anthropic       | claude-haiku-4-5                               | Risposte cliente brevi, basso costo             |
| Finance/Admin                       | OpenAI          | gpt-4o + Structured Outputs                    | Calcoli + JSON garantito                        |
| Brand/Marketing Strategist          | Anthropic       | claude-sonnet-4-6                              | Long-form strategy, scrittura italiana          |
| Research Agent                      | Anthropic       | claude-sonnet-4-6                              | Long context, sintesi                           |
| Creative Lead                       | Anthropic       | claude-sonnet-4-6                              | Concept creativi                                |
| Copy Agent                          | Anthropic       | claude-sonnet-4-6 (Opus per premium)           | Qualità testo italiano                          |
| Art & Design (direzione + prompt)   | Anthropic       | claude-sonnet-4-6                              | Direzione testuale                              |
| Art & Design (generazione immagini) | Google + fal.ai | gemini-2.5-flash-image (Nano Banana), Seedance | Generazione native                              |
| Video/Audio (storyboard testuale)   | Anthropic       | claude-sonnet-4-6                              | Scrittura scaletta                              |
| Video/Audio (generazione video)     | fal.ai          | Seedance, Kling, Wan                           | Aggregator V1                                   |
| Video/Audio (TTS)                   | OpenAI          | tts-1 / tts-1-hd                               | Voci di partenza, ElevenLabs in opzione premium |
| Video/Audio (STT)                   | OpenAI          | whisper-1                                      | Trascrizione/sottotitoli                        |
| Publishing & Performance            | Anthropic       | claude-haiku-4-5                               | Operativo, basso costo                          |
| QA Agent (V2)                       | OpenAI          | gpt-4o-mini                                    | Veloce, basso costo, JSON enforced              |

## 1.5 Bus eventi interno

- Tabella `events` per stato transitions (project moved to X, agent finished, approval requested)
- Listener: notifiche email a Michele e al cliente, webhook a n8n per trigger automatici

---

# FASE 2 — Agenti V1: sviluppo uno per uno

Per ogni agente l'iter è identico:

1. Definire prompt operativo (italiano, system + user, con esempi)
2. Definire schema input e schema output JSON
3. Creare workflow n8n
4. Creare/estendere tabella DB dedicata
5. Collegare al Direttore Operativo (flag di attivazione)
6. Creare vista nella dashboard admin
7. Test con casi reali (3 brief differenti)
8. Documentare in `/docs/agents/{nome}.md`

## Agente 1 — Direttore Operativo

Ruolo: capo agenzia AI, smista i task agli specialisti.

**Task da sviluppare:**

- Definire prompt sistema (riceve brief, decide quali agenti coinvolgere, produce piano)
- Schema output JSON: `{ project_id, summary, required_agents[], execution_plan[], priority, estimated_complexity, risks, missing_info }`
- Workflow n8n con nodi:
  - Webhook ingresso brief
  - Recupero contesto (cliente, storico, listino) da MySQL
  - Chiamata LLM con prompt
  - Routing condizionale verso ciascun agente in base al campo `required_agents`
  - Aggregatore output finali
  - Persistenza in `agent_outputs` e aggiornamento `projects.stato`
- Rafforzare nodo di routing (gestire tutti i rami: Account, Finance, Strategia, Research, Creative, Publishing)
- Gestione errori robusta + retry
- Logging completo in `agent_logs`
- Vista dashboard: progetto, brief, analisi, agenti richiesti, decisione proposta, stato avanzamento
- Endpoint `GET /api/admin/projects/{id}/director-view` per dashboard

## Agente 2 — Account Manager

Ruolo: interfaccia con cliente, raccoglie e qualifica la richiesta.

**Task da sviluppare:**

- Prompt: legge messaggio cliente, identifica obiettivi, individua informazioni mancanti, propone domande di chiarimento
- Schema output JSON: `{ project_id, messaggio_cliente, motivazione_richiesta, info_mancanti[], domande_per_cliente[], stato_richiesta, sentiment, suggested_next_step }`
- Workflow n8n: webhook → LLM → salvataggio → notifica admin
- Tabella `project_account_outputs` con i campi sopra
- Collegare al sistema di approvazione (Michele approva o richiede modifiche)
- Sezione dashboard:
  - Messaggi pronti per il cliente (in attesa di invio approvato da Michele)
  - Richieste di chiarimento aperte
  - Note interne per progetto
  - Stato risposta cliente (atteso/ricevuto/scaduto)
- Sistema di template messaggi: ogni risposta cliente passa per template + LLM personalizzazione
- Trigger automatico verso Direttore Operativo quando il brief è completo

## Agente 3 — Finance/Admin Agent

Ruolo: stima prezzi, gestisce preventivi, fatture, marginalità.

**Task da sviluppare:**

- Prompt operativo: legge brief + piano del Direttore, calcola stima costi e margini, genera preventivo con gap max 15%
- Schema output JSON: `{ project_id, prezzo_min, prezzo_max, gap_pct, breakdown[{voce, agente, quantita, prezzo_unitario, prezzo_totale, opzionale}], note, conditions, valid_until }`
- Vincolo: `(prezzo_max - prezzo_min) / prezzo_min <= 0.15`
- Workflow n8n dedicato
- Lettura `services_catalog` per prezzi base
- Tabella `project_finance_outputs` (oltre a popolare `quotes` e `quote_items`)
- Collegamento al Direttore Operativo via flag `need_finance_admin: true`
- Casi da gestire:
  - budget assente nel brief → richiedere
  - budget troppo basso → proposta riduzione scope o rifiuto
  - richiesta fuori scala → escalation Michele
  - preventivo standard
  - dati cliente incompleti → blocco e richiesta info
- Generazione PDF preventivo (template brandizzato)
- Generazione fattura PDF dopo pagamento
- Promemoria pagamento automatici (3, 7, 15 gg)
- Vista dashboard: cassa, ageing fatture, marginalità per progetto, scostamento preventivo/consuntivo

## Agente 4 — Brand/Marketing Strategist

Ruolo: definisce strategia, posizionamento, tono di voce, canali, KPI.

**Task da sviluppare:**

- Prompt: legge brief + research, produce strategia consolidata
- Schema output JSON in tabella `project_strategy_outputs`:
  - `project_id, brief_id, plan_id, decision_id`
  - `strategy_summary, target_analysis, positioning, tone_of_voice`
  - `campaign_angle, recommended_channels[], kpi[]`
  - `risks[], missing_information[]`
  - `status, version`
- Workflow n8n
- Gestione errori parsing JSON (fallback con re-prompt)
- Gestione output incompleti (validazione campi obbligatori)
- Collegamento dopo strategia verso:
  - Research Agent (se servono insight)
  - Creative Lead
  - Approvazione umana (concept strategico)
- Vista dashboard: strategia per progetto con storico versioni, diff tra versioni

## Agente 5 — Research & Insights Agent

Ruolo: analisi competitor, trend, mercato, pubblico.

**Task da sviluppare:**

- Definire trigger di chiamata: chiamato da Direttore Op o da Strategist quando flag `need_research: true`
- Prompt operativo: brief target → ricerca strutturata
- Decidere fonti:
  - Web search via API (Tavily, Serper, o Anthropic web tool)
  - File interni (knowledge base brand cliente)
  - Eventualmente social listening API
- Schema output JSON: `{ project_id, competitors[{nome, posizionamento, tono, esempi_recenti}], trends[], target_insights[], white_spaces[], risks[], sources[] }`
- Workflow n8n con nodi di web search + parsing
- Tabella `project_research_outputs`
- Collegamento a Direttore, Brand/Marketing Strategist, Creative Lead
- Cache risultati ricerca per non rieseguire (TTL configurabile)

## Agente 6 — Creative Lead

Ruolo: definisce concept creativo, coordina copy/design/video, mantiene coerenza.

**Task da sviluppare:**

- Prompt: legge strategia + research, produce concept e brief creativi per ciascun specialist
- Schema output JSON: `{ project_id, concept_principale, alternative_concepts[], brief_copy, brief_design, brief_video, brief_audio, mood_keywords, must_haves, must_avoids }`
- Workflow n8n
- Tabella `project_creative_outputs`
- Collegamento a:
  - Direttore Operativo (riceve task)
  - Copy Agent (riceve brief copy)
  - Art & Design Agent (riceve brief design)
  - Video/Audio Agent (riceve brief video/audio)
- Stabilire trigger di approvazione umana sul concept (sempre attivo in V1, configurabile in V2)
- Vista dashboard: concept con varianti, stato approvazione, brief generati per specialist

## Agente 7 — Copy Agent

Ruolo: scrive headline, copy social, script video, landing, email, claim.

**Task da sviluppare:**

- Prompt operativo per ciascun deliverable supportato
- Schema output JSON: `{ project_id, deliverable_type, language, variants[{title, body, cta, length, tags}], rationale }`
- Tipi di deliverable supportati in V1:
  - post social (per piattaforma: IG, FB, LinkedIn, TikTok caption, X)
  - landing page (sezioni: hero, value prop, features, social proof, CTA)
  - script video (durata, scene, dialoghi, didascalie)
  - adv (varianti A/B con headline + body + CTA)
  - newsletter (oggetto + preheader + body + CTA)
  - brochure (struttura sezioni)
- Workflow n8n con routing per tipo
- Salvataggio in `deliverables` + payload in `agent_outputs`
- Generazione 2-3 varianti per ogni copy (A/B/C)
- Approvazione umana sui testi finali prima di consegna cliente
- Integrazione con QA Agent per controllo errori

## Agente 8 — Art & Design Agent

Ruolo: produce direzione artistica + asset grafici statici (banner, post visual, presentazioni, cover).

**Task da sviluppare:**

- Prompt direzione artistica: definisce stile, palette, tipografia coerente al brand
- Prompt generazione: produce prompt per modelli image (DALL-E, Midjourney via API, Flux, Stable Diffusion)
- Schema output JSON: `{ project_id, art_direction:{moodboard_refs, palette, typography, style_keywords}, assets[{tipo, formato, prompt_usato, path_storage, varianti[]}] }`
- Workflow n8n con:
  - Step 1 art direction (LLM)
  - Step 2 generazione immagini (image API)
  - Step 3 post-process: ridimensionamento, multi-format export (1:1, 9:16, 16:9, 4:5)
  - Step 4 salvataggio storage + DB
- Adattamento multi-formato automatico per canali social
- Collegamento al Creative Lead
- Approvazione umana su selezione asset finali
- Tabella output condivisa `project_creative_outputs` o dedicata

## Agente 9 — Video/Audio Agent

Ruolo unificato in V1: storyboard + montaggio + voiceover + motion base.

**Task da sviluppare:**

- Sotto-funzioni:
  - **Storyboard:** prompt → scaletta scene + descrizione visual + durata
  - **Generazione video:** integrazione con Runway/Sora/Pika/Veo via API per generazione clip
  - **Editing:** orchestrazione FFmpeg lato server (taglio, sync audio, sottotitoli, export 9:16/1:1/16:9)
  - **Voiceover:** integrazione TTS (ElevenLabs, OpenAI Voice, Azure) con scelta voce coerente al tono
  - **Sottotitoli:** generazione automatica + traduzione multilingua
  - **Motion graphics base:** template After Effects o Lottie generati programmaticamente
- Schema output JSON: `{ project_id, storyboard[], scenes[{descrizione, prompt, clip_path, durata}], audio_tracks[], final_videos[{formato, path_storage, durata}], subtitles[] }`
- Workflow n8n articolato (può essere più sub-workflow)
- Salvataggio in storage `working` durante elaborazione, in `deliverables` dopo QA
- Approvazione umana sul cut finale prima della consegna

## Agente 10 — Publishing & Performance Agent

Ruolo: pubblica/programma sui canali, gestisce ad campaigns, raccoglie KPI.

**Task da sviluppare:**

- Sotto-funzioni:
  - **Publishing:** integrazione Meta Graph API, LinkedIn API, TikTok Business API, X API, Buffer/Hootsuite come fallback
  - **Calendario editoriale:** generazione automatica con date ottimali per pubblico
  - **Media planning:** struttura ad campaign (audience, budget split, formati, varianti creative)
  - **Performance tracking:** poll API piattaforme + salvataggio metriche in `campaign_metrics`
  - **Reporting:** generazione report periodici con insight e raccomandazioni
- Schema output JSON: `{ project_id, publishing_plan[], scheduled_posts[], campaigns[{piattaforma, budget, target, ad_sets[], creatives[]}], reports[] }`
- Comunicazione bidirezionale con: Strategia, Direttore Operativo, Account Manager
- Tabella `campaigns` + `campaign_metrics`
- Gestione **blocco cliente**: se cliente blocca social/press, pausa campagne attive e flagga preventivo da rimodulare

---

# FASE 3 — Workflow end-to-end

## 3.1 Brief intake e approvazione iniziale

- Form Next.js cliente: titolo, descrizione, obiettivi, deliverable richiesti, budget indicativo, deadline, upload file reference
- Validazione lato server (Zod) + storage upload
- Creazione `project` con stato `in_attesa_approvazione_admin`
- Notifica email + dashboard a Michele
- Schermata Michele: brief completo + preview file + bottoni `Approva` / `Richiedi modifiche` / `Rifiuta`
- Su Approva → trigger Direttore Operativo → analisi → ramo Account Manager / Finance / Strategy

## 3.2 Stima prezzo e accettazione cliente

- Direttore Op chiama: Account Manager + Strategy + Research (se serve) + Finance/Admin
- Finance/Admin produce preventivo con gap max 15% basato sui costi stimati di tutti gli agenti coinvolti
- Generazione PDF preventivo (template brandizzato Kansei)
- Stato `preventivo_inviato`, notifica cliente
- Cliente vede preventivo in dashboard cliente: bottoni `Accetta` / `Richiedi modifiche` / `Rifiuta`
- Su Accetta:
  - generazione record in `invoices` (anticipo o saldo finale, definire policy)
  - integrazione Stripe/PayPal/bonifico per pagamento
  - stato progetto → `preventivo_accettato` → `in_produzione`
  - trigger Direttore Op per kickoff produzione

## 3.3 Produzione

- Direttore Op orchestra in sequenza/parallelo gli agenti coinvolti
- Ogni output passa da QA Agent (controllo errori, coerenza brand, completezza asset)
- Approvazioni umane intermedie nei punti sensibili (concept creativo, testi finali, materiali finali)
- Tutto tracciato in `production_runs` e `agent_outputs`
- Dashboard mostra avanzamento per agente

## 3.4 Consegna e revisioni

- Quando QA passa, deliverable status `qa_passed` → notifica cliente con preview (watermark/lo-res se non pagato)
- Cliente vede 3 round di revisione gratuiti rimanenti
- Form revisione: seleziona deliverable, descrive modifica, allega riferimenti
- Round 1, 2, 3 → tipo `incluso`, gratuiti
- Round 4+ → tipo `extra_a_pagamento`, prezzo da `services_catalog` (es. fee fisso o calcolato)
- Cliente sceglie: `Pago il round extra` oppure `Accetto il lavoro così com'è`
- Ogni revisione triggera nuovamente l'agente competente (es. Copy se modifica testi)

## 3.5 Blocco campagne sociali / stampa

- In dashboard cliente, durante produzione o al ricevimento del preventivo, opzione `Blocca campagna social` / `Blocca campagna stampa`
- Su click:
  - record in `client_blocks`
  - Finance/Admin ricalcola preventivo escludendo voci bloccate
  - cliente vede nuovo importo, lo conferma
  - Direttore Op rimuove dal piano i task degli agenti coinvolti
  - se la campagna era già partita, Publishing & Performance la mette in pausa

## 3.6 Pagamento e download

- Materiali finali in `deliverables` con status `consegnato`
- Cliente vede tutti i materiali ma con preview/watermark
- Bottone `Paga e scarica`
- Dopo conferma Stripe/PayPal/bonifico → `payments.status = succeeded`
- Sistema genera signed URL per ogni deliverable (TTL 7 giorni, rinnovabile)
- Cliente scarica file in alta qualità
- Generazione fattura PDF + invio mail

---

# FASE 4 — Dashboard amministratore (Michele)

Sezioni richieste:

## 4.1 Home / Overview

- KPI in tempo reale: progetti attivi, in attesa di approvazione, in revisione, fatturato mese, fatturato anno, ageing fatture
- Lista approvazioni pendenti (badge rosso, ordinata per priorità)
- Alert: errori agenti, sforamenti budget, deadline a rischio

## 4.2 Progetti

- Lista filtrabile e ordinabile per stato, cliente, data, valore
- Detail page progetto con tab:
  - **Brief & file** — input cliente
  - **Analisi** — output Direttore Operativo, agenti coinvolti, piano
  - **Strategia** — output Brand/Marketing Strategist + Research
  - **Creativo** — concept, copy, design, video con preview
  - **Preventivo & fatture** — quote, invoices, payments
  - **Revisioni** — round usati, richieste, costi extra
  - **Timeline** — tutti gli eventi del progetto in ordine cronologico
  - **Logs agenti** — drill-down tecnico

## 4.3 Clienti

- Anagrafica + storico progetti + LTV + soddisfazione + payment status
- Quick actions: nuovo progetto manuale, nota interna, blocco

## 4.4 Agenti

- Stato salute per ogni agente (success rate, errori ultimi 7gg, latenza media)
- Versioning prompt: ogni agente ha versioni di prompt comparabili
- Editor prompt per Michele (con preview e test sandbox)
- Console n8n embedded per debug

## 4.5 Token & costi

Sezione dedicata al monitoraggio del consumo (vedi 1.2 per architettura sottostante).

- **Top KPI:** token totali oggi/settimana/mese, costo totale (USD/EUR), costo medio per progetto, modello più costoso, run più costosa del giorno
- **Time-series consumo token:** grafico stacked area per giorno, suddiviso per agente, con toggle USD/EUR e toggle token/costo
- **Breakdown per agente:** tabella con (agente, n. run, token totali, costo totale, costo medio per run, latenza media, success rate)
- **Breakdown per progetto:** (progetto, cliente, token consumati, costo accumulato, importo preventivo, % consumato vs preventivato, marginalità stimata)
- **Breakdown per provider/modello:** (provider, modello, token, costo, % sul totale)
- **Costi non-LLM:** sezione separata per image/video/audio/search con costo per unità e totale
- **Soglie e alert:** lista alert attivi e storici, configurazione soglie da UI
- **Drill-down per run:** click su qualunque run apre la pagina con prompt (troncato/espandibile), risposta, token, costo, latenza, errori, link al log n8n
- **Export CSV** per analisi offline e contabilità

## 4.6 Finanziaria

- Cash flow, fatturato per servizio, marginalità per progetto, scostamento preventivo/consuntivo
- **Costo agenti per progetto** (alimentato da `token_usage` + `external_api_usage`) come voce di costo nel calcolo marginalità
- Export contabile (CSV per commercialista)

## 4.7 Approvazioni

- Coda unica con tutti i punti decisionali pendenti
- Per ognuno: contesto, output proposto, bottoni Approva/Modifica/Rifiuta + commento

---

# FASE 5 — Frontend cliente

## 5.1 Onboarding

- Registrazione + verifica email
- Profilo azienda (anagrafica fatturazione)
- Magic link per accessi successivi

## 5.2 Nuovo progetto

- Form brief multi-step con validazioni
- Upload reference (drag&drop, max N file, max size)
- Riepilogo prima dell'invio

## 5.3 Dashboard cliente

- Lista progetti con stato visuale (timeline)
- Dettaglio progetto con tab:
  - **Stato** — dove siamo nel ciclo
  - **Preventivo** — view + accetta/rifiuta
  - **Anteprime** — deliverable in preview
  - **Revisioni** — form per richiedere modifiche, contatore round
  - **Pagamenti** — fatture + bottone paga
  - **Download** — solo se pagato
  - **Messaggi** — chat con Account Manager (AI mediato da Michele)

## 5.4 Pagamenti

- Integrazione Stripe (preferito) o equivalente
- Possibilità di pagamento con bonifico (status `pending` finché non confermato manualmente)

---

# FASE 6 — QA, hardening, deploy

## 6.1 Test

- Unit test su funzioni critiche (calcolo preventivo, validazione gap 15%, gating download)
- Integration test sui workflow n8n principali (mock LLM responses)
- E2E test su flusso completo cliente (Playwright): brief → approvazione → preventivo → produzione → pagamento → download

## 6.2 Sicurezza

- Audit dipendenze (npm audit, Snyk)
- Rate limiting su API pubbliche
- CSRF, CORS, security headers
- Verifica RBAC su ogni endpoint
- Encryption at rest sui file sensibili
- Backup DB testati (restore drill)

## 6.3 Deploy

- Vercel per Next.js (admin + client)
- VPS dedicato o Docker host per n8n
- DB MySQL su provider gestito (PlanetScale, RDS, o self-hosted)
- CI/CD con GitHub Actions: test → build → deploy staging → smoke test → deploy prod manuale

## 6.4 Monitoring post-launch

- Sentry per errori app
- Uptime monitoring (Better Stack o equivalente)
- Alert su health agenti
- Dashboard interna metriche di prodotto (progetti settimana, conversion preventivo→accettato, etc.)

---

# FASE 7 — Espansione V2 (figure aggiuntive)

Una volta consolidata la V1, aggiungere progressivamente questi agenti, secondo l'ordine di priorità di business:

## Direzione e coordinamento

- **Project Manager** dedicato (oggi assorbito dal Direttore Operativo): milestone, scadenze, blocchi, report

## Area commerciale

- **Sales / Business Development Agent**: lead qualification, proposte commerciali, follow-up
- **Customer Success Agent**: monitoraggio soddisfazione, upsell, rinnovi

## Area amministrativa

- **Controllo di Gestione Agent**: marginalità, alert sforamenti, analisi economica avanzata
- **Legal/Compliance Agent**: privacy, licenze immagini/audio, claim pubblicitari, alert normativi

## Area editoriale (split del Copy)

- **Editor / Content Editor**: corregge tono, semplifica, uniforma stile, verifica errori
- **Social Media Content Agent**: piano editoriale, format social, calendario, caption/hashtag/CTA
- **SEO Content Agent**: keyword research, struttura articoli, ottimizzazione, cluster editoriali

## Area visual e multimediale (split del Art&Design e Video/Audio)

- **Art Director**: stile visivo, look and feel, allineamento brand
- **Graphic Designer Agent**: produzione asset statici (banner, post, slide, cover)
- **Image Generation Agent**: generazione AI dedicata, varianti, prompt riusabili
- **Video Producer Agent**: storyboard, scene, formati, coordinamento
- **Video Editing Agent**: montaggio, sync, sottotitoli, versioni multipiattaforma
- **Audio / Voice Agent**: voiceover, TTS, pulizia audio, multilingua, podcast
- **Motion Designer Agent**: animazioni, titolazioni, motion graphics, visual dinamici

## Area media e performance

- **Media Planner / Advertising Agent** dedicato: setup campagne, segmenti, ad set, ottimizzazioni
- **Publishing Agent** standalone: CMS, social scheduling, metadata
- **Community / Engagement Agent**: risposta commenti, FAQ, smistamento messaggi, alert crisi
- **Analytics Agent** standalone: KPI, dashboard performance, raccomandazioni

## Area qualità e supporto interno

- **QA / Quality Assurance Agent**: errori, coerenza brand, formati, completezza asset
- **Knowledge Manager Agent**: SOP, brand book, template, best practice, casi studio
- **Prompt / Workflow Designer Agent**: ottimizzazione prompt e flussi degli altri agenti, miglioramento continuo

---

# Cronologia di build consigliata (per fare ordine)

**Sprint 0 (1-2 settimane)** — Fase 0 completa: repo, DB, n8n, Next.js, storage, auth.

**Sprint 1 (2-3 settimane)** — Fase 1: schema DB completo, template agente, bus eventi, **sistema tracking token/costi (1.2) attivo dal giorno 1** così che ogni agente già nato lo erediti, prima vista admin scheletrica.

**Sprint 2 (3-4 settimane)** — Direttore Operativo + Account Manager + Finance/Admin + flusso brief→preventivo end-to-end (anche senza tutti gli agenti specialisti).

**Sprint 3 (3-4 settimane)** — Brand/Marketing Strategist + Research Agent + Creative Lead. Approvazioni umane funzionanti.

**Sprint 4 (4-6 settimane)** — Copy Agent + Art & Design Agent + Video/Audio Agent. QA basilare. Primo progetto reale completabile.

**Sprint 5 (3-4 settimane)** — Publishing & Performance + dashboard admin completa + frontend cliente completo.

**Sprint 6 (2-3 settimane)** — Pagamento, gating download, fatture, revisioni a pagamento, blocchi cliente.

**Sprint 7 (2 settimane)** — QA, hardening, deploy produzione.

**Sprint 8+ (continui)** — Fase 7: progressiva sostituzione agenti V1 monolitici con agenti specialisti V2.

---

# Decisioni prese (chiuse il 2026-05-08)

1. **Provider LLM:** **mix Anthropic + OpenAI**. Anthropic come primario testuale (Sonnet sui ruoli intelligenti, Haiku sugli operativi), OpenAI per multimodale e Structured Outputs garantiti. Niente budget mensile fissato, ma tracking sempre attivo + safety anti-loop (alert su singola run > $5).
2. **Provider image/video gen:**
   - **Immagini:** Nano Banana (Gemini 2.5 Flash Image via Google AI API) + Seedance.
   - **Video:** Seedance, Kling, Wan.
   - **Strategia integrazione:** in V1 accesso a Seedance/Kling/Wan **tramite aggregator fal.ai** (singola API key, billing unificato, latenza migliore). Integrazione diretta solo dopo aver validato il modello-cavallo. Wan è open-source: opzione self-hosting in futuro.
3. **Storage:** **self-hosted in dev** (filesystem locale macchina di sviluppo), **portabilità garantita** verso S3/server esterno tramite interfaccia astratta `StorageProvider` con implementazioni `LocalFsProvider` e `S3Provider` switchabili via env. La produzione **non** può restare sulla macchina di sviluppo: decisione di location prod prima del go-live (candidato: stesso VPS di n8n, oppure S3).
4. **Pagamenti:** **Stripe per i ricorrenti** (Stripe Subscriptions), **Stripe + PayPal per gli one-shot**. PayPal escluso dai ricorrenti per fragilità delle subscription PayPal.
5. **Hosting n8n:** **VPS dedicato** Ubuntu 22.04, sizing minimo 4 vCPU / 8 GB RAM / 80 GB SSD, Docker, **Postgres come metadata DB** (mai SQLite), backup automatici, reverse proxy HTTPS.
6. **Policy approvazioni:** **Michele approva tutti i checkpoint sensibili in V1**. Architettura predisposta per automazione progressiva: tabella `approval_policies` con flag `automatic = false/true` per checkpoint, in V1 tutti false, in futuro toggle senza modifica codice.
7. **Pricing model:** **mix one-shot + ricorrenti**.
   - One-shot: lavori puntuali (logo, set immagini, singolo video).
   - Ricorrenti: piani mensili (es. "X post social/mese", "Y reel/mese").
   - Implicazioni schema: nuove tabelle `subscription_plans`, `subscriptions`, `projects.project_type` ENUM (`one_shot`, `recurring_cycle`).
   - Ogni ciclo ricorrente genera un child project che riusa la pipeline standard.
8. **Multi-lingua:** **bilingue IT/EN dal V1**. Libreria **next-intl** sul frontend, locale routing, prompt agenti language-aware, template PDF/email tradotti.
9. **Branding frontend cliente:** **identità Kansei-Studio**. Asset da consegnare a inizio fase frontend: logo SVG, palette colori, font, eventuale design system Figma esistente.
10. **services_catalog:** **definito da Michele in seconda fase**. Non è blocker per partire: Finance/Admin parte con seed prices hardcoded, sostituiti da lookup DB quando il listino è pronto.
11. **Soglie costi:**
    - **Pre-flight estimator** sul preventivo: stima costo agenti basata su catalogo (in V1 con tabelle euristiche tarate da Michele).
    - **Real-time monitor:** flag giallo a 100% del consumato vs stimato, **flag rosso a 130%** con notifica a Michele e bottoni `Continua`/`Sospendi`.
    - **Hard stop di sicurezza** a 200% (configurabile): auto-sospensione del workflow + sblocco manuale richiesto. Non è auto-decision, è prevenzione disastro.
12. **Pricing tracking:** file **`pricing.yaml` versionato nel repo**, aggiornato manualmente al primo del mese, **cron mensile** che alza warning se il file ha età > 35 giorni. No scraper (fragile), no servizi terzi (overhead).

---

# Asset e accessi richiesti a Michele per partire

Da raccogliere in parallelo allo Sprint 0, prima del go-live di ogni fase:

- **Sprint 0:** account VPS (provider scelto + credenziali SSH), domini per dashboard admin e portale cliente, account Stripe (modalità test ok per iniziare), account PayPal Business, account Anthropic + OpenAI + Google AI + fal.ai con API key, provider mail transazionale (consiglio Resend o Postmark).
- **Prima frontend (Fase 5):** logo SVG, palette colori, font, design system o moodboard.
- **Prima Finance/Admin live:** `services_catalog` con prezzi base per ciascun servizio offerto.
- **Prima Subscription live:** elenco piani ricorrenti tipici e relativi prezzi.

---

_Fine roadmap V1. Documento vivo: aggiornare a ogni decisione presa o cambio di scope._
