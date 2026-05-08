import { z } from 'zod';

/**
 * Voce del listino servizi passata al Finance/Admin agent come riferimento
 * per il pricing. Tutti i prezzi sono in EUR (interi: il valore minimo
 * della range del listino, max della range, agente responsabile).
 */
export const serviceCatalogItemSchema = z.object({
  codice: z.string(),
  descrizione: z.string(),
  prezzoBaseMinEur: z.number().nonnegative(),
  prezzoBaseMaxEur: z.number().nonnegative(),
  agenteResponsabile: z.string().nullable().optional(),
});

export const financeAdminInputSchema = z.object({
  projectId: z.string(),
  codiceProgetto: z.string(),
  titolo: z.string(),
  descrizione: z.string(),
  deliverableRichiesti: z.array(z.string()),
  budgetIndicativoEur: z.number().nullable().optional(),
  direttoreSummary: z.string(),
  requiredAgents: z.array(z.string()),
  estimatedComplexity: z.enum(['simple', 'moderate', 'complex', 'very_complex']),
  servicesCatalog: z.array(serviceCatalogItemSchema),
  language: z.enum(['it', 'en']).default('it'),
});

export const quoteItemSchema = z.object({
  voce: z.string().min(2),
  agente: z.string(),
  quantita: z.number().positive().default(1),
  prezzo_unitario_eur: z.number().nonnegative(),
  prezzo_totale_eur: z.number().nonnegative(),
  opzionale: z.boolean().default(false),
  note: z.string().optional(),
});

export const financeAdminOutputSchema = z
  .object({
    prezzo_min_eur: z.number().positive(),
    prezzo_max_eur: z.number().positive(),
    gap_pct: z.number().min(0).max(20),
    breakdown: z.array(quoteItemSchema).min(1),
    conditions: z.array(z.string()),
    valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'formato YYYY-MM-DD richiesto'),
    note: z.string().optional(),
  })
  .refine((d) => d.prezzo_max_eur >= d.prezzo_min_eur, {
    message: 'prezzo_max_eur deve essere >= prezzo_min_eur',
  })
  .refine(
    (d) => {
      const computedGap = ((d.prezzo_max_eur - d.prezzo_min_eur) / d.prezzo_min_eur) * 100;
      return computedGap <= 15.5; // tolleranza 0.5% sul vincolo "max 15%"
    },
    { message: 'gap effettivo (max-min)/min * 100 deve essere <= 15%' },
  );

export type FinanceAdminInput = z.infer<typeof financeAdminInputSchema>;
export type FinanceAdminOutput = z.infer<typeof financeAdminOutputSchema>;
export type QuoteItem = z.infer<typeof quoteItemSchema>;
