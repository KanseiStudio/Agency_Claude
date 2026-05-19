import { z } from 'zod';

export const direttoreInputSchema = z.object({
  projectId: z.string(),
  codiceProgetto: z.string(),
  titolo: z.string(),
  descrizione: z.string(),
  deliverableRichiesti: z.array(z.string()),
  deadline: z.string().nullable().optional(),
  budgetIndicativoEur: z.number().nullable().optional(),
  clientName: z.string(),
  /** Email cliente (utile per inferire dominio/settore se brief lacunoso). */
  clientEmail: z.string().optional(),
  /** Partita IVA, se disponibile (può aiutare a identificare il settore). */
  clientPiva: z.string().optional(),
  language: z.enum(['it', 'en']).default('it'),
});

/**
 * Analisi del cliente che il Direttore deve produrre PRIMA del piano.
 * Tutti i campi sono dichiarazioni esplicite: niente "abbastanza generico",
 * niente "dipende". Se serve dedurre, il Direttore deduce e marca confidence.
 */
export const clientAnalysisSchema = z.object({
  /** Settore di attività dedotto/dichiarato (es. "ristorazione tradizionale", "SaaS B2B HR"). */
  sector_inferred: z.string().min(5),
  /** Modello di business (es. "B2C retail", "B2B enterprise", "marketplace", "agenzia"). */
  business_model: z.string().min(3),
  /** Ipotesi di target audience principale (es. "professionisti 30-45 italiani"). */
  target_audience_hypothesis: z.string().min(10),
  /** Come si posiziona il cliente sul mercato (premium / accessible / disruptive / conservative / niche). */
  competitive_positioning: z.string().min(10),
  /** Confidenza globale dell'analisi: high se brief esplicito, low se molto dedotto. */
  information_confidence: z.enum(['high', 'medium', 'low']),
  /** 1-3 fonti/segnali usati per dedurre (es. "dominio email", "P.IVA settore", "deliverable richiesti"). */
  inference_signals: z.array(z.string()),
});

/**
 * Analisi mood visivo. Critica quando il brief non contiene file di reference.
 * Il Direttore deve fare un "primo passo" di direzione artistica, su cui poi
 * il Creative Lead si baserà.
 */
export const visualMoodAnalysisSchema = z.object({
  /** True se il brief contiene già file di reference visivi caricati. */
  has_references: z.boolean(),
  /** 5-10 keyword di stile visivo inferite (es. "minimal", "warm tones", "editorial italian"). */
  inferred_style_keywords: z.array(z.string()).min(3),
  /** Direzioni palette consigliate (descrizioni testuali, es. "tonalità terrose calde", "duotone blu/oro"). */
  suggested_color_directions: z.array(z.string()).min(1),
  /** Stile tipografico inferito (es. "serif editoriale italiano", "sans-serif geometrico moderno"). */
  inferred_typography_style: z.string().min(10),
  /** 2-4 frasi che spiegano da cosa è stato dedotto questo mood. */
  rationale: z.string().min(30),
});

export const direttoreOutputSchema = z.object({
  /** Sintesi 2-3 frasi del lavoro proposto. */
  summary: z.string().min(20),
  /** ANALISI cliente — campo obbligatorio per output di qualità. */
  client_analysis: clientAnalysisSchema,
  /** ANALISI mood visivo — campo obbligatorio. */
  visual_mood_analysis: visualMoodAnalysisSchema,
  /** Agenti da coinvolgere, in ordine di priorità. */
  required_agents: z.array(z.string()).min(1),
  /** Piano sequenziale degli step. */
  execution_plan: z
    .array(
      z.object({
        step: z.number().int().positive(),
        agent: z.string(),
        description: z.string().min(20),
        estimated_duration_hours: z.number().nonnegative(),
      }),
    )
    .min(1),
  /** Priorità complessiva. */
  priority: z.enum(['low', 'medium', 'high']),
  /** Stima complessità per dimensionare il preventivo. */
  estimated_complexity: z.enum(['simple', 'moderate', 'complex', 'very_complex']),
  /** Rischi specifici (non generici) che potrebbero rallentare il progetto. */
  risks: z.array(z.string().min(20)),
  /**
   * Domande CONCRETE da fare al cliente. Ognuna deve essere rispondibile in
   * 1-2 frasi (no "specifica meglio il brief", sì "il logo è per uso prevalentemente
   * digitale (social, web) o anche stampa (cartelloni, packaging)?").
   */
  missing_information: z.array(z.string().min(20)),
  /**
   * Assunzioni esplicite fatte dal Direttore per riempire i gap del brief.
   * Es. "Assunto target B2C 30-50 anni perché il deliverable è un logo per
   * ristorazione, segmento storicamente B2C". Aiuta admin a vedere il
   * ragionamento e correggere.
   */
  assumptions_made: z.array(z.string().min(15)),
  /** Flag che richiede approvazione umana sul piano prima di procedere. */
  requires_human_approval: z.boolean().default(false),
});

export type ClientAnalysis = z.infer<typeof clientAnalysisSchema>;
export type VisualMoodAnalysis = z.infer<typeof visualMoodAnalysisSchema>;
export type DirettoreInput = z.infer<typeof direttoreInputSchema>;
export type DirettoreOutput = z.infer<typeof direttoreOutputSchema>;
