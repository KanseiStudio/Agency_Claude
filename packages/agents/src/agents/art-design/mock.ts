// Mock response dell'Art & Design Agent.
// Produce art direction + UN solo primary_asset + 3-5 modelli ranked dal registry.

import type { ArtDesignOutput, PrimaryAsset, ModelRecommendation, ImageBrief } from './schema';

const MOCK_PALETTES: Array<
  Array<{
    name: string;
    hex: string;
    role: 'primary' | 'accent' | 'neutral-light' | 'neutral-dark' | 'background';
  }>
> = [
  [
    { name: 'terracotta', hex: '#C56B43', role: 'primary' },
    { name: 'ottanio profondo', hex: '#1F4E5F', role: 'accent' },
    { name: 'crema calda', hex: '#F5E9D7', role: 'neutral-light' },
    { name: 'nero inchiostro', hex: '#1A1A1A', role: 'neutral-dark' },
    { name: 'sfondo carta', hex: '#FAF6EE', role: 'background' },
  ],
  [
    { name: 'verde salvia', hex: '#849B7A', role: 'primary' },
    { name: 'oro brunito', hex: '#B38B3F', role: 'accent' },
    { name: 'beige nebbia', hex: '#EAE3D2', role: 'neutral-light' },
    { name: 'antracite', hex: '#2D2D2D', role: 'neutral-dark' },
    { name: 'fondo crema', hex: '#FBF7EE', role: 'background' },
  ],
];

export function buildMockArtDesignResponse(userMessage: string): string {
  // Parse deliverable
  const dMatch = userMessage.match(/Deliverable richiesti:\s*(.+)/);
  const captured = dMatch?.[1];
  const deliverables = captured
    ? captured
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['altro'];

  // Parse titolo
  const tMatch = userMessage.match(/Titolo:\s*(.+)/);
  const titolo = tMatch?.[1]?.trim() ?? 'progetto';

  // Parse mood keywords
  const mMatch = userMessage.match(/Mood keywords:\s*(.+)/);
  const moodKeywords = mMatch?.[1]
    ? mMatch[1].split(',').map((s) => s.trim())
    : ['contemporaneo', 'autentico'];

  // Detect video intent: se brief contiene "video", "reel", "spot" o se il
  // userMessage include "Brief Video" → asset_type = video.
  const hasVideoBrief = /Brief Video del Creative Lead/i.test(userMessage);
  const videoDeliverable = deliverables.some((d) =>
    /video|reel|spot|motion/i.test(d),
  );
  const assetType: PrimaryAsset['asset_type'] = hasVideoBrief || videoDeliverable ? 'video' : 'image';

  // Parse briefVideo (se presente nel userMessage)
  const bvMatch = userMessage.match(
    /Brief Video del Creative Lead:\s*([\s\S]*?)(?:\n\nMood keywords:|\n\nMust have:|\n\nMust avoid:|$)/i,
  );
  const briefVideoText = bvMatch?.[1]?.trim() ?? '';

  // Scegli palette pseudo-random basandoti sul titolo (deterministico)
  const paletteIndex = (titolo.charCodeAt(0) ?? 0) % MOCK_PALETTES.length;
  const palette = MOCK_PALETTES[paletteIndex]!;

  const primary = palette.find((p) => p.role === 'primary')?.name ?? 'warm earth';
  const accent = palette.find((p) => p.role === 'accent')?.name ?? 'deep teal';
  const neutral = palette.find((p) => p.role === 'neutral-light')?.name ?? 'cream';
  const moodEn = moodKeywords.slice(0, 3).join(', ');

  // Costruisci primary_asset coerente con il concept
  const primary_asset: PrimaryAsset =
    assetType === 'video'
      ? buildVideoAsset(titolo, primary, accent, neutral, moodEn, briefVideoText)
      : {
          asset_type: 'image',
          title: `Hero image · ${titolo}`,
          prompt: `Editorial hero photography for "${titolo}", refined still life with warm natural light, shallow depth of field. Color palette: ${primary} dominant with ${accent} accent and ${neutral} negative space. ${moodEn} aesthetic, photorealistic, painterly mood, no text overlay, no people's faces.`,
          aspect_ratio: '1:1',
          width: 1536,
          height: 1536,
          rationale: `Una sola immagine "hero" che condensa il concept "${titolo}" — composizione editoriale che funziona sia su feed quadrato che come asset principale di press kit.`,
        };

  // Ranking modelli: il rank 1 deve essere del tipo giusto.
  // Gli ID DEVONO corrispondere a quelli in MODEL_REGISTRY (model-registry.ts).
  const recommended_models: ModelRecommendation[] =
    assetType === 'video'
      ? [
          {
            model_id: 'veo-3-1',
            rank: 1,
            motivation:
              'Brief richiede video con atmosfera cinematica e potenzialmente audio: Veo 3.1 è il top assoluto 2026 per text-to-video con audio nativo.',
          },
          {
            model_id: 'kling-3-omni',
            rank: 2,
            motivation:
              'Alternativa premium se vogliamo scene multiple complesse: Kling 3.0 Omni gestisce text/image/video-to-video fino a 15s con buona coerenza temporale.',
          },
          {
            model_id: 'seedance-2',
            rank: 3,
            motivation:
              "Opzione costo/qualità per spot social più brevi (5–10s): Seedance 2.0 dà output cinematografico a budget contenuto.",
          },
        ]
      : [
          {
            model_id: 'flux-2-max',
            rank: 1,
            motivation:
              'Hero image con composizione editoriale: Flux 2 Max è il generalist top-tier 2026 e gestisce mix foto+grafica e prompt complessi.',
          },
          {
            model_id: 'seedream-5-lite',
            rank: 2,
            motivation:
              "Alternativa per fotografia editoriale pura: Seedream 5 Lite eccelle su luce naturale e materiali tattili, qualità cinematografica.",
          },
          {
            model_id: 'openai-gpt-image-2',
            rank: 3,
            motivation:
              "Da considerare se in futuro vogliamo elementi tipografici o testo embedded nell'asset: GPT-Image 2 è il migliore per testo nelle immagini.",
          },
          {
            model_id: 'nano-banana-2',
            rank: 4,
            motivation:
              "Se preferiamo iterare velocemente sulla composizione prima dell'HD finale, Nano Banana 2 risponde in ~2s a costo basso.",
          },
        ];

  const out: ArtDesignOutput = {
    art_direction: {
      palette,
      typography: {
        headline_font_family: 'Recoleta',
        body_font_family: 'Inter',
        style_notes:
          "Headline in Recoleta semibold con tracking leggero per presenza editoriale; body in Inter regular per leggibilità multi-formato. Evitare allcaps tranne nel logo. Gerarchia: hero 48-72px, sub 24-32px, body 16-18px.",
      },
      style_keywords: [...moodKeywords.slice(0, 4), 'editoriale', 'artigianale', 'contemporaneo'],
      references: [
        'estetica editoriale italiana anni 70 (es. riviste Domus, Linea Grafica)',
        "Aesop's print campaigns: minimal, attento alla materia",
        'still life di Brunello Cucinelli: luce naturale, palette terrose, niente Photoshop aggressivo',
      ],
    },
    primary_asset,
    recommended_models,
  };

  return JSON.stringify(out);
}

/**
 * Costruisce un primary_asset video.
 *
 * Quando il Creative Lead ha prodotto un briefVideo, lo usiamo VERBATIM come
 * `prompt` (filosofia: il brief è "vangelo", l'agente non deve riscriverlo).
 * I keyframe vengono derivati provando a estrarre frasi/scene dal brief,
 * con un fallback su template generico se il brief è troppo corto.
 */
function buildVideoAsset(
  titolo: string,
  primary: string,
  accent: string,
  neutral: string,
  moodEn: string,
  briefVideoText: string,
): PrimaryAsset {
  // Cerca di estrarre la durata dal briefVideo (es. "Reel video 9:16, durata 15 secondi")
  const durationMatch = briefVideoText.match(/durat[ai]\s+(\d+)\s*sec/i);
  const duration =
    durationMatch && durationMatch[1]
      ? clampDurationToMultipleOf5(parseInt(durationMatch[1], 10))
      : 15;
  const n = duration / 5 + 1;

  // Cerca aspect ratio dal brief (es. "9:16 verticale", "16:9 landscape")
  const aspectMatch = briefVideoText.match(/(\d+):(\d+)/);
  const aspectRatio: '9:16' | '16:9' | '1:1' | '4:5' =
    aspectMatch && aspectMatch[0] === '16:9'
      ? '16:9'
      : aspectMatch && aspectMatch[0] === '1:1'
        ? '1:1'
        : aspectMatch && aspectMatch[0] === '4:5'
          ? '4:5'
          : '9:16';

  const NARRATIVE_LABELS = [
    'Opening',
    'Build-up',
    'Climax',
    'Resolution',
    'Coda',
    'Outro',
  ];

  // Spezzetta il brief in N frammenti (uno per keyframe), grossolanamente.
  const briefChunks = splitBriefIntoChunks(briefVideoText, n);

  const image_briefs: ImageBrief[] = Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    title: `${NARRATIVE_LABELS[i] ?? `Beat ${i + 1}`} · ${titolo}`,
    prompt:
      briefChunks[i] && briefChunks[i]!.length > 30
        ? // Keyframe specifico estratto dal brief, riformulato in inglese per il modello
          `Frame ${i + 1} of ${n}, narrative beat: ${briefChunks[i]}. Same subject and setting as the other frames. Color palette: ${primary} dominant, ${accent} accent, ${neutral} negative space. Photorealistic, ${moodEn}, NO embedded text.`
        : // Fallback: template generico (solo se il brief non basta)
          `Frame ${i + 1} of ${n} for "${titolo}", continuation of the narrative described in the global prompt. Same subject, same setting, same lighting. Color palette: ${primary}, ${accent}, ${neutral}. Photorealistic, ${moodEn}, NO embedded text.`,
  }));

  // Dimensioni base per l'asset (aspect ratio dipendente)
  const dims = aspectRatio === '16:9' ? [1920, 1080] : aspectRatio === '1:1' ? [1080, 1080] : aspectRatio === '4:5' ? [1080, 1350] : [1080, 1920];

  return {
    asset_type: 'video',
    title: `Spot hero · ${titolo}`,
    // ⚠️ PROMPT = briefVideo verbatim (sarà comunque rinforzato dall'override
    // server-side in runArtDesignAction, ma manteniamo coerenza già nel mock).
    prompt: briefVideoText.length > 30
      ? briefVideoText
      : `Cinematic ${duration}-second hero spot for "${titolo}". Color palette: ${primary} dominant with ${accent} accent. ${moodEn} mood.`,
    aspect_ratio: aspectRatio,
    width: dims[0]!,
    height: dims[1]!,
    duration_seconds: duration,
    image_briefs,
    rationale: `Il brief Creative Lead richiede uno spot ${duration}s ${aspectRatio}: produciamo ${n} keyframe derivati dal brief che Seedance interpolerà in sequenza.`,
  };
}

function clampDurationToMultipleOf5(d: number): number {
  if (d < 5) return 5;
  if (d > 60) return 60;
  return Math.round(d / 5) * 5;
}

/**
 * Spezzetta un brief in N segmenti narrativi grossolani.
 * Heuristica: split su righe vuote / numeri di scena / punti di "STRUTTURA:" /
 * frasi separate da "."  — poi gruppi di N circa uguali.
 */
function splitBriefIntoChunks(brief: string, n: number): string[] {
  if (!brief || brief.length < 50) return Array.from({ length: n }, () => '');

  // Prova prima a splittare per scene marker (es. "[Sec 0-3]", "Scena 1:")
  const sceneMarkers = brief.split(/\n?\[?\s*(?:Sec|Scena|Scene)\s*[\d\-:]+\]?\s*/i).filter(s => s.trim().length > 10);
  if (sceneMarkers.length >= n) {
    return sceneMarkers.slice(0, n).map(s => s.trim());
  }

  // Altrimenti split per righe vuote
  const paragraphs = brief.split(/\n\s*\n/).filter(p => p.trim().length > 10);
  if (paragraphs.length >= n) {
    return paragraphs.slice(0, n).map(p => p.trim());
  }

  // Altrimenti split per punto fermo
  const sentences = brief.split(/(?<=\.)\s+/).filter(s => s.trim().length > 10);
  if (sentences.length >= n) {
    const chunkSize = Math.floor(sentences.length / n);
    const chunks: string[] = [];
    for (let i = 0; i < n; i++) {
      const start = i * chunkSize;
      const end = i === n - 1 ? sentences.length : start + chunkSize;
      chunks.push(sentences.slice(start, end).join(' '));
    }
    return chunks;
  }

  // Fallback: tutti i keyframe ricevono l'intero brief come contesto
  return Array.from({ length: n }, () => brief);
}
