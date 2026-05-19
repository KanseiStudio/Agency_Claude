// Generazione video per gli agenti motion (Video/Audio Agent in V2).
//
// API uniforme: prendi prompt + durata + risoluzione → restituisci Buffer MP4
// (o placeholder SVG in mock). Dispatcher su provider via env:
//   - MOCK_LLM=true OPPURE HIGGSFIELD_API_KEY mancante → mock placeholder
//   - altrimenti → Higgsfield video (modelli: seedance, kling, veo, wan, sora2)

import {
  higgsfieldGenerateVideo,
  downloadAsset,
  type HiggsfieldVideoInput,
} from './higgsfield';

export interface VideoGenInput {
  prompt: string;
  /** Durata in secondi (5 o 10 supportati dalla maggior parte dei modelli). */
  durationSeconds?: 5 | 10;
  resolution?: '480p' | '720p' | '1080p';
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  /** Image-to-video: URL pubblico di un frame di partenza. */
  imageUrl?: string;
  /** Modello Higgsfield opzionale (default: seedance). */
  model?: string;
  /** Titolo per il mock (visualizzato sull'SVG placeholder). */
  title?: string;
}

export interface VideoGenMeta {
  provider: 'mock' | 'higgsfield';
  modelUsed: string;
  creditsCost?: number;
  elapsedMs: number;
}

export interface VideoGenResult {
  bytes: Buffer;
  mime: string;
  meta: VideoGenMeta;
}

export async function generateVideo(input: VideoGenInput): Promise<VideoGenResult> {
  const useMock = process.env.MOCK_LLM === 'true' || !process.env.HIGGSFIELD_API_KEY;
  if (useMock) {
    return generateMockVideo(input);
  }
  return generateWithHiggsfield(input);
}

async function generateWithHiggsfield(input: VideoGenInput): Promise<VideoGenResult> {
  const hiInput: HiggsfieldVideoInput = {
    prompt: input.prompt,
    model: input.model ?? 'seedance',
    durationSeconds: input.durationSeconds ?? 5,
    resolution: input.resolution ?? '720p',
    aspectRatio: input.aspectRatio ?? '9:16',
    imageUrl: input.imageUrl,
  };

  const job = await higgsfieldGenerateVideo(hiInput);
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
 * Mock placeholder: genera un SVG con badge "VIDEO MOCK" + meta del prompt.
 * Non è un vero MP4, ma serve a validare il flusso end-to-end senza spesa.
 * Il mime è image/svg+xml in modo che il salvataggio in storage non rompa.
 */
function generateMockVideo(input: VideoGenInput): VideoGenResult {
  const startedAt = Date.now();
  const aspectRatio = input.aspectRatio ?? '9:16';
  const [arW, arH] = parseAspectRatio(aspectRatio);
  const baseWidth = 800;
  const width = baseWidth;
  const height = Math.round((baseWidth * arH) / arW);

  const safePrompt = escapeXml(input.prompt.slice(0, 220));
  const safeTitle = escapeXml(input.title ?? 'Video mock');
  const duration = input.durationSeconds ?? 5;
  const resolution = input.resolution ?? '720p';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a1a"/>
      <stop offset="100%" stop-color="#2d2d2d"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) * 0.12}" fill="#ffffff" fill-opacity="0.95"/>
  <polygon points="${width / 2 - 18},${height / 2 - 24} ${width / 2 - 18},${height / 2 + 24} ${width / 2 + 26},${height / 2}" fill="#1a1a1a"/>
  <text x="${width / 2}" y="${height * 0.82}" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="600" fill="#ffffff">
    ${safeTitle}
  </text>
  <text x="${width / 2}" y="${height * 0.88}" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" fill="#aaaaaa">
    ${safePrompt}
  </text>
  <text x="20" y="30" font-family="monospace" font-size="11" fill="#ffaa44">
    MOCK VIDEO · ${duration}s · ${resolution} · ${aspectRatio}
  </text>
</svg>`;

  return {
    bytes: Buffer.from(svg, 'utf-8'),
    mime: 'image/svg+xml',
    meta: {
      provider: 'mock',
      modelUsed: 'mock-video',
      elapsedMs: Date.now() - startedAt,
    },
  };
}

function parseAspectRatio(ar: string): [number, number] {
  const parts = ar.split(':').map((n) => Number(n));
  const w = parts[0];
  const h = parts[1];
  if (!w || !h || !Number.isFinite(w) || !Number.isFinite(h)) return [16, 9];
  return [w, h];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
