# Kansei-Studi Agency

![Image from Kansei-Studi Agency](https://app.milanote.com/media/p/images/1WcFem147hRa7H/O0W/Kansei-studio_Logo.png?w=800)

## Direttore operativo

Direzione e coordinamento

TO DO

### Task da effettuare

- Completare il workflow del Direttore Operativo in n8n.

- Rafforzare il nodo di routing.

- Gestire tutti i possibili rami:
  - Account Manager;

  - Finance/Admin;

  - Strategia;

  - Research;

  - Creative Lead;

  - Publishing/Performance.

- Aggiungere logging più completo.

- Gestire meglio gli errori.

- Salvare ogni passaggio importante nel database.

- Collegare il Direttore Operativo alla dashboard Next.js.

- Creare una vista dove tu puoi vedere:
  - progetto;

  - brief;

  - analisi;

  - agenti richiesti;

  - decisione proposta;

  - stato di avanzamento.

**Cosa fa**

- riceve la richiesta del cliente

- interpreta obiettivi, budget, tempi, priorità

- decide quali agenti coinvolgere

- distribuisce i task

- controlla lo stato di avanzamento

- raccoglie gli output e compone il risultato finale

**Input**

- brief cliente

- documenti allegati

- storico cliente

- stato ordini/progetti

**Output**

- piano di lavoro

- assegnazione task

- timeline

- consegna finale coordinata

**Comunica con**

- tutti gli agenti

**Nota**\
Questo è il “capo agenzia” AI.

## Project Manager

Direzione e coordinamento

**Cosa fa**

- organizza milestone

- controlla scadenze

- segnala blocchi

- coordina revisioni e approvazioni

**Output**

- stato progetto

- reminder

- avanzamento task

- report operativi

## Account Manager

Area commerciale e clienti

TODO

### Task da effettuare

- Completare definitivamente il workflow n8n dell’Account Manager.

- Stabilire il formato JSON standard dell’output.

- Salvare nel database:
  - messaggio cliente;

  - motivazione della richiesta;

  - informazioni mancanti;

  - stato della richiesta.

- Collegare Account Manager al sistema di approvazione.

- Creare nella dashboard una sezione per:
  - messaggi pronti per il cliente;

  - richieste di chiarimento;

  - note interne;

  - stato risposta cliente.

**Cosa fa**

- riceve la richiesta del cliente

- interpreta obiettivi, budget, tempi, priorità

- decide quali agenti coinvolgere

- distribuisce i task

- controlla lo stato di avanzamento

- raccoglie gli output e compone il risultato finale

**Input**

- brief cliente

- documenti allegati

- storico cliente

- stato ordini/progetti

**Output**

- piano di lavoro

- assegnazione task

- timeline

- consegna finale coordinata

**Comunica con**

- tutti gli agenti

**Nota**\
Questo è il “capo agenzia” AI.

## Sales / Business Development Agent

Area commerciale e clienti

**Cosa fa**

- qualifica lead

- prepara proposte

- suggerisce pacchetti di servizi

- aiuta nella chiusura commerciale

**Output**

- preventivi

- offerte

- proposte commerciali

- follow-up

## Customer Success Agent

Area commerciale e clienti

**Cosa fa**

- monitora soddisfazione

- propone upsell

- suggerisce rinnovi

- controlla risultati ottenuti

## Account Manager

Area amministrativa e finanziaria

**Cosa fa**

- crea preventivi

- genera ordini

- controlla stato pagamenti

- prepara fatture

- verifica margini e costi

**Input**

- listino

- servizi venduti

- dati cliente

- stato progetto

**Output**

- preventivi

- fatture

- promemoria pagamento

- report economici

**Comunica con**

- Account Manager

- Direttore operativo

- Controllo di gestione

## Controllo di gestione

Area amministrativa e finanziaria

**Cosa fa**

- controlla costi per progetto

- stima redditività

- verifica tempo/lavoro speso

- individua servizi più profittevoli

**Output**

- report marginalità

- alert su sforamenti

- analisi economica

## Legal / Compliance Agent

Area amministrativa e finanziaria

- Definire prompt e responsabilità del Finance/Admin Agent.

- Creare workflow n8n dedicato.

- Definire output JSON.

- Collegarlo al Direttore Operativo tramite flag:

```

```

```
need_finance_admin
```

- Creare eventuale tabella dedicata oppure salvare gli output in una tabella generica di agent outputs.

- Gestire casi come:
  - budget assente;

  - budget troppo basso;

  - richiesta fuori scala;

  - necessità di preventivo;

  - dati cliente incompleti.

**Cosa fa**

- controlla privacy

- verifica uso corretto di immagini/audio/licenze

- controlla claim pubblicitari

- segnala rischi normativi

**Output**

- check conformità

- alert legali

- approvazione o blocco contenuti

# Direttore Operativo

## Brand Strategist

Area strategica

**Cosa fa**

- analizza brand

- stabilisce tono di voce

- definisce messaggi chiave

- costruisce posizionamento

**Output**

- linee guida brand

- tone of voice

- messaging framework

### Task da effettuare

- Completare la tabella `project_strategy_outputs`.

- Stabilire definitivamente i campi:
  - project_id;

  - brief_id;

  - plan_id;

  - decision_id;

  - strategy_summary;

  - target_analysis;

  - positioning;

  - tone_of_voice;

  - campaign_angle;

  - recommended_channels;

  - risks;

  - missing_information;

  - status;

  - version.

- Collegare l’output alla dashboard.

- Fare in modo che, dopo la strategia, il progetto possa passare a:
  - Research Agent;

  - Creative Lead;

  - approvazione umana.

- Gestire gli errori di parsing JSON.

- Gestire output incompleti o non validi.

## Marketing Strategist

Area strategica

**Cosa fa**

- definisce funnel

- individua target

- sceglie canali

- imposta KPI

- costruisce campagne

**Output**

- piano marketing

- strategia campagna

- obiettivi misurabili

## Research & Insights Agent

Area strategica

**Cosa fa**

- analizza competitor

- cerca trend

- raccoglie insight di mercato

- studia pubblico e nicchie

**Output**

- report competitor

- analisi mercato

- trend report

- insight per creativi e strategist

### Task da effettuare

- Definire quando viene chiamato.

- Creare il prompt operativo.

- Creare workflow n8n dedicato.

- Definire output JSON.

- Decidere se deve usare ricerca web, file interni o entrambi.

- Creare tabella dedicata, ad esempio:

```

```

```
project_research_outputs
```

- Collegarlo a:
  - Direttore Operativo;

  - Brand/Marketing Strategist;

  - Creative Lead.

## Creative Director

Area creativa editoriale

**Cosa fa**

- definisce concept

- approva linee creative

- controlla coerenza dell’identità

- coordina copy e visual

**Output**

- concept creativo

- linee creative

- approvazione finale

### Task da effettuare

- Creare workflow n8n dedicato.

- Definire prompt.

- Definire output JSON.

- Creare tabella dedicata, ad esempio:

```

```

```
project_creative_outputs
```

- Collegarlo al Direttore Operativo.

- Collegarlo agli agenti:
  - Copy;

  - Art & Design;

  - Video/Audio.

- Stabilire quando serve approvazione umana sul concept creativo.

## Copywriter

Area creativa editoriale

**Cosa fa**

- scrive headline

- testi social

- script video

- landing page

- email

- claim pubblicitari

**Output**

- contenuti testuali pronti

- varianti A/B

- script

### Task da effettuare

- Creare workflow dedicato.

- Definire prompt.

- Definire output JSON.

- Definire tipi di deliverable supportati:
  - post social;

  - landing;

  - script video;

  - adv;

  - newsletter;

  - brochure.

- Collegarlo al Creative Lead.

- Prevedere approvazione umana sui testi finali.

## Editor / Content Editor

Area creativa editoriale

**Cosa fa**

- corregge tono

- semplifica

- uniforma stile

- verifica errori

**Output**

- versione finale dei testi

## Social Media Content Agent

Social Media Content Agent

**Cosa fa**

- trasforma la strategia in format social

- adatta i testi al canale

- crea calendario editoriale

- suggerisce caption, hashtag, CTA

**Output**

- piano editoriale

- post

- caption

- serie contenuti

## SEO Content Agent

Social Media Content Agent

**Cosa fa**

- ricerca keyword

- struttura articoli

- ottimizza contenuti

- suggerisce cluster editoriali

**Output**

- articoli SEO

- meta title

- meta description

- brief per blog/content hub

## Media Planner / Advertising Agent

Area media, distribuzione e performance

**Cosa fa**

- struttura campagne

- segmenta target

- prepara ad set e creatività

- controlla performance

- propone ottimizzazioni

**Output**

- setup campagne

- varianti ads

- report performance

## Publishing Agent

Area media, distribuzione e performance

Pubblica o prepara la pubblicazione.

**Cosa fa**

- carica contenuti su CMS/social

- programma pubblicazioni

- aggiorna pagine

- controlla metadata e formati

**Output**

- contenuti pubblicati o schedulati

## Community / Engagement Agent

Area media, distribuzione e performance

Se vuoi presidiare anche l’interazione.

**Cosa fa**

- risponde a commenti

- gestisce FAQ

- smista messaggi

- segnala crisi o richieste sensibili

## Analytics Agent

Area media, distribuzione e performance

Misura risultati.

**Cosa fa**

- raccoglie dati

- legge KPI

- confronta performance

- segnala opportunità e criticità

**Output**

- dashboard

- insight

- report

- raccomandazioni

## QA / Quality Assurance Agent

Area qualità, conoscenza e supporto interno

Controlla che tutto sia corretto.

**Cosa fa**

- verifica errori

- controlla coerenza brand

- controlla formati

- verifica presenza di tutti gli asset

**Output**

- approvazione qualità

- lista correzioni

## Knowledge Manager Agent

Area qualità, conoscenza e supporto interno

Gestisce la conoscenza interna.

**Cosa fa**

- organizza SOP

- mantiene brand book

- aggiorna template

- salva best practice e casi studio

**Output**

- base di conoscenza pulita

- procedure aggiornate

## Prompt / Workflow Designer Agent

Area qualità, conoscenza e supporto interno

**Cosa fa**

- migliora prompt

- ottimizza flussi

- controlla qualità output degli altri agenti

- aggiorna logiche operative

## La V1 reale da cui stiamo partendo

Per la prima versione avevamo compattato tutto in 10 figure operative.

### V1

1.  Direttore Operativo

2.  Account Manager

3.  Finance/Admin Agent

4.  Brand/Marketing Strategist

5.  Research Agent

6.  Creative Lead

7.  Copy Agent

8.  Art & Design Agent

9.  Video/Audio Agent

10. Publishing & Performance Agent

Questa è la struttura minima funzionante.

---

## 14. Collegamenti nella V1

### Tu

↓

### Direttore Operativo

↓

- Account Manager

- Finance/Admin

- Brand/Marketing Strategist

- Research Agent

- Creative Lead

- Publishing & Performance

### Creative Lead

↓

- Copy Agent

- Art & Design Agent

- Video/Audio Agent

### Publishing & Performance

↔ Strategia\
↔ Direttore Operativo\
↔ Account Manager

---

## 15. Catena corretta di un progetto

### Caso standard

Cliente\
→ Account Manager\
→ Direttore Operativo\
→ Strategia / Research\
→ Creative Lead\
→ Copy / Design / Video\
→ QA / Publishing\
→ Analytics\
→ Account Manager\
→ Cliente

E nei punti sensibili:\
→ **tu approvi**

---

## 16. Regola fondamentale dei collegamenti

Il modello corretto è questo:

- **molti agenti specialisti**

- **pochi canali di comando**

- **un solo centro di coordinamento**

- **un solo decisore umano finale**

Quindi:

- gli specialisti non dovrebbero auto-organizzarsi liberamente

- il Direttore Operativo smista

- tu validi

---

## 17. Mappa sintetica finale

### Centro

- Tu

- Direttore Operativo

### Attorno al centro

- Account

- Admin

- Strategia

- Ricerca

- Creatività

- Publishing/Performance

- QA

- Supporto

### Sotto-rami

- Creatività → Copy / Design / Video / Audio

- Strategia → Brand / Marketing / Research

- Performance → Media / Publishing / Analytics

Table element string placeholder

## Art Director

Area creativa visuale e multimediale

**Cosa fa**

- definisce stile visivo

- decide look and feel

- allinea visual al brand

**Output**

- direzione artistica

- moodboard

- linee visual

### Task da effettuare

- Creare workflow n8n.

- Definire prompt.

- Definire output JSON.

- Stabilire se produrrà solo indicazioni testuali o anche prompt immagine.

- Collegarlo al Creative Lead.

- Collegarlo eventualmente a strumenti di generazione visual.

- Creare tabella dedicata o usare una tabella comune per gli output creativi.

## Graphic Designer Agent

Area creativa visuale e multimediale

Produce materiali grafici statici.

**Cosa fa**

- banner

- post visual

- presentazioni

- cover

- adattamenti multiformato

**Output**

- asset grafici pronti

## Image Generation Agent

Area creativa visuale e multimediale

Genera immagini con modelli AI.

**Cosa fa**

- crea immagini coerenti al brand

- produce variazioni

- esegue adattamenti per diversi canali

**Output**

- immagini generate

- varianti creative

- prompt riutilizzabili

## Video Producer Agent

Image Generation Agent

Gestisce il flusso video.

**Cosa fa**

- crea storyboard

- organizza scene

- definisce formati

- coordina montaggio o generazione video

**Output**

- storyboard

- scaletta scene

- video draft

## Video Editing Agent

Image Generation Agent

Si occupa del montaggio e delle versioni finali.

**Cosa fa**

- taglia

- sincronizza

- adatta formato

- crea sottotitoli

- produce versioni per piattaforme diverse

**Output**

- video finali

- short version

- vertical/horizontal cuts

## Audio / Voice Agent

Image Generation Agent

Gestisce audio e voce.

**Cosa fa**

- voiceover

- sintesi vocale

- pulizia audio

- adattamento multilingua

- podcast o spot audio

**Output**

- tracce audio

- voiceover

- adattamenti lingua/tono

## Motion Designer Agent

Image Generation Agent

**Cosa fa**

- animazioni

- titolazioni

- motion graphics

- visual dinamici

Table element string placeholder

Table element string placeholder
