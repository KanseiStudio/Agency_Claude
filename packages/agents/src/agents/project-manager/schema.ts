import { z } from 'zod';

/**
 * Snapshot di un agent run passato (per il contesto storico).
 */
export const agentRunSnapshotSchema = z.object({
  agente: z.string(),
  status: z.enum(['success', 'failed', 'running']),
  startedAt: z.string(), // ISO 8601
  endedAt: z.string().nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
});

/**
 * Snapshot di un round di revisione cliente.
 */
export const revisionRoundSnapshotSchema = z.object({
  numero: z.number().int().positive(),
  status: z.enum(['richiesta', 'in_lavorazione', 'completata', 'rifiutata']),
  requestedAt: z.string(),
  completedAt: z.string().nullable(),
  requestCount: z.number().int().nonnegative(),
});

export const projectManagerInputSchema = z.object({
  projectId: z.string(),
  codiceProgetto: z.string(),
  titolo: z.string(),
  clientName: z.string(),
  /** Stato corrente del progetto (enum del DB). */
  stato: z.string(),
  /** Quanti giorni il progetto è nello stato corrente (per calcolo SLA). */
  daysInCurrentState: z.number().int().nonnegative(),
  /** Quanti giorni totali dalla creazione del progetto. */
  daysSinceCreation: z.number().int().nonnegative(),
  /** Cosa esiste già nel progetto: outputs degli agenti già eseguiti. */
  hasOutputs: z.object({
    direttore: z.boolean(),
    finance: z.boolean(),
    creative: z.boolean(),
    copy: z.boolean(),
    artDesign: z.boolean(),
    /** Per art-design: l'asset principale è stato generato (storage_key valorizzato)? */
    artDesignAssetGenerated: z.boolean(),
  }),
  /** Storico recente degli agent runs (ultimi 10, ordine cronologico). */
  recentAgentRuns: z.array(agentRunSnapshotSchema).max(10),
  /** Stato preventivo. */
  quote: z
    .object({
      status: z.enum(['draft', 'inviato', 'accettato', 'rifiutato']),
      sentAt: z.string().nullable(),
      acceptedAt: z.string().nullable(),
      prezzoMaxCents: z.number().int().nonnegative(),
    })
    .nullable(),
  /** Round revisione del cliente. */
  revisionRounds: z.array(revisionRoundSnapshotSchema),
  /** Stato fatturazione. */
  invoice: z
    .object({
      numero: z.string(),
      status: z.enum(['draft', 'emessa', 'pagata', 'annullata']),
      importoCents: z.number().int().nonnegative(),
      issuedAt: z.string().nullable(),
      paidAt: z.string().nullable(),
    })
    .nullable(),
  /** Se ci sono deliverable già pubblicati al cliente. */
  publishedDeliverableCount: z.number().int().nonnegative(),
  /** Brief originale presente. */
  hasBrief: z.boolean(),
  /** Brief approvato dall'admin. */
  briefApproved: z.boolean(),
  language: z.enum(['it', 'en']).default('it'),
});

/**
 * Singolo "blocker" che impedisce l'avanzamento del progetto.
 */
export const blockerSchema = z.object({
  severity: z.enum(['info', 'warning', 'critical']),
  description: z.string().min(10),
  suggested_fix: z.string().min(10),
});

/**
 * Raccomandazione di prossima azione.
 */
export const nextActionSchema = z.object({
  /**
   * Tipo di azione:
   *   - run_agent: lancia uno specifico agente (`agent_name` valorizzato)
   *   - human_admin: serve azione dell'admin (approvare, creare invoice, ecc.)
   *   - human_client: serve azione del cliente (accettare preventivo, pagare, ecc.)
   *   - wait: in attesa esterna (es. round revisione in lavorazione)
   *   - completed: progetto concluso, niente da fare
   */
  type: z.enum(['run_agent', 'human_admin', 'human_client', 'wait', 'completed']),
  /** Descrizione concreta dell'azione (mostrata in UI). */
  description: z.string().min(10),
  /** Se type=run_agent: nome dell'agente da lanciare. */
  agent_name: z.string().optional(),
  /**
   * Priorità: 'high' = bloccante, 'medium' = consigliato, 'low' = opzionale.
   * L'UI può usarla per stilizzare diversamente il pannello.
   */
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
});

/**
 * Output completo del Project Manager.
 */
export const projectManagerOutputSchema = z.object({
  /** Stato complessivo del progetto in 1 parola. */
  status: z.enum(['ok', 'attention', 'blocked', 'completed']),
  /** Fase corrente in linguaggio umano (es. "In attesa preventivo cliente"). */
  current_phase: z.string().min(5),
  /** Azione da fare ADESSO per sbloccare/avanzare. */
  next_action: nextActionSchema,
  /** Analisi SLA: progetto in tempi normali o in ritardo? */
  sla: z.object({
    status: z.enum(['ok', 'warning', 'breach']),
    days_in_current_phase: z.number().int().nonnegative(),
    threshold_days: z.number().int().positive(),
    message: z.string(),
  }),
  /** Blocker espliciti (0-5). */
  blockers: z.array(blockerSchema).max(5),
  /** Riepilogo in 1-2 frasi per l'admin (italiano). */
  summary: z.string().min(20),
});

export type AgentRunSnapshot = z.infer<typeof agentRunSnapshotSchema>;
export type RevisionRoundSnapshot = z.infer<typeof revisionRoundSnapshotSchema>;
export type Blocker = z.infer<typeof blockerSchema>;
export type NextAction = z.infer<typeof nextActionSchema>;
export type ProjectManagerInput = z.infer<typeof projectManagerInputSchema>;
export type ProjectManagerOutput = z.infer<typeof projectManagerOutputSchema>;
