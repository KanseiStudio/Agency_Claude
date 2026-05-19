// =========================================================================
// ASSET DISPATCHER
// =========================================================================
//
// Riceve un modelId scelto dall'utente nel pannello admin + i parametri del
// primary_asset, e instrada al runtime corretto del provider.
//
// Per i video supporta multi-keyframe input: `imageUrls[]` (uno per ogni
// keyframe). Il modello video interpola tra di essi.
//
// >>> EDITA QUESTO FILE PER CABLARE UN NUOVO MODELLO <<<
//
// Per cablare un modello che oggi è uno stub:
//   1. Crea il file runtime in packages/agents/src/runtime/<provider>.ts
//      (es. flux.ts) con il client HTTP che chiama l'API del provider
//   2. Importalo qui
//   3. Sostituisci il `throw notWired(...)` con la chiamata reale alla
//      funzione che hai creato
//   4. In model-registry.ts setta `isWired: true` per quel modelId
//
// =========================================================================

import { getModelById, type ModelOption } from './model-registry';
import { openaiGenerateImage } from './openai-image';
import { seedanceGenerateVideo } from './seedance';

export interface AssetDispatchInput {
  modelId: string;
  prompt: string;
  /** Per image: dimensioni richieste (verranno mappate alle taglie del modello). */
  width?: number;
  height?: number;
  aspectRatio?: string;
  /** Per video: durata totale in secondi (multiplo di 5). */
  durationSeconds?: number;
  /**
   * Per video multi-keyframe (Seedance 2.0): array di URL pubbliche dei
   * keyframe già generati, in ordine narrativo.
   * Per video single-image (es. DoP image-to-video): array con 1 URL.
   */
  imageUrls?: string[];
  /** Seed per riproducibilità. */
  seed?: number;
  /** Titolo (per UI / mock fallback). */
  title: string;
}

export interface AssetDispatchResult {
  bytes: Buffer;
  mime: string;
  meta: {
    provider: string;
    modelId: string;
    modelUsed: string;
    creditsCost?: number;
    elapsedMs: number;
  };
}

/**
 * Instrada la richiesta al runtime corretto in base al modelId.
 * Throws con messaggio chiaro se il modello non è ancora cablato.
 */
export async function dispatchAssetGeneration(
  input: AssetDispatchInput,
): Promise<AssetDispatchResult> {
  const model = getModelById(input.modelId);
  if (!model) {
    throw new Error(
      `Modello "${input.modelId}" non presente nel registry. Modelli validi: vedi MODEL_REGISTRY (packages/agents/src/runtime/model-registry.ts).`,
    );
  }

  if (!model.isWired) {
    throw new Error(
      `Modello "${model.name}" (${model.id}) non ancora cablato. Per attivarlo: implementa il runtime e aggiorna asset-dispatcher.ts + model-registry.ts. Vedi i commenti in cima ai due file.`,
    );
  }

  switch (model.id) {
    // ====== IMMAGINI ======
    case 'openai-gpt-image-2': {
      const r = await openaiGenerateImage({
        prompt: input.prompt,
        aspectRatio: input.aspectRatio as OpenAIAR,
        width: input.width,
        height: input.height,
      });
      return {
        bytes: r.bytes,
        mime: r.mime,
        meta: {
          provider: model.provider,
          modelId: model.id,
          modelUsed: r.modelUsed,
          elapsedMs: r.elapsedMs,
        },
      };
    }
    case 'seedream-5-lite':
      return notWired(
        model,
        'Implementa packages/agents/src/runtime/seedream.ts (ByteDance o via Higgsfield platform), poi sostituisci.',
      );
    case 'flux-2-max':
      return notWired(
        model,
        'Implementa packages/agents/src/runtime/flux.ts (BFL api.bfl.ai o via Higgsfield V2), poi sostituisci.',
      );
    case 'nano-banana-2':
      return notWired(
        model,
        'Implementa packages/agents/src/runtime/google-image.ts (Gemini Image API), poi sostituisci.',
      );

    // ====== VIDEO ======
    case 'seedance-2': {
      if (!input.imageUrls || input.imageUrls.length < 2) {
        throw new Error(
          'Seedance 2.0 richiede almeno 2 keyframe URLs. Il flusso video del progetto genera i keyframe prima della chiamata video.',
        );
      }
      if (!input.durationSeconds) {
        throw new Error('Seedance 2.0 richiede durationSeconds (multiplo di 5).');
      }
      const r = await seedanceGenerateVideo({
        prompt: input.prompt,
        imageUrls: input.imageUrls,
        durationSeconds: input.durationSeconds,
        aspectRatio: input.aspectRatio as SeedanceAR,
        seed: input.seed,
      });
      return {
        bytes: r.bytes,
        mime: r.mime,
        meta: {
          provider: model.provider,
          modelId: model.id,
          modelUsed: r.modelUsed,
          creditsCost: r.creditsCost,
          elapsedMs: r.elapsedMs,
        },
      };
    }
    case 'kling-3-omni':
      return notWired(
        model,
        'Implementa packages/agents/src/runtime/kling.ts (Kuaishou o via Higgsfield platform), poi sostituisci.',
      );
    case 'veo-3-1':
      return notWired(
        model,
        'Implementa packages/agents/src/runtime/veo.ts (Google Veo o via Higgsfield V2), poi sostituisci.',
      );

    default:
      throw new Error(
        `Modello "${model.id}" nel registry ma senza dispatcher case. Aggiungi un case in asset-dispatcher.ts.`,
      );
  }
}

type OpenAIAR = '1:1' | '4:5' | '9:16' | '16:9' | '3:4' | '4:3' | '2:3' | '3:2';
type SeedanceAR = '16:9' | '9:16' | '1:1' | '4:3';

/** Helper per ridurre boilerplate nei `case` non ancora cablati. */
function notWired(model: ModelOption, instructions: string): never {
  throw new Error(`${model.name} non ancora cablato. ${instructions}`);
}
