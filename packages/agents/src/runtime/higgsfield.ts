// Client HTTP per Higgsfield (image + video generation).
//
// Higgsfield espone la propria API su `platform.higgsfield.ai` con
// auth-header speciale `Authorization: Key KEY_ID:KEY_SECRET`.
// Riferimenti: https://github.com/higgsfield-ai/higgsfield-js (SDK ufficiale).
//
// In alternativa è possibile puntare il client su un proxy Segmind
// (api.segmind.com) configurando le env var di base/header/endpoint.
//
// Env supportate:
//   - HIGGSFIELD_API_BASE_URL   (default "https://platform.higgsfield.ai")
//   - HIGGSFIELD_API_KEY        (formato "KEY_ID:KEY_SECRET" per cloud diretto)
//   - HIGGSFIELD_AUTH_HEADER    (default "Authorization")
//   - HIGGSFIELD_AUTH_PREFIX    (default "Key ", trailing space incluso)
//   - HIGGSFIELD_IMAGE_ENDPOINT (default "/v1/text2image/soul")
//   - HIGGSFIELD_VIDEO_ENDPOINT (default "/v1/image2video/dop")
//   - HIGGSFIELD_IMAGE_QUALITY  (default "HD" - solo per Soul)
//   - HIGGSFIELD_VIDEO_MODEL    (default "dop-turbo")
//
// Pattern async: submit job → ricevi status_url (assoluto) → poll status → leggi images[0].url o video.url

export interface HiggsfieldImageInput {
  prompt: string;
  /** Modello: per ora supportiamo "soul" (Higgsfield's image model). */
  model?: string;
  width?: number;
  height?: number;
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9' | '3:4';
  /** Stile/preset opzionale (Soul style id). */
  style?: string;
  /** Seed per riproducibilità. */
  seed?: number;
  /** Quality: "720p" o "1080p" (default da env). */
  quality?: '720p' | '1080p';
}

export interface HiggsfieldVideoInput {
  prompt: string;
  /** Modello DoP: "dop-turbo" (default) o altri esposti dalla API. */
  model?: string;
  durationSeconds?: 5 | 10;
  resolution?: '480p' | '720p' | '1080p';
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  /** URL pubblico dell'immagine input (Higgsfield DoP fa image-to-video, non text-to-video puro). */
  imageUrl?: string;
  seed?: number;
}

export interface HiggsfieldResult {
  /** URL del file generato (immagine PNG/WebP o video MP4). */
  url: string;
  /** MIME del file. */
  mime: string;
  /** Modello reale usato (per logging). */
  modelUsed: string;
  /** Costo in crediti Higgsfield (se ritornato dalla API). */
  creditsCost?: number;
  /** Tempo di generazione end-to-end in ms. */
  elapsedMs: number;
}

function getConfig() {
  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) {
    throw new Error(
      'HIGGSFIELD_API_KEY non configurata. Imposta MOCK_LLM=true oppure aggiungi la key in .env (formato KEY_ID:KEY_SECRET per cloud diretto).',
    );
  }
  return {
    baseUrl: (process.env.HIGGSFIELD_API_BASE_URL ?? 'https://platform.higgsfield.ai').replace(
      /\/$/,
      '',
    ),
    apiKey,
    authHeader: process.env.HIGGSFIELD_AUTH_HEADER ?? 'Authorization',
    authPrefix: process.env.HIGGSFIELD_AUTH_PREFIX ?? 'Key ',
    imageEndpoint: process.env.HIGGSFIELD_IMAGE_ENDPOINT ?? '/v1/text2image/soul',
    videoEndpoint: process.env.HIGGSFIELD_VIDEO_ENDPOINT ?? '/v1/image2video/dop',
    pollIntervalMs: Number(process.env.HIGGSFIELD_POLL_INTERVAL_MS ?? 3000),
    maxPollAttempts: Number(process.env.HIGGSFIELD_MAX_POLL_ATTEMPTS ?? 60),
    imageQuality: normalizeSoulQuality(process.env.HIGGSFIELD_IMAGE_QUALITY ?? '1080p'),
    videoModel: process.env.HIGGSFIELD_VIDEO_MODEL ?? 'dop-turbo',
  };
}

function buildHeaders() {
  const cfg = getConfig();
  // Garantisce uno spazio tra prefix e key se il prefix non termina già
  // con whitespace. I parser dotenv tipicamente strippano gli spazi a
  // fine valore, quindi "Key " in .env diventa "Key" — qui rimettiamo
  // lo spazio se serve. Se invece il prefix è vuoto (es. Segmind con
  // x-api-key) non aggiungiamo nulla.
  const prefix = cfg.authPrefix;
  const sep = prefix.length > 0 && !/\s$/.test(prefix) ? ' ' : '';
  return {
    'Content-Type': 'application/json',
    [cfg.authHeader]: `${prefix}${sep}${cfg.apiKey}`,
  };
}

/**
 * Genera un'immagine via Higgsfield Soul (text-to-image).
 */
export async function higgsfieldGenerateImage(
  input: HiggsfieldImageInput,
): Promise<HiggsfieldResult> {
  const startedAt = Date.now();
  const cfg = getConfig();

  // Soul accetta width_and_height in formato "WxH". Adatta dalle dimensioni
  // richieste con fallback al quadrato 1024.
  // Soul ha sizes "canoniche" (1024x1024, 1536x1536, 1536x2048, 2048x1536).
  // Mappiamo la dimensione richiesta dall'agente alla più vicina valida.
  const widthAndHeight = pickSoulSize(input.width ?? 1024, input.height ?? 1024);

  // La API si aspetta i parametri wrappati in `params`.
  const params: Record<string, unknown> = {
    prompt: input.prompt,
    width_and_height: widthAndHeight,
    quality: input.quality ?? cfg.imageQuality,
    batch_size: 1,
  };
  if (input.style) params.style_id = input.style;
  if (typeof input.seed === 'number') params.seed = input.seed;

  const body = { params };

  const imageUrl = `${cfg.baseUrl}${cfg.imageEndpoint}`;
  const submitResp = await fetch(imageUrl, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!submitResp.ok) {
    const text = await submitResp.text();
    throw new Error(
      `Higgsfield image submit failed (${submitResp.status}) @ POST ${imageUrl}: ${text.slice(0, 500) || '(empty body)'}`,
    );
  }

  const submitJson = (await submitResp.json()) as Record<string, unknown>;

  // Caso A: risposta sincrona (alcune deployment ritornano subito images[])
  const directUrl = extractImageUrl(submitJson);
  if (directUrl && isCompleted(submitJson)) {
    return {
      url: directUrl,
      mime: inferMime(directUrl, 'image/png'),
      modelUsed: String(submitJson.model ?? input.model ?? 'soul'),
      creditsCost: numberOrUndefined(submitJson.credits_cost ?? submitJson.cost),
      elapsedMs: Date.now() - startedAt,
    };
  }

  // Caso B: async. La API può ritornare:
  //   - status_url esplicito (formato "moderno" tipo SDK README), OPPURE
  //   - solo `id` (job_set id) → costruiamo `{baseUrl}/requests/{id}/status`
  const statusUrl = resolveStatusUrl(submitJson, cfg.baseUrl);
  if (!statusUrl) {
    throw new Error(
      `Higgsfield image: risposta non riconosciuta (manca status_url, id e images): ${JSON.stringify(submitJson).slice(0, 300)}`,
    );
  }

  const result = await pollUntilReady(statusUrl, cfg);
  return {
    url: result.url,
    mime: inferMime(result.url, 'image/png'),
    modelUsed: result.modelUsed ?? input.model ?? 'soul',
    creditsCost: result.creditsCost,
    elapsedMs: Date.now() - startedAt,
  };
}

/**
 * Genera un video via Higgsfield DoP (image-to-video).
 * NOTA: Higgsfield non espone un text-to-video puro: serve un'immagine di
 * partenza. Se vuoi un video da prompt testo, prima genera un'immagine
 * con higgsfieldGenerateImage, poi passa la sua URL pubblica qui.
 */
export async function higgsfieldGenerateVideo(
  input: HiggsfieldVideoInput,
): Promise<HiggsfieldResult> {
  const startedAt = Date.now();
  const cfg = getConfig();

  if (!input.imageUrl) {
    throw new Error(
      'Higgsfield video: campo imageUrl obbligatorio (Higgsfield DoP fa image-to-video, non text-to-video).',
    );
  }

  // La API si aspetta i parametri wrappati in `params`.
  const params: Record<string, unknown> = {
    model: input.model ?? cfg.videoModel,
    prompt: input.prompt,
    input_images: [{ type: 'image_url', image_url: input.imageUrl }],
  };
  if (typeof input.seed === 'number') params.seed = input.seed;

  const body = { params };

  const videoUrl = `${cfg.baseUrl}${cfg.videoEndpoint}`;
  const submitResp = await fetch(videoUrl, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!submitResp.ok) {
    const text = await submitResp.text();
    throw new Error(
      `Higgsfield video submit failed (${submitResp.status}) @ POST ${videoUrl}: ${text.slice(0, 500) || '(empty body)'}`,
    );
  }

  const submitJson = (await submitResp.json()) as Record<string, unknown>;

  const directUrl = extractVideoUrl(submitJson);
  if (directUrl && isCompleted(submitJson)) {
    return {
      url: directUrl,
      mime: inferMime(directUrl, 'video/mp4'),
      modelUsed: String(submitJson.model ?? params.model),
      creditsCost: numberOrUndefined(submitJson.credits_cost ?? submitJson.cost),
      elapsedMs: Date.now() - startedAt,
    };
  }

  const statusUrl = resolveStatusUrl(submitJson, cfg.baseUrl);
  if (!statusUrl) {
    throw new Error(
      `Higgsfield video: risposta non riconosciuta (manca status_url, id e video): ${JSON.stringify(submitJson).slice(0, 300)}`,
    );
  }

  const result = await pollUntilReady(statusUrl, cfg);
  return {
    url: result.url,
    mime: inferMime(result.url, 'video/mp4'),
    modelUsed: result.modelUsed ?? String(params.model),
    creditsCost: result.creditsCost,
    elapsedMs: Date.now() - startedAt,
  };
}

/**
 * Funzione generica per chiamare QUALSIASI endpoint Higgsfield:
 * submit → poll → download. Usata da seedance.ts, openai-image.ts e
 * altri runtime che si appoggiano alla piattaforma Higgsfield.
 *
 * Auth è uguale per tutti gli endpoint (Authorization: Key KEY_ID:KEY_SECRET).
 * Il caller passa endpoint + body specifico del modello.
 *
 * @param endpoint  path relativo (es. "/v1/image2video/seedance") OPPURE
 *                  URL completo (es. "https://fnf.higgsfield.ai/jobs/v2/seedance_2_0").
 *                  Se inizia con http:// o https:// viene usato as-is; altrimenti
 *                  viene appeso a HIGGSFIELD_API_BASE_URL.
 * @param body      payload specifico del modello (verrà wrappato in {params})
 *                  se non lo è già
 * @param fallbackMime mime di default se non rilevabile dal file
 */
export async function higgsfieldSubmitAndDownload(
  endpoint: string,
  body: Record<string, unknown>,
  fallbackMime: 'image/png' | 'video/mp4',
): Promise<{
  bytes: Buffer;
  mime: string;
  modelUsed: string;
  elapsedMs: number;
  creditsCost?: number;
}> {
  const startedAt = Date.now();
  const cfg = getConfig();

  // Auto-wrap in `params` se il caller non l'ha già fatto (Higgsfield si
  // aspetta {params: {...}} per la maggior parte degli endpoint).
  const wrappedBody = 'params' in body ? body : { params: body };

  // Endpoint può essere path relativo (concatenato al base) o URL completo
  // (usato as-is) — la nuova API jobs su fnf.higgsfield.ai usa un sottodominio
  // diverso da platform.higgsfield.ai, quindi serve poter passare URL pieni.
  const submitUrl = /^https?:\/\//i.test(endpoint)
    ? endpoint
    : `${cfg.baseUrl}${endpoint}`;
  const submitResp = await fetch(submitUrl, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(wrappedBody),
  });

  if (!submitResp.ok) {
    const text = await submitResp.text();
    throw new Error(
      `Higgsfield submit failed (${submitResp.status}) @ POST ${submitUrl}: ${text.slice(0, 500) || '(empty body)'}`,
    );
  }

  const submitJson = (await submitResp.json()) as Record<string, unknown>;

  // Risposta sincrona (rara ma possibile)
  const directUrl = extractAssetUrl(submitJson);
  let assetUrl: string | undefined;
  let modelUsed: string | undefined;
  let creditsCost: number | undefined;

  if (directUrl && isCompleted(submitJson)) {
    assetUrl = directUrl;
    modelUsed = pickString(submitJson, ['model', 'model_used']) ?? undefined;
    creditsCost = numberOrUndefined(submitJson.credits_cost ?? submitJson.cost);
  } else {
    // Async: costruisci status_url da id se non esplicito.
    // Usiamo l'origin del submitUrl (non cfg.baseUrl) perché i job sulla
    // nuova API fnf.higgsfield.ai vivono su un sottodominio diverso.
    const submitOrigin = new URL(submitUrl).origin;
    const statusUrl = resolveStatusUrl(submitJson, submitOrigin);
    if (!statusUrl) {
      throw new Error(
        `Higgsfield: response submit senza status_url, id, o asset URL diretto: ${JSON.stringify(submitJson).slice(0, 300)}`,
      );
    }
    const polled = await pollUntilReady(statusUrl, cfg);
    assetUrl = polled.url;
    modelUsed = polled.modelUsed;
    creditsCost = polled.creditsCost;
  }

  // Download del file
  const asset = await downloadAsset(assetUrl);
  return {
    bytes: asset.bytes,
    mime: asset.mime ?? fallbackMime,
    modelUsed: modelUsed ?? endpoint,
    elapsedMs: Date.now() - startedAt,
    creditsCost,
  };
}

/**
 * Scarica un asset da URL HTTP. Utile per scaricare il file generato
 * da Higgsfield e salvarlo nel nostro storage.
 */
export async function downloadAsset(url: string): Promise<{ bytes: Buffer; mime: string }> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Download asset fallito (${resp.status}): ${url}`);
  }
  const mime = resp.headers.get('content-type') ?? inferMime(url, 'application/octet-stream');
  const arrayBuffer = await resp.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    mime,
  };
}

// ---------- helpers privati ----------

async function pollUntilReady(
  statusUrl: string,
  cfg: ReturnType<typeof getConfig>,
): Promise<{ url: string; modelUsed?: string; creditsCost?: number }> {
  for (let attempt = 0; attempt < cfg.maxPollAttempts; attempt++) {
    await sleep(cfg.pollIntervalMs);

    const resp = await fetch(statusUrl, {
      headers: buildHeaders(),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Polling fallito (${resp.status}) @ GET ${statusUrl}: ${text.slice(0, 300)}`);
    }
    const json = (await resp.json()) as Record<string, unknown>;
    const status = aggregateJobStatus(json);

    if (status === 'completed' || status === 'success' || status === 'done') {
      const url = extractAssetUrl(json);
      if (!url) {
        throw new Error(
          `Status completed ma manca URL del risultato: ${JSON.stringify(json).slice(0, 300)}`,
        );
      }
      return {
        url,
        modelUsed: pickString(json, ['model', 'model_used']) ?? undefined,
        creditsCost: numberOrUndefined(json.credits_cost ?? json.cost),
      };
    }

    if (status === 'failed' || status === 'error' || status === 'nsfw') {
      const errMsg = pickString(json, ['error', 'message', 'failure_reason']) ?? status;
      throw new Error(`Higgsfield job fallito (${status}): ${errMsg}`);
    }
    // status === 'queued' | 'in_progress' | 'pending' | 'processing' → continua polling
  }
  throw new Error(
    `Higgsfield: timeout dopo ${cfg.maxPollAttempts} tentativi (~${(cfg.pollIntervalMs * cfg.maxPollAttempts) / 1000}s)`,
  );
}

function isCompleted(json: Record<string, unknown>): boolean {
  const status = String(json.status ?? json.state ?? '').toLowerCase();
  return status === 'completed' || status === 'success' || status === 'done' || status === '';
}

/**
 * Estrae lo status_url da una submit response.
 * Casi gestiti:
 *   1. La API ritorna status_url esplicito (shape "SDK README")
 *   2. La API ritorna solo `id` (job_set id) → costruiamo
 *      `{baseUrl}/requests/{id}/status`
 *   3. La API ritorna `request_id` → idem ma con request_id
 */
function resolveStatusUrl(json: Record<string, unknown>, baseUrl: string): string | null {
  const explicit = pickString(json, ['status_url', 'statusUrl', 'poll_url']);
  if (explicit) return explicit;
  const id = pickString(json, ['request_id', 'requestId', 'id', 'job_set_id', 'job_id']);
  if (id) return `${baseUrl.replace(/\/$/, '')}/requests/${id}/status`;
  return null;
}

/**
 * Determina lo status complessivo del job aggregando top-level e jobs[].
 * La API live ritorna `status` sia a livello top sia dentro `jobs[]`.
 * Consideriamo completato solo quando TUTTI i job hanno completato.
 */
function aggregateJobStatus(json: Record<string, unknown>): string {
  const topStatus = String(json.status ?? json.state ?? '').toLowerCase();
  const jobs = json.jobs;
  if (Array.isArray(jobs) && jobs.length > 0) {
    const statuses = jobs.map((j) =>
      String((j as Record<string, unknown>).status ?? '').toLowerCase(),
    );
    if (statuses.every((s) => s === 'completed' || s === 'success' || s === 'done'))
      return 'completed';
    if (statuses.some((s) => s === 'failed' || s === 'error' || s === 'nsfw' || s === 'canceled'))
      return statuses.find((s) => s !== 'completed' && s !== '') ?? 'failed';
    return topStatus || 'in_progress';
  }
  return topStatus;
}

function extractImageUrl(json: Record<string, unknown>): string | null {
  // Shape moderna Higgsfield: { images: [{ url: ... }] }
  // Shape "raw/min" interna: { images: [{ raw: { url }, min: { url } }] }
  const fromImages = pickFromArray(json, ['images', 'output', 'results', 'jobs']);
  if (fromImages) return fromImages;
  return pickString(json, ['image_url', 'output_url', 'url', 'result_url']);
}

function extractVideoUrl(json: Record<string, unknown>): string | null {
  // Shape moderna Higgsfield: { video: { url: ... } } o { videos: [{ url }] }
  const singleVideo = json.video;
  if (singleVideo && typeof singleVideo === 'object') {
    const u = pickString(singleVideo as Record<string, unknown>, ['url', 'video_url']);
    if (u) return u;
  }
  const fromArr = pickFromArray(json, ['videos', 'output', 'results', 'jobs']);
  if (fromArr) return fromArr;
  return pickString(json, ['video_url', 'output_url', 'url', 'result_url']);
}

function extractAssetUrl(json: Record<string, unknown>): string | null {
  return extractImageUrl(json) ?? extractVideoUrl(json);
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function pickFromArray(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v) && v.length > 0) {
      const first = v[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object') {
        const firstObj = first as Record<string, unknown>;
        // direct url field
        const direct = pickString(firstObj, ['url', 'image_url', 'video_url']);
        if (direct) return direct;
        // nested results.raw.url / results.min.url (Higgsfield SDK shape)
        const results = firstObj.results;
        if (results && typeof results === 'object') {
          const r = results as Record<string, unknown>;
          const raw = r.raw;
          if (raw && typeof raw === 'object') {
            const u = pickString(raw as Record<string, unknown>, ['url']);
            if (u) return u;
          }
          const min = r.min;
          if (min && typeof min === 'object') {
            const u = pickString(min as Record<string, unknown>, ['url']);
            if (u) return u;
          }
        }
      }
    }
  }
  return null;
}

function numberOrUndefined(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Mappa una richiesta arbitraria (es. 1920x1080) alla taglia canonica Soul
 * con aspect ratio più vicino. Soul accetta solo un set chiuso di sizes;
 * inviare dimensioni custom causa 422.
 *
 * Lista valida (rilevata via 422 dell'API, aggiornata 2026-05-15):
 *   1152x2048 (9:16), 2048x1152 (16:9), 2048x1536 (4:3), 1536x2048 (3:4),
 *   1344x2016 (2:3), 2016x1344 (3:2), 960x1696, 1536x1536 (1:1),
 *   1536x1152, 1696x960, 1152x1536, 1088x1632, 1632x1088,
 *   1120x1680, 1680x1120, 2048x2048 (1:1 large)
 *
 * Strategia: scegliamo prima per AR (minima differenza), e a parità di AR
 * preferiamo la size con più pixel totali (qualità migliore).
 */
/**
 * Normalizza un valore di quality verso le label live attese da Soul.
 * La API attualmente accetta SOLO '720p' | '1080p'. Per retrocompatibilità
 * con valori SDK ("HD", "FAST") li convertiamo: HD → 1080p, FAST → 720p.
 */
function normalizeSoulQuality(raw: string): '720p' | '1080p' {
  const v = raw.trim().toLowerCase();
  if (v === '720p' || v === '720') return '720p';
  if (v === '1080p' || v === '1080') return '1080p';
  if (v === 'fast') return '720p';
  if (v === 'hd' || v === 'high') return '1080p';
  return '1080p';
}

function pickSoulSize(requestedW: number, requestedH: number): string {
  const VALID: Array<[number, number]> = [
    [1152, 2048], // 9:16
    [2048, 1152], // 16:9
    [2048, 1536], // 4:3
    [1536, 2048], // 3:4
    [1344, 2016], // 2:3
    [2016, 1344], // 3:2
    [960, 1696], // ~9:16
    [1536, 1536], // 1:1
    [1536, 1152], // 4:3 (smaller)
    [1696, 960], // 16:9 (smaller)
    [1152, 1536], // 3:4 (smaller)
    [1088, 1632], // 2:3 (smaller)
    [1632, 1088], // 3:2 (smaller)
    [1120, 1680], // 2:3
    [1680, 1120], // 3:2
    [2048, 2048], // 1:1 large
  ];
  const requestedRatio = requestedW / requestedH;
  let best = VALID[0]!;
  let bestDiff = Infinity;
  let bestArea = 0;
  for (const [w, h] of VALID) {
    const diff = Math.abs(w / h - requestedRatio);
    const area = w * h;
    if (diff < bestDiff - 0.0001 || (Math.abs(diff - bestDiff) < 0.0001 && area > bestArea)) {
      bestDiff = diff;
      bestArea = area;
      best = [w, h];
    }
  }
  return `${best[0]}x${best[1]}`;
}

function inferMime(url: string, fallback: string): string {
  const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
  };
  return map[ext] ?? fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
