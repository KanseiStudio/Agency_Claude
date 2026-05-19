// Generazione immagini per gli agenti visuali (Art & Design, Motion in futuro).
//
// API uniforme: prendi prompt + dimensioni → restituisci Buffer + mime + meta.
// Dispatcher su provider via env:
//   - MOCK_LLM=true OPPURE HIGGSFIELD_API_KEY mancante → mock SVG placeholder
//   - altrimenti → Higgsfield (cloud.higgsfield.ai diretto o proxy Segmind)
//
// La risposta include `meta` opzionale con dati per il cost tracking
// (modelUsed, creditsCost, elapsedMs).

import {
  higgsfieldGenerateImage,
  downloadAsset,
  type HiggsfieldImageInput,
} from './higgsfield';

export interface ImageGenInput {
  prompt: string;
  width: number;
  height: number;
  paletteHex: {
    primary: string;
    accent: string;
    neutralLight: string;
    neutralDark: string;
    background: string;
  };
  title: string;
  /** Aspect ratio opzionale (per provider che accettano enum invece di width/height). */
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9' | '3:4';
  /** Modello Higgsfield opzionale (override del default 'soul'). */
  model?: string;
}

export interface ImageGenMeta {
  provider: 'mock' | 'higgsfield';
  modelUsed: string;
  /** Crediti consumati (solo provider reali, se ritornati). */
  creditsCost?: number;
  /** Tempo di generazione end-to-end in ms. */
  elapsedMs: number;
}

export interface ImageGenResult {
  bytes: Buffer;
  mime: string;
  meta: ImageGenMeta;
}

export async function generateImage(input: ImageGenInput): Promise<ImageGenResult> {
  const useMock = process.env.MOCK_LLM === 'true' || !process.env.HIGGSFIELD_API_KEY;
  if (useMock) {
    return generateMockSvg(input);
  }
  return generateWithHiggsfield(input);
}

/**
 * Chiama Higgsfield (cloud o Segmind) per generare l'immagine e scaricarla.
 * Il caller riceve i bytes già pronti da salvare in storage.
 */
async function generateWithHiggsfield(input: ImageGenInput): Promise<ImageGenResult> {
  const hiInput: HiggsfieldImageInput = {
    prompt: input.prompt,
    model: input.model ?? 'soul',
    width: input.width,
    height: input.height,
    aspectRatio: input.aspectRatio,
  };

  const job = await higgsfieldGenerateImage(hiInput);
  const asset = await downloadAsset(job.url);

  return {
    bytes: asset.bytes,
    mime: asset.mime ?? job.mime,
    meta: {
      provider: 'higgsfield',
      modelUsed: job.modelUsed,
      creditsCost: job.creditsCost,
      elapsedMs: job.elapsedMs,
    },
  };
}

/**
 * Genera un SVG placeholder coerente con la palette + prompt scritto sopra.
 * Utile in dev per validare il flusso senza consumare quota su API esterne.
 */
function generateMockSvg(input: ImageGenInput): ImageGenResult {
  const startedAt = Date.now();
  const { width, height, paletteHex, prompt, title } = input;
  const safePrompt = escapeXml(prompt.slice(0, 220));
  const safeTitle = escapeXml(title);
  const fontSize = Math.max(12, Math.min(width, height) / 18);
  const promptFontSize = Math.max(8, Math.min(width, height) / 36);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${paletteHex.background}"/>
  <rect x="${width * 0.06}" y="${height * 0.06}" width="${width * 0.88}" height="${height * 0.88}" fill="${paletteHex.primary}" fill-opacity="0.08" stroke="${paletteHex.primary}" stroke-width="2"/>
  <rect x="${width * 0.06}" y="${height * 0.06}" width="${width * 0.18}" height="6" fill="${paletteHex.accent}"/>
  <text x="${width / 2}" y="${height * 0.45}" text-anchor="middle" font-family="Georgia, serif" font-size="${fontSize}" font-weight="600" fill="${paletteHex.neutralDark}">
    ${safeTitle}
  </text>
  <text x="${width / 2}" y="${height * 0.55}" text-anchor="middle" font-family="Inter, sans-serif" font-size="${promptFontSize}" fill="${paletteHex.neutralDark}" opacity="0.6">
    <tspan>${safePrompt}</tspan>
  </text>
  <rect x="${width * 0.85}" y="${height * 0.85}" width="${width * 0.09}" height="${height * 0.09}" fill="${paletteHex.accent}"/>
  <text x="${width * 0.06}" y="${height * 0.96}" font-family="monospace" font-size="${promptFontSize * 0.8}" fill="${paletteHex.primary}" opacity="0.8">
    MOCK · ${width}×${height} · Kansei-Studio
  </text>
</svg>`;

  return {
    bytes: Buffer.from(svg, 'utf-8'),
    mime: 'image/svg+xml',
    meta: {
      provider: 'mock',
      modelUsed: 'mock-svg',
      elapsedMs: Date.now() - startedAt,
    },
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
