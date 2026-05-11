import { z } from 'zod';

export const copyDeliverableTypeEnum = z.enum([
  'social_post',
  'newsletter',
  'landing_page',
  'press_release',
  'claim',
  'altro',
]);

export type CopyDeliverableType = z.infer<typeof copyDeliverableTypeEnum>;

export const copyAgentInputSchema = z.object({
  projectId: z.string(),
  codiceProgetto: z.string(),
  titolo: z.string(),
  descrizione: z.string(),
  deliverableRichiesti: z.array(z.string()),
  clientName: z.string(),
  conceptPrincipale: z.string(),
  briefCopy: z.string(),
  moodKeywords: z.array(z.string()),
  mustHaves: z.array(z.string()),
  mustAvoids: z.array(z.string()),
  language: z.enum(['it', 'en']).default('it'),
});

export const copyVariantSchema = z.object({
  label: z.string().regex(/^[A-Z]$/, 'label deve essere una singola lettera maiuscola'),
  headline: z.string().optional(),
  body: z.string().min(5),
  cta: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  length_chars: z.number().int().nonnegative(),
});

export const copyDeliverableSchema = z.object({
  type: copyDeliverableTypeEnum,
  title: z.string(),
  variants: z.array(copyVariantSchema).min(1).max(3),
  rationale: z.string(),
});

export const copyAgentOutputSchema = z.object({
  deliverables: z.array(copyDeliverableSchema).min(1),
  global_notes: z.string().optional(),
});

export type CopyAgentInput = z.infer<typeof copyAgentInputSchema>;
export type CopyAgentOutput = z.infer<typeof copyAgentOutputSchema>;
export type CopyVariant = z.infer<typeof copyVariantSchema>;
export type CopyDeliverable = z.infer<typeof copyDeliverableSchema>;
