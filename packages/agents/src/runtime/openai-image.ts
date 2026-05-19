// =========================================================================
// CLIENT OPENAI IMAGES API (chiamata diretta, non via Higgsfield)
// =========================================================================
//
// Generazione immagini via OpenAI Images API direttamente.
// Endpoint:  POST https://api.openai.com/v1/images/generations
// Auth:      Authorization: Bearer <OPENAI_API_KEY>
//
// Documentation: https://platform.openai.com/docs/api-reference/images
//
// Env supportate:
//   - OPENAI_API_KEY        (required)
//   - OPENAI_IMAGE_MODEL    (default "gpt-image-1"; quando OpenAI rilascia
//                            un model id nuovo, basta cambiare qui senza
//                            toccare il registry)
//   - OPENAI_IMAGE_QUALITY  ("low" | "medium" | "high" | "auto", default "high")
//
// Sizes supportate da gpt-image-1:
//   - 1024x1024 (square)
//   - 1024x1536 (portrait, ~2:3)
//   - 1536x1024 (landscape, ~3:2)
//   - auto (lasciato al modello)
//
// =========================================================================

export interface OpenAIImageInput {
  prompt: string;
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9' | '3:4' | '4:3' | '2:3' | '3:2';
  width?: number;
  height?: number;
}

export interface OpenAIImageResult {
  bytes: Buffer;
  mime: string;
  modelUsed: string;
  elapsedMs: number;
}

function pickOpenAISize(
  aspectRatio?: string,
  width?: number,
  height?: number,
): string {
  if (aspectRatio === '1:1') return '1024x1024';
  if (
    aspectRatio === '9:16' ||
    aspectRatio === '4:5' ||
    aspectRatio === '3:4' ||
    aspectRatio === '2:3'
  ) {
    return '1024x1536';
  }
  if (aspectRatio === '16:9' || aspectRatio === '4:3' || aspectRatio === '3:2') {
    return '1536x1024';
  }
  if (width && height) {
    const r = width / height;
    if (r > 1.1) return '1536x1024';
    if (r < 0.9) return '1024x1536';
    return '1024x1024';
  }
  return '1024x1024';
}

export async function openaiGenerateImage(
  input: OpenAIImageInput,
): Promise<OpenAIImageResult> {
  const startedAt = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY non configurata. Aggiungi la key (formato sk-...) in .env per generare immagini con GPT-Image.',
    );
  }

  const model = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
  const quality = process.env.OPENAI_IMAGE_QUALITY ?? 'high';
  const size = pickOpenAISize(input.aspectRatio, input.width, input.height);

  const body = {
    model,
    prompt: input.prompt,
    size,
    quality,
    n: 1,
  };

  const url = 'https://api.openai.com/v1/images/generations';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `OpenAI image submit failed (${resp.status}) @ POST ${url}: ${text.slice(0, 500) || '(empty body)'}`,
    );
  }

  const json = (await resp.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const first = json.data?.[0];
  if (!first) {
    throw new Error(
      `OpenAI image: response senza data[]: ${JSON.stringify(json).slice(0, 300)}`,
    );
  }

  // gpt-image-1 ritorna b64_json di default. Se in futuro ritornasse `url`,
  // facciamo fetch del file.
  let bytes: Buffer;
  if (first.b64_json) {
    bytes = Buffer.from(first.b64_json, 'base64');
  } else if (first.url) {
    const fileResp = await fetch(first.url);
    if (!fileResp.ok) {
      throw new Error(
        `OpenAI image: download URL fallito (${fileResp.status}): ${first.url}`,
      );
    }
    bytes = Buffer.from(await fileResp.arrayBuffer());
  } else {
    throw new Error(
      `OpenAI image: nessun b64_json né url nella response: ${JSON.stringify(json).slice(0, 300)}`,
    );
  }

  return {
    bytes,
    mime: 'image/png',
    modelUsed: model,
    elapsedMs: Date.now() - startedAt,
  };
}
