import { z } from 'zod';

/**
 * Tipi di email che l'Email Composer può generare.
 * Mantenere allineato con l'enum EmailKind del DB (schema.prisma).
 */
export const emailKindSchema = z.enum([
  'quote_sent',
  'quote_reminder',
  'production_started',
  'deliverables_ready',
  'revision_completed',
  'invoice_issued',
  'payment_confirmed',
  'payment_reminder',
  'project_completed',
  'custom',
]);

export type EmailKind = z.infer<typeof emailKindSchema>;

/**
 * Contesto che il caller passa all'agente. Tutti i campi opzionali a parte
 * client_name e project_title — l'agente userà quello che ha disponibile.
 */
export const emailContextSchema = z.object({
  /** Nome cliente (ragione sociale) — usato in apertura. */
  client_name: z.string(),
  /** Titolo progetto. */
  project_title: z.string(),
  /** Codice progetto (es. KSA-2026-0042). */
  project_code: z.string(),
  /** Numero fattura, se rilevante (kind = invoice_issued, payment_*). */
  invoice_number: z.string().optional(),
  /** Importo in centesimi, se rilevante. */
  amount_cents: z.number().int().nonnegative().optional(),
  /** Valuta (default EUR). */
  currency: z.string().default('EUR'),
  /** Numero round revisione, se rilevante (kind = revision_completed). */
  revision_round: z.number().int().positive().optional(),
  /** Numero deliverable pubblicati (kind = deliverables_ready). */
  deliverable_count: z.number().int().nonnegative().optional(),
  /** URL del portale cliente per call-to-action (default deriva da APP_CLIENT_URL). */
  portal_url: z.string().url().optional(),
  /** Giorni di attesa, per i reminder (kind = *_reminder). */
  days_waiting: z.number().int().nonnegative().optional(),
  /** Note specifiche da includere (per kind=custom o context specifico). */
  custom_notes: z.string().optional(),
});

export type EmailContext = z.infer<typeof emailContextSchema>;

export const emailComposerInputSchema = z.object({
  /** Tipo di email da generare. */
  kind: emailKindSchema,
  /** Contesto necessario per personalizzare. */
  context: emailContextSchema,
  /** Lingua (default it). */
  language: z.enum(['it', 'en']).default('it'),
  /** Tono di comunicazione (default professionale ma caloroso). */
  tone: z
    .enum(['professionale', 'caloroso', 'urgente', 'informale'])
    .default('professionale'),
});

export type EmailComposerInput = z.infer<typeof emailComposerInputSchema>;

/**
 * Output dell'agente: oggetto email pronto per essere inviato dal mailer.
 */
export const emailComposerOutputSchema = z.object({
  /** Subject (max ~80 char, niente emoji a inizio, no SPAM phrases). */
  subject: z.string().min(5).max(150),
  /** Body in plain text (per client mail non-HTML). */
  body_text: z.string().min(50),
  /** Body in HTML semantico (con paragrafi <p>, link <a>, niente CSS pesante). */
  body_html: z.string().min(50),
  /**
   * Preheader: testo nascosto mostrato nell'anteprima inbox subito dopo il
   * subject. ~80 char. Non duplica il subject.
   */
  preheader: z.string().min(10).max(150).optional(),
});

export type EmailComposerOutput = z.infer<typeof emailComposerOutputSchema>;
