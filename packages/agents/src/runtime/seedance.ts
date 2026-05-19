// =========================================================================
// SEEDANCE 2.0 via HIGGSFIELD
// =========================================================================
//
// Seedance 2.0 (ByteDance) è host sulla piattaforma Higgsfield —
// stessa API key (HIGGSFIELD_API_KEY in formato KEY_ID:KEY_SECRET) e
// stesso pattern submit→poll→download di Soul.
//
// Endpoint atteso (default, configurabile via env):
//   /v1/image2video/seedance-2.0
//
// L'endpoint specifico potrebbe essere diverso: verifica su higgsfield.ai
// (Seedance 2.0 page → DevTools Network → URL del POST). Per cambiarlo
// senza modificare codice basta `HIGGSFIELD_SEEDANCE_ENDPOINT` in .env.
//
// =========================================================================

import { higgsfieldSubmitAndDownload } from './higgsfield';

export interface SeedanceVideoInput {
  /** Descrizione narrativa generale del video. */
  prompt: string;
  /**
   * Keyframe in ordine narrativo (URL pubbliche accessibili dal server
   * Higgsfield). Minimo 2 (start+end).
   */
  imageUrls: string[];
  /** Durata totale in secondi (multiplo di 5). */
  durationSeconds: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  seed?: number;
}

export interface SeedanceVideoResult {
  bytes: Buffer;
  mime: string;
  modelUsed: string;
  creditsCost?: number;
  elapsedMs: number;
}

export async function seedanceGenerateVideo(
  input: SeedanceVideoInput,
): Promise<SeedanceVideoResult> {
  // ----- Pre-flight checks (utili anche prima di toccare la rete) -----
  if (input.imageUrls.length < 2) {
    throw new Error(
      `Seedance richiede almeno 2 keyframe URLs (start + end). Ricevuti: ${input.imageUrls.length}.`,
    );
  }
  if (input.durationSeconds % 5 !== 0) {
    throw new Error(
      `Seedance: durationSeconds (${input.durationSeconds}) deve essere multiplo di 5.`,
    );
  }
  const expected = input.durationSeconds / 5 + 1;
  if (input.imageUrls.length !== expected) {
    throw new Error(
      `Seedance: ${input.imageUrls.length} keyframes per ${input.durationSeconds}s — atteso ${expected} (= durata/5 + 1).`,
    );
  }

  // Seedance 1.0 Pro su Higgsfield platform (la 2.0 non ha ancora API
  // pubblica nella loro doc).
  const endpoint =
    process.env.HIGGSFIELD_SEEDANCE_ENDPOINT ??
    '/bytedance/seedance/v1/pro/image-to-video';

  // Body specifico Seedance. Verrà wrappato in {params} dal client higgsfield
  // se non lo è già.
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    image_urls: input.imageUrls,
    duration_seconds: input.durationSeconds,
    aspect_ratio: input.aspectRatio ?? '9:16',
  };
  if (typeof input.seed === 'number') body.seed = input.seed;

  const result = await higgsfieldSubmitAndDownload(endpoint, body, 'video/mp4');

  return {
    bytes: result.bytes,
    mime: result.mime,
    modelUsed: result.modelUsed,
    creditsCost: result.creditsCost,
    elapsedMs: result.elapsedMs,
  };
}
