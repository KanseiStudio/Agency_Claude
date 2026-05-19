import { z } from 'zod';

export const paletteColorSchema = z.object({
  name: z.string(),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'hex deve essere nel formato #RRGGBB'),
  role: z.enum(['primary', 'accent', 'neutral-light', 'neutral-dark', 'background']),
});

export const artDirectionSchema = z.object({
  palette: z.array(paletteColorSchema).min(3).max(6),
  typography: z.object({
    headline_font_family: z.string(),
    body_font_family: z.string(),
    style_notes: z.string(),
  }),
  style_keywords: z.array(z.string()).min(3),
  references: z.array(z.string()).min(1),
});

/**
 * Brief per UN singolo keyframe del video.
 *
 * Per i video, generiamo N immagini "keyframe" e poi le passiamo al modello
 * video (Seedance 2.0) che interpola tra di esse. Numero di keyframe:
 *   N = duration_seconds / 5 + 1
 * (per 15s → 4 immagini, per 10s → 3, per 5s → 2, ecc.)
 */
export const imageBriefSchema = z.object({
  /** Ordine narrativo (1-based): 1 = opening, N = closing. */
  index: z.number().int().min(1),
  /** Nome descrittivo del frame (per UI/log, non passato al model di image gen). */
  title: z.string().min(3),
  /** Prompt pronto per il modello di image generation (inglese, ≥30 char). */
  prompt: z.string().min(30),
});

/**
 * Spec del SINGOLO asset principale del progetto.
 *
 * Per asset_type "image": il prompt viene usato per generare 1 immagine.
 * Per asset_type "video": il prompt è la descrizione narrativa generale,
 *   e image_briefs[] contiene i keyframe (uno ogni ~5s) che verranno
 *   generati prima di chiamare il modello video.
 */
export const primaryAssetSchema = z
  .object({
    asset_type: z.enum(['image', 'video']),
    title: z.string().min(3),
    /** Prompt narrativo generale (per image: il prompt di generazione; per video: la "story" complessiva). */
    prompt: z.string().min(30),
    aspect_ratio: z.enum(['1:1', '4:5', '9:16', '16:9', '3:4', '4:3', '2:3', '3:2']),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    /** Solo per video: durata multipla di 5 (5, 10, 15, 20, …, 60). */
    duration_seconds: z
      .number()
      .int()
      .min(5)
      .max(60)
      .refine((n) => n % 5 === 0, { message: 'duration_seconds deve essere multipla di 5' })
      .optional(),
    /**
     * Solo per video: array di keyframe brief. Numero richiesto:
     *   N = duration_seconds / 5 + 1
     * Es. video 15s → 4 keyframes (image_1, image_2, image_3, image_4).
     */
    image_briefs: z.array(imageBriefSchema).min(2).max(13).optional(),
    rationale: z.string().min(20),
  })
  .refine(
    (a) => {
      if (a.asset_type !== 'video') return true;
      if (!a.duration_seconds || !a.image_briefs) return false;
      const expected = a.duration_seconds / 5 + 1;
      return a.image_briefs.length === expected;
    },
    {
      message:
        'Per asset_type=video: image_briefs.length deve essere == duration_seconds/5 + 1 (es. 15s → 4 briefs)',
      path: ['image_briefs'],
    },
  );

/**
 * Una raccomandazione di modello (l'agente ne produce 3-5 ranked).
 */
export const modelRecommendationSchema = z.object({
  /** Deve essere un id presente nel MODEL_REGISTRY. */
  model_id: z.string(),
  /** Posizione nella ranking: 1 = primo consiglio, 2 = alternativa, ecc. */
  rank: z.number().int().min(1).max(5),
  /** Perché questo modello è adatto a QUESTO progetto specifico. */
  motivation: z.string().min(20),
});

export const artDesignInputSchema = z.object({
  projectId: z.string(),
  codiceProgetto: z.string(),
  titolo: z.string(),
  descrizione: z.string(),
  deliverableRichiesti: z.array(z.string()),
  clientName: z.string(),
  conceptPrincipale: z.string(),
  briefDesign: z.string(),
  briefVideo: z.string().optional(),
  moodKeywords: z.array(z.string()),
  mustHaves: z.array(z.string()),
  mustAvoids: z.array(z.string()),
  language: z.enum(['it', 'en']).default('it'),
});

/** Output dell'agente: art direction + asset principale (con briefs se video) + ranking modelli. */
export const artDesignOutputSchema = z.object({
  art_direction: artDirectionSchema,
  primary_asset: primaryAssetSchema,
  recommended_models: z.array(modelRecommendationSchema).min(3).max(5),
});

/** Un keyframe effettivamente generato (storage_key valorizzato). */
export const generatedKeyframeSchema = imageBriefSchema.extend({
  storage_key: z.string(),
  mime: z.string(),
  bytes: z.number().int().nonnegative(),
});

/** Specifica del singolo asset arricchita post-generazione. */
export const generatedAssetSchema = z
  .object({
    asset_type: z.enum(['image', 'video']),
    title: z.string(),
    prompt: z.string(),
    aspect_ratio: z.enum(['1:1', '4:5', '9:16', '16:9', '3:4', '4:3', '2:3', '3:2']),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    duration_seconds: z.number().int().optional(),
    image_briefs: z.array(imageBriefSchema).optional(),
    rationale: z.string(),
    storage_key: z.string(),
    mime: z.string(),
    bytes: z.number().int().nonnegative(),
    model_id: z.string(),
    /** Per video: keyframes generati (anche se la composizione video fallisce). */
    keyframes: z.array(generatedKeyframeSchema).optional(),
  });

export type PaletteColor = z.infer<typeof paletteColorSchema>;
export type ArtDirection = z.infer<typeof artDirectionSchema>;
export type ImageBrief = z.infer<typeof imageBriefSchema>;
export type PrimaryAsset = z.infer<typeof primaryAssetSchema>;
export type ModelRecommendation = z.infer<typeof modelRecommendationSchema>;
export type GeneratedKeyframe = z.infer<typeof generatedKeyframeSchema>;
export type GeneratedAsset = z.infer<typeof generatedAssetSchema>;
export type ArtDesignInput = z.infer<typeof artDesignInputSchema>;
export type ArtDesignOutput = z.infer<typeof artDesignOutputSchema>;
