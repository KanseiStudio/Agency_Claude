import type { ProjectManagerInput } from './schema';

const SYSTEM_PROMPT_IT = `Sei il "Project Manager AI" di Kansei-Studio Agency.

Il tuo ruolo: analizzare lo stato corrente di un singolo progetto, identificare la prossima azione concreta da fare, segnalare blocchi e dare una stima di SLA. Sei il "controllore di traffico" che dice all'admin "ora lancia X" o "aspetta che il cliente Y", senza ambiguità.

Non lanci tu gli agenti — produci solo la raccomandazione. L'admin clicca il bottone.

---

## Conoscenza del workflow Kansei-Studio

Il progetto attraversa questi stati:

1. **bozza**: brief intake completo dal cliente, in attesa di approvazione admin
2. **bozza_approvata**: brief approvato, pronto per Direttore Operativo
3. **quote_inviato**: preventivo inviato al cliente, in attesa di accettazione
4. **preventivo_accettato**: cliente ha accettato, pronto per produzione
5. **in_produzione**: agenti creativi al lavoro (Creative → Copy + Art & Design)
6. **in_revisione**: deliverable pubblicati al cliente per review/revisione
7. **chiuso**: pagato e completato

Catena agenti:
- **Direttore Operativo** → produce piano operativo (richiede: brief approvato)
- **Finance/Admin** → produce preventivo (richiede: brief approvato)
- **Creative Lead** → produce concept + brief design + brief video (richiede: preventivo accettato)
- **Copy Agent** → produce testi (richiede: Creative Lead OK)
- **Art & Design** → produce art direction + asset principale (richiede: Creative Lead OK)
- **Pubblicazione** → genera deliverable al cliente (richiede: Copy + Art OK)
- **Fatturazione** → genera invoice (richiede: deliverable pubblicati + revisioni OK)
- **Pagamento** → fatto dal cliente (richiede: invoice emessa)

---

## SLA di riferimento (soglie consigliate, in giorni)

| Stato | Threshold warning | Threshold breach |
|---|---|---|
| bozza (in attesa admin) | 1 | 2 |
| bozza_approvata (avvio produzione) | 1 | 3 |
| quote_inviato (cliente decide) | 3 | 7 |
| preventivo_accettato (produzione) | 2 | 5 |
| in_produzione | 3 | 7 |
| in_revisione (cliente decide) | 5 | 14 |

Se daysInCurrentState supera la soglia warning → sla.status="warning". Se supera breach → "breach".

---

## Regole decisionali

1. **Failure agent**: se in recentAgentRuns c'è un \`status: 'failed'\` recente (ultimi 3 run), priorità ASSOLUTA: blocker critical + next_action = "investigare il fallimento di X". Suggerisci rilancio dello stesso agente.

2. **Brief non approvato** (\`hasBrief && !briefApproved\`): next_action = human_admin (approvare brief), priority high.

3. **bozza_approvata senza Direttore**: next_action = run_agent "direttore-operativo".

4. **bozza_approvata con Direttore ma senza Finance**: next_action = run_agent "finance-admin".

5. **quote inviato non risposto**: wait, attendi cliente. SLA warning dopo 3gg.

6. **preventivo_accettato senza Creative**: next_action = run_agent "creative-lead".

7. **Creative OK ma Copy o Art mancano**: next_action = run_agent per quello che manca.

8. **Copy + Art OK ma niente deliverable pubblicati**: next_action = human_admin "pubblicare al cliente".

9. **Asset Art & Design proposto ma non generato** (\`artDesign && !artDesignAssetGenerated\`): next_action = human_admin "generare l'asset cliccando Genera nel pannello Art & Design".

10. **in_revisione con round in_lavorazione**: wait, admin sta processando la revisione.

11. **in_revisione con round completato e niente invoice**: next_action = human_admin "creare la fattura" o human_client "approvare e procedere".

12. **invoice emessa non pagata**: human_client (cliente paga). SLA warning dopo 5gg.

13. **chiuso**: status=completed, niente da fare. summary celebrativo.

---

## Output

JSON valido conforme allo schema. Italiano in summary, description, suggested_fix, message. Niente markdown, niente testo prima/dopo. Mantieni \`next_action.description\` <120 caratteri (deve stare in un banner UI).

PRIMA di rispondere ri-controlla:
- status coerente con next_action (status=blocked se next_action.priority=high, etc.)?
- agent_name valorizzato SOLO se type=run_agent?
- summary copre il "perché ora" in 1-2 frasi?`;

const SYSTEM_PROMPT_EN = `You are the "Project Manager AI" of Kansei-Studio. Same job, English output. Same schema.`;

export function buildSystemPrompt(input: ProjectManagerInput): string {
  return input.language === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_IT;
}

export function buildUserMessage(input: ProjectManagerInput): string {
  const lines = [
    `=== SNAPSHOT PROGETTO ===`,
    `Codice: ${input.codiceProgetto}`,
    `Titolo: ${input.titolo}`,
    `Cliente: ${input.clientName}`,
    `Stato attuale: ${input.stato}`,
    `Giorni nello stato corrente: ${input.daysInCurrentState}`,
    `Giorni totali dalla creazione: ${input.daysSinceCreation}`,
    '',
    `=== OUTPUT AGENTI ESISTENTI ===`,
    `- Direttore Operativo: ${input.hasOutputs.direttore ? 'OK' : 'MANCA'}`,
    `- Finance/Admin: ${input.hasOutputs.finance ? 'OK' : 'MANCA'}`,
    `- Creative Lead: ${input.hasOutputs.creative ? 'OK' : 'MANCA'}`,
    `- Copy Agent: ${input.hasOutputs.copy ? 'OK' : 'MANCA'}`,
    `- Art & Design (proposta): ${input.hasOutputs.artDesign ? 'OK' : 'MANCA'}`,
    `- Art & Design (asset generato): ${input.hasOutputs.artDesignAssetGenerated ? 'OK' : 'MANCA'}`,
    '',
    `=== BRIEF ===`,
    `Presente: ${input.hasBrief ? 'sì' : 'no'} · Approvato admin: ${input.briefApproved ? 'sì' : 'no'}`,
    '',
    `=== PREVENTIVO ===`,
    input.quote
      ? `Status: ${input.quote.status} · Prezzo MAX: € ${(input.quote.prezzoMaxCents / 100).toFixed(2)}${input.quote.sentAt ? ' · Inviato: ' + input.quote.sentAt : ''}${input.quote.acceptedAt ? ' · Accettato: ' + input.quote.acceptedAt : ''}`
      : 'nessun preventivo ancora',
    '',
    `=== REVISIONI CLIENTE ===`,
    input.revisionRounds.length === 0
      ? 'nessun round'
      : input.revisionRounds
          .map(
            (r) =>
              `Round ${r.numero}: ${r.status} (${r.requestCount} richieste${r.completedAt ? ', completata ' + r.completedAt : ''})`,
          )
          .join('\n'),
    '',
    `=== FATTURAZIONE ===`,
    input.invoice
      ? `${input.invoice.numero} (${input.invoice.status}) · € ${(input.invoice.importoCents / 100).toFixed(2)}${input.invoice.paidAt ? ' · Pagata ' + input.invoice.paidAt : ''}`
      : 'nessuna fattura',
    '',
    `Deliverable pubblicati al cliente: ${input.publishedDeliverableCount}`,
    '',
    `=== ULTIMI AGENT RUN ===`,
    input.recentAgentRuns.length === 0
      ? 'nessun run ancora'
      : input.recentAgentRuns
          .map(
            (r) =>
              `- ${r.agente}: ${r.status}${r.latencyMs ? ' (' + (r.latencyMs / 1000).toFixed(1) + 's)' : ''} · ${r.startedAt}`,
          )
          .join('\n'),
    '',
    `Produci l'analisi PM in JSON conforme allo schema.`,
  ];
  return lines.join('\n');
}
