// Mock del Project Manager.
//
// Rule-based decision tree che riflette la stessa logica del prompt LLM —
// così funziona in MOCK_LLM=true senza nessuna chiamata esterna.
//
// L'input arriva come userMessage strutturato (vedi prompt.ts). Per parsare,
// usiamo regex sui marker (es. "Stato attuale: X") perché abbiamo già il
// formato sotto controllo.

import type {
  ProjectManagerOutput,
  NextAction,
  Blocker,
} from './schema';

interface ParsedSnapshot {
  stato: string;
  daysInState: number;
  daysSinceCreation: number;
  has: {
    direttore: boolean;
    finance: boolean;
    creative: boolean;
    copy: boolean;
    artDesign: boolean;
    artDesignAssetGenerated: boolean;
  };
  hasBrief: boolean;
  briefApproved: boolean;
  quoteStatus: string | null;
  hasInvoice: boolean;
  invoiceStatus: string | null;
  deliverableCount: number;
  pendingRevisionRound: number | null; // numero del round se aperto, null altrimenti
  lastAgentFailed: { agente: string } | null;
}

export function buildMockProjectManagerResponse(userMessage: string): string {
  const s = parseSnapshot(userMessage);
  const sla = computeSla(s.stato, s.daysInState);
  const blockers: Blocker[] = [];

  let next: NextAction;
  let status: ProjectManagerOutput['status'] = 'ok';
  let currentPhase = '';
  let summary = '';

  // ----------- 1. Agent failure recente: priorità assoluta -----------
  if (s.lastAgentFailed) {
    status = 'blocked';
    currentPhase = `Errore: ${s.lastAgentFailed.agente} è fallito`;
    next = {
      type: 'human_admin',
      description: `Investigare il fallimento di "${s.lastAgentFailed.agente}" e rilanciarlo`,
      priority: 'high',
    };
    blockers.push({
      severity: 'critical',
      description: `L'ultimo run di ${s.lastAgentFailed.agente} è fallito.`,
      suggested_fix: `Apri agent_logs nel DB per leggere il messaggio di errore, sistema la causa, e rilancia.`,
    });
    summary = `Il progetto è bloccato per un errore tecnico su ${s.lastAgentFailed.agente}.`;
  }
  // ----------- 2. Brief non approvato dall'admin -----------
  else if (s.hasBrief && !s.briefApproved) {
    status = 'attention';
    currentPhase = 'Brief in attesa di approvazione admin';
    next = {
      type: 'human_admin',
      description: 'Approvare il brief del cliente per sbloccare la produzione',
      priority: 'high',
    };
    summary = 'Il cliente ha inviato il brief. Approvalo per partire con la produzione.';
  }
  // ----------- 3. bozza_approvata: serve Direttore Operativo -----------
  else if (s.stato === 'bozza_approvata' && !s.has.direttore) {
    status = 'attention';
    currentPhase = 'In attesa di eseguire il Direttore Operativo';
    next = {
      type: 'run_agent',
      description: 'Esegui il Direttore Operativo per produrre il piano operativo',
      agent_name: 'direttore-operativo',
      priority: 'high',
    };
    summary = 'Brief approvato. Lancia il Direttore Operativo come prima azione.';
  }
  // ----------- 4. Direttore OK ma manca preventivo -----------
  else if (s.has.direttore && (!s.quoteStatus || s.quoteStatus === 'draft')) {
    status = 'attention';
    currentPhase = 'In attesa generazione preventivo';
    next = {
      type: 'run_agent',
      description: 'Esegui Finance/Admin per generare il preventivo',
      agent_name: 'finance-admin',
      priority: 'high',
    };
    summary = 'Piano operativo pronto. Genera il preventivo da inviare al cliente.';
  }
  // ----------- 5. Preventivo draft: invia al cliente -----------
  else if (s.quoteStatus === 'draft') {
    status = 'attention';
    currentPhase = 'Preventivo da inviare al cliente';
    next = {
      type: 'human_admin',
      description: 'Inviare il preventivo al cliente (bottone Invia preventivo)',
      priority: 'high',
    };
    summary = 'Il preventivo è stato generato ma non è ancora stato inviato al cliente.';
  }
  // ----------- 6. Preventivo inviato: aspetta cliente -----------
  else if (s.quoteStatus === 'inviato') {
    status = sla.status === 'breach' ? 'attention' : 'ok';
    currentPhase = 'In attesa risposta cliente al preventivo';
    next = {
      type: 'wait',
      description: 'Il cliente sta valutando il preventivo. Niente azione richiesta.',
      priority: sla.status === 'breach' ? 'medium' : 'low',
    };
    summary =
      sla.status === 'breach'
        ? `Preventivo inviato da ${s.daysInState} giorni senza risposta. Considera un follow-up.`
        : 'Il cliente sta valutando il preventivo inviato.';
    if (sla.status !== 'ok') {
      blockers.push({
        severity: sla.status === 'breach' ? 'warning' : 'info',
        description: `Preventivo inviato da ${s.daysInState} giorni senza risposta.`,
        suggested_fix: 'Manda un follow-up via email/telefono al cliente.',
      });
    }
  }
  // ----------- 7. Preventivo accettato: avvia Creative -----------
  else if (s.quoteStatus === 'accettato' && !s.has.creative) {
    status = 'attention';
    currentPhase = 'In attesa di eseguire il Creative Lead';
    next = {
      type: 'run_agent',
      description: 'Esegui Creative Lead per produrre concept + brief design/video',
      agent_name: 'creative-lead',
      priority: 'high',
    };
    summary = 'Preventivo accettato. Lancia il Creative Lead per partire con la produzione.';
  }
  // ----------- 8. Creative OK ma Copy o Art mancano -----------
  else if (s.has.creative && (!s.has.copy || !s.has.artDesign)) {
    const missing = !s.has.copy ? 'copy-agent' : 'art-design';
    const desc =
      missing === 'copy-agent'
        ? 'Esegui Copy Agent per produrre i testi'
        : 'Esegui Art & Design per definire art direction + asset proposto';
    status = 'attention';
    currentPhase = `In attesa di ${missing}`;
    next = { type: 'run_agent', description: desc, agent_name: missing, priority: 'high' };
    summary = `Concept pronto dal Creative Lead. Manca ${missing} per chiudere la produzione.`;
  }
  // ----------- 9. Art proposto ma asset non generato -----------
  else if (s.has.artDesign && !s.has.artDesignAssetGenerated) {
    status = 'attention';
    currentPhase = 'Asset Art & Design da generare';
    next = {
      type: 'human_admin',
      description: 'Clicca "Genera asset" nel pannello Art & Design per produrre image/video',
      priority: 'high',
    };
    summary = 'Art direction definita. Manca la generazione effettiva dell\'asset principale.';
  }
  // ----------- 10. Copy + Art generato ma nessun deliverable pubblicato -----------
  else if (
    s.has.copy &&
    s.has.artDesignAssetGenerated &&
    s.deliverableCount === 0
  ) {
    status = 'attention';
    currentPhase = 'Deliverable pronti, da pubblicare al cliente';
    next = {
      type: 'human_admin',
      description: 'Clicca "Pubblica al cliente" per rendere visibili i deliverable',
      priority: 'high',
    };
    summary =
      'Copy e Art & Design completati. Pubblica tutto al cliente per avviare la fase di revisione.';
  }
  // ----------- 11. In revisione con round aperto -----------
  else if (s.stato === 'in_revisione' && s.pendingRevisionRound !== null) {
    status = 'attention';
    currentPhase = `Revisione cliente round ${s.pendingRevisionRound} in lavorazione`;
    next = {
      type: 'human_admin',
      description: `Processa le richieste del round ${s.pendingRevisionRound} e marcalo completato`,
      priority: 'high',
    };
    summary = `Il cliente ha inviato richieste di revisione (round ${s.pendingRevisionRound}). Sta a te chiuderle.`;
  }
  // ----------- 12. In revisione senza round aperto, senza invoice -----------
  else if (s.stato === 'in_revisione' && !s.hasInvoice) {
    status = sla.status === 'breach' ? 'attention' : 'ok';
    currentPhase = 'In attesa decisione cliente (revisione o approvazione)';
    next = {
      type: 'wait',
      description:
        'Il cliente può chiedere revisioni o cliccare "Approva e procedi" per generare fattura',
      priority: sla.status === 'breach' ? 'medium' : 'low',
    };
    summary = sla.status === 'breach'
      ? `Il cliente non risponde da ${s.daysInState} giorni. Considera un follow-up.`
      : 'Il cliente sta esaminando i deliverable.';
    if (sla.status !== 'ok') {
      blockers.push({
        severity: sla.status === 'breach' ? 'warning' : 'info',
        description: `Il cliente non interagisce da ${s.daysInState} giorni.`,
        suggested_fix: 'Manda un reminder al cliente per chiedere feedback sui deliverable.',
      });
    }
  }
  // ----------- 13. Invoice emessa non pagata -----------
  else if (s.invoiceStatus === 'emessa') {
    status = sla.status === 'breach' ? 'attention' : 'ok';
    currentPhase = 'Fattura emessa, in attesa pagamento';
    next = {
      type: 'human_client',
      description: 'Il cliente deve completare il pagamento dal suo portale',
      priority: sla.status === 'breach' ? 'medium' : 'low',
    };
    summary = sla.status === 'breach'
      ? `Fattura emessa da ${s.daysInState} giorni e non ancora pagata.`
      : 'Fattura emessa. Aspettiamo che il cliente la paghi dal portale.';
  }
  // ----------- 14. Chiuso: tutto fatto -----------
  else if (s.stato === 'chiuso' || s.invoiceStatus === 'pagata') {
    status = 'completed';
    currentPhase = 'Progetto chiuso e pagato';
    next = { type: 'completed', description: 'Niente da fare. Progetto concluso con successo.', priority: 'low' };
    summary = 'Il progetto è concluso, il cliente ha pagato. 🎉';
  }
  // ----------- Fallback: stato non riconosciuto -----------
  else {
    status = 'attention';
    currentPhase = `Stato "${s.stato}" senza azione predefinita`;
    next = {
      type: 'human_admin',
      description: 'Verifica manualmente lo stato del progetto',
      priority: 'medium',
    };
    summary = `Il progetto è nello stato "${s.stato}" ma non rientra nelle euristiche standard. Verifica.`;
  }

  const out: ProjectManagerOutput = {
    status,
    current_phase: currentPhase,
    next_action: next,
    sla,
    blockers,
    summary,
  };
  return JSON.stringify(out);
}

// ---------- helpers privati ----------

function parseSnapshot(text: string): ParsedSnapshot {
  const stato = matchLine(text, /Stato attuale:\s*(.+)/) ?? 'sconosciuto';
  const daysInState = parseIntSafe(matchLine(text, /Giorni nello stato corrente:\s*(\d+)/));
  const daysSinceCreation = parseIntSafe(matchLine(text, /Giorni totali dalla creazione:\s*(\d+)/));

  const has = {
    direttore: /Direttore Operativo:\s*OK/.test(text),
    finance: /Finance\/Admin:\s*OK/.test(text),
    creative: /Creative Lead:\s*OK/.test(text),
    copy: /Copy Agent:\s*OK/.test(text),
    artDesign: /Art & Design \(proposta\):\s*OK/.test(text),
    artDesignAssetGenerated: /Art & Design \(asset generato\):\s*OK/.test(text),
  };

  const briefLine = matchLine(text, /=== BRIEF ===\s*\n\s*Presente:\s*(.+)/);
  const hasBrief = /Presente:\s*sì/.test(text);
  const briefApproved = /Approvato admin:\s*sì/.test(text);

  // quote line: "Status: <s> · Prezzo MAX: € X..." or "nessun preventivo ancora"
  let quoteStatus: string | null = null;
  const quoteSection = text.match(/=== PREVENTIVO ===\s*\n([^\n]+)/);
  if (quoteSection && quoteSection[1] && !/nessun preventivo/.test(quoteSection[1])) {
    const qs = quoteSection[1].match(/Status:\s*(\w+)/);
    quoteStatus = qs?.[1] ?? null;
  }

  let hasInvoice = false;
  let invoiceStatus: string | null = null;
  const invoiceSection = text.match(/=== FATTURAZIONE ===\s*\n([^\n]+)/);
  if (invoiceSection && invoiceSection[1] && !/nessuna fattura/.test(invoiceSection[1])) {
    hasInvoice = true;
    const is = invoiceSection[1].match(/\((\w+)\)/);
    invoiceStatus = is?.[1] ?? null;
  }

  const deliverableCount = parseIntSafe(matchLine(text, /Deliverable pubblicati al cliente:\s*(\d+)/));

  // revisioni: cerca "Round N: <status>"
  let pendingRevisionRound: number | null = null;
  const revRegex = /Round\s+(\d+):\s+(richiesta|in_lavorazione)/g;
  const revMatch = revRegex.exec(text);
  if (revMatch && revMatch[1]) pendingRevisionRound = parseInt(revMatch[1], 10);

  // ultimo agent fallito
  let lastAgentFailed: { agente: string } | null = null;
  const runsSection = text.split('=== ULTIMI AGENT RUN ===')[1];
  if (runsSection) {
    const runs = runsSection.split('\n').filter((l) => l.startsWith('- '));
    // Iteriamo dall'ultimo run (più recente di solito è in cima nella lista che il caller passa)
    for (const line of runs) {
      const m = line.match(/^- (\S+):\s*(failed|success|running)/);
      if (m && m[2] === 'failed' && m[1]) {
        lastAgentFailed = { agente: m[1] };
        break;
      }
      if (m && m[2] === 'success') break; // un success copre i fallimenti precedenti
    }
  }

  return {
    stato,
    daysInState,
    daysSinceCreation,
    has,
    hasBrief: hasBrief || !!briefLine,
    briefApproved,
    quoteStatus,
    hasInvoice,
    invoiceStatus,
    deliverableCount,
    pendingRevisionRound,
    lastAgentFailed,
  };
}

function matchLine(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1]?.trim() ?? null;
}

function parseIntSafe(s: string | null | undefined): number {
  if (!s) return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function computeSla(stato: string, days: number): ProjectManagerOutput['sla'] {
  // Soglie warning/breach in giorni per stato (in giorni)
  const thresholds: Record<string, { warn: number; breach: number }> = {
    bozza: { warn: 1, breach: 2 },
    bozza_approvata: { warn: 1, breach: 3 },
    quote_inviato: { warn: 3, breach: 7 },
    preventivo_accettato: { warn: 2, breach: 5 },
    in_produzione: { warn: 3, breach: 7 },
    in_revisione: { warn: 5, breach: 14 },
    chiuso: { warn: 999, breach: 999 },
  };
  const t = thresholds[stato] ?? { warn: 7, breach: 14 };
  const status: 'ok' | 'warning' | 'breach' =
    days >= t.breach ? 'breach' : days >= t.warn ? 'warning' : 'ok';
  return {
    status,
    days_in_current_phase: days,
    threshold_days: t.warn,
    message:
      status === 'breach'
        ? `Progetto fermo da ${days} giorni nello stato "${stato}" (soglia breach: ${t.breach}gg).`
        : status === 'warning'
          ? `Progetto in questo stato da ${days} giorni (soglia warning: ${t.warn}gg).`
          : `Tempi normali: ${days} giorni nello stato corrente.`,
  };
}
