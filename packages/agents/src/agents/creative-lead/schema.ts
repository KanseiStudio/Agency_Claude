import { z } from 'zod';

export const creativeLeadInputSchema = z.object({
  projectId: z.string(),
  codiceProgetto: z.string(),
  titolo: z.string(),
  descrizione: z.string(),
  deliverableRichiesti: z.array(z.string()),
  clientName: z.string(),
  direttoreSummary: z.string(),
  estimatedComplexity: z.enum(['simple', 'moderate', 'complex', 'very_complex']),
  language: z.enum(['it', 'en']).default('it'),
});

export const creativeLeadOutputSchema = z.object({
  /** Concept principale in 2-4 frasi: l'idea-guida del progetto. */
  concept_principale: z.string().min(20),
  /** 1-3 concept alternativi che proponiamo come opzioni B/C. */
  alternative_concepts: z.array(z.string()).max(3).default([]),
  /** Brief operativo per il Copy Agent. */
  brief_copy: z.string(),
  /** Brief operativo per l'Art & Design Agent. */
  brief_design: z.string(),
  /** Brief operativo per il Video/Audio Agent (può essere stringa vuota se non serve). */
  brief_video: z.string().default(''),
  /** Mood keywords (es: ["caldo", "moderno", "artigianale"]). */
  mood_keywords: z.array(z.string()).min(2),
  /** Cose che DEVONO esserci nei deliverable. */
  must_haves: z.array(z.string()),
  /** Cose da EVITARE assolutamente. */
  must_avoids: z.array(z.string()),
  /** Note interne per Michele (revisione human-in-the-loop). */
  note: z.string().optional(),
});

export type CreativeLeadInput = z.infer<typeof creativeLeadInputSchema>;
export type CreativeLeadOutput = z.infer<typeof creativeLeadOutputSchema>;
