// Schema Zod del brief inviato dal cliente.
// Usato per validazione lato client (form) E lato server (action).

import { z } from 'zod';

// Tipologie di deliverable selezionabili dal cliente in V1.
// Sono "tag" usati dal Direttore Operativo per smistare il brief
// agli agenti giusti.
export const DELIVERABLE_TYPES = [
  'logo',
  'image_pack',
  'video_reel',
  'social_plan',
  'newsletter',
  'landing_page',
  'press_release',
  'altro',
] as const;

export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];

export const briefSchema = z.object({
  titolo: z
    .string()
    .min(3, 'Il titolo deve avere almeno 3 caratteri.')
    .max(200, 'Il titolo non può superare i 200 caratteri.'),
  descrizione: z
    .string()
    .min(20, 'La descrizione deve essere almeno 20 caratteri.')
    .max(5000, 'La descrizione non può superare i 5000 caratteri.'),
  deliverableRichiesti: z
    .array(z.enum(DELIVERABLE_TYPES))
    .min(1, 'Seleziona almeno un deliverable.'),
  deadline: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined))
    .refine((d) => d === undefined || !Number.isNaN(d.getTime()), {
      message: 'Data non valida.',
    }),
  budgetIndicativoEur: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return undefined;
      const n = typeof v === 'string' ? Number(v) : v;
      return Number.isFinite(n) ? n : undefined;
    })
    .refine((n) => n === undefined || (n >= 0 && n <= 1_000_000), {
      message: 'Budget non valido (atteso 0–1.000.000 €).',
    }),
});

export type BriefInput = z.input<typeof briefSchema>;
export type BriefData = z.output<typeof briefSchema>;
