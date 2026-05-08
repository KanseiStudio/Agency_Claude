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
  language: z.enum(['it', 'en']).default('it'),
});

export const direttoreOutputSchema = z.object({
  /** Sintesi 2-3 frasi del lavoro proposto. */
  summary: z.string().min(20),
  /** Agenti da coinvolgere, in ordine di priorità. */
  required_agents: z.array(z.string()).min(1),
  /** Piano sequenziale degli step. */
  execution_plan: z
    .array(
      z.object({
        step: z.number().int().positive(),
        agent: z.string(),
        description: z.string(),
        estimated_duration_hours: z.number().nonnegative(),
      }),
    )
    .min(1),
  /** Priorità complessiva. */
  priority: z.enum(['low', 'medium', 'high']),
  /** Stima complessità per dimensionare il preventivo. */
  estimated_complexity: z.enum(['simple', 'moderate', 'complex', 'very_complex']),
  /** Rischi che potrebbero rallentare il progetto. */
  risks: z.array(z.string()),
  /** Informazioni che mancano nel brief e che andrebbero richieste al cliente. */
  missing_information: z.array(z.string()),
  /** Flag che richiede approvazione umana sul piano prima di procedere. */
  requires_human_approval: z.boolean().default(false),
});

export type DirettoreInput = z.infer<typeof direttoreInputSchema>;
export type DirettoreOutput = z.infer<typeof direttoreOutputSchema>;
