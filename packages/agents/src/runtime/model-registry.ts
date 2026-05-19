// =========================================================================
// REGISTRY DEI MODELLI DI GENERAZIONE (image + video)
// =========================================================================
//
// >>> QUESTO È IL FILE DA EDITARE PER AGGIUNGERE/RIMUOVERE/AGGIORNARE MODELLI <<<
//
// L'agente Art & Design legge questo registry e propone all'utente una
// shortlist ranked basata sul brief del progetto. L'utente sceglie nel
// pannello admin e l'azione `generateArtDesignAssetAction` instrada al
// runtime corretto.
//
// ---------------------------------------------------------------------------
// COME AGGIORNARE QUESTA LISTA
// ---------------------------------------------------------------------------
// 1. Aggiungere un modello: aggiungi una nuova entry in MODEL_REGISTRY sotto.
//    Compila id, name, provider, type, strengths, whenToUse, costTier.
//    Lascia isWired: false finché il runtime non è implementato.
// 2. Rimuovere un modello: cancella la entry. Se compare ancora in run
//    storiche, recupera il record da agent_outputs (non rompe nulla:
//    semplicemente non sarà più selezionabile nel picker).
// 3. Cablare un modello (passare da isWired:false a true):
//    a) Crea il file runtime in packages/agents/src/runtime/<provider>.ts
//       (es. openai-image.ts) con il client HTTP del provider
//    b) Aggiungi un `case '<model-id>':` in asset-dispatcher.ts che
//       chiama la tua funzione runtime
//    c) Aggiorna .env.example con le env var del provider
//    d) Flippa `isWired: true` qui sotto
//
// ---------------------------------------------------------------------------

export type ModelType = 'image' | 'video';
export type CostTier = 'low' | 'medium' | 'high';

export interface ModelOption {
  /** Identificatore stabile usato in DB + dispatcher. NON cambiarlo se ci sono già run storiche. */
  id: string;
  /** Nome user-facing mostrato in UI. */
  name: string;
  /** Provider tecnico (vendor del modello). */
  provider: string;
  /** Image o video. */
  type: ModelType;
  /** 1–2 sentence summary dei punti di forza. */
  strengths: string;
  /** Quando l'agente dovrebbe consigliarlo (regola euristica per il prompt). */
  whenToUse: string;
  /** Tier di costo per UI. */
  costTier: CostTier;
  /** True se il runtime è già implementato; false se è uno stub. */
  isWired: boolean;
  /** Note operative (es. "richiede image input"). */
  notes?: string;
}

/**
 * Shortlist curata dei modelli "stato dell'arte" che l'agenzia espone.
 * Aggiornata 2026-05-19.
 *
 * IMMAGINI (4): GPT-Image 2, Seedream 5 Lite, Flux 2 Max, Nano Banana 2
 * VIDEO    (3): Seedance 2.0, Kling 3.0 Omni, Veo 3.1
 */
export const MODEL_REGISTRY: ModelOption[] = [
  // ===== IMMAGINI =====
  {
    id: 'openai-gpt-image-2',
    name: 'OpenAI GPT-Image 2',
    provider: 'openai',
    type: 'image',
    strengths:
      "Comprensione prompt ai vertici della categoria, gestione superba di testo embedded nell'immagine, controllo fine di composizione e stile.",
    whenToUse:
      "Quando il deliverable richiede testo nell'immagine (poster con headline, packaging, infografica), forte conoscenza del mondo, o controllo preciso della scena.",
    costTier: 'high',
    isWired: true,
    notes:
      'Richiede OPENAI_API_KEY. Default model API: gpt-image-1 (modificabile via OPENAI_IMAGE_MODEL).',
  },
  {
    id: 'seedream-5-lite',
    name: 'Seedream 5 Lite',
    provider: 'bytedance',
    type: 'image',
    strengths:
      'Foto realismo cinematografico ad alta risoluzione, ottima resa luce naturale e materiali tattili. Variante "Lite" più rapida e a costo medio.',
    whenToUse:
      'Quando serve fotografia editoriale autoriale (ritratti, still life, ambientazioni) con cura della luce e dei materiali. Costo/qualità bilanciato.',
    costTier: 'medium',
    isWired: false,
    notes: "Endpoint ByteDance / accessibile via Higgsfield platform. Da cablare.",
  },
  {
    id: 'flux-2-max',
    name: 'Flux 2 Max',
    provider: 'black-forest-labs',
    type: 'image',
    strengths:
      'Generalist top-tier 2026: mescola foto + illustrazione, comprende prompt complessi, gestisce testo decentemente. Eccelle su composizioni stratificate.',
    whenToUse:
      "Default per asset che mescolano fotografia ed elementi grafici (banner, hero con layer), o quando vuoi un modello tutto-fare di alta qualità.",
    costTier: 'high',
    isWired: false,
    notes: "Endpoint Black Forest Labs (api.bfl.ai) o via Higgsfield V2. Da cablare.",
  },
  {
    id: 'nano-banana-2',
    name: 'Google Nano Banana 2',
    provider: 'google',
    type: 'image',
    strengths:
      'Velocissimo (~2s), molto economico, qualità più che decente nella seconda generazione. Adatto a volumi alti e iterazioni rapide.',
    whenToUse:
      'Per varianti A/B/C, mockup, iterazioni di concept, asset secondari. Quando il tempo di risposta o il costo per asset sono critici.',
    costTier: 'low',
    isWired: false,
    notes: 'Richiede GOOGLE_AI_API_KEY. Endpoint Gemini Image API. Da cablare.',
  },

  // ===== VIDEO =====
  {
    id: 'seedance-2',
    name: 'Seedance 2.0',
    provider: 'bytedance',
    type: 'video',
    strengths:
      "Video generation cinematografico da N keyframe interpolati (5s a 60s+). Qualità foto realistica con motion fluido. Ottimo equilibrio costo/qualità.",
    whenToUse:
      'Per qualsiasi asset_type=video: il sistema genera N keyframe con GPT-Image 2 (uno ogni 5s) e li passa a Seedance che li interpola in sequenza per creare il video finale.',
    costTier: 'medium',
    isWired: true,
    notes:
      "Riceve keyframes[] generati dal flusso. Wiring HTTP ancora stub in runtime/seedance.ts: implementa fal.ai endpoint o ByteDance diretto per attivare la generazione reale.",
  },
  {
    id: 'kling-3-omni',
    name: 'Kling 3.0 Omni',
    provider: 'kuaishou',
    type: 'video',
    strengths:
      'Omni-modal: text-to-video, image-to-video, video-to-video. Forte coerenza temporale, fino a 15s, gestisce scene complesse e dialoghi.',
    whenToUse:
      "Quando serve flessibilità input (a volte text-only, a volte da un'immagine), o video più articolati con scene multiple.",
    costTier: 'high',
    isWired: false,
    notes: 'Endpoint Kuaishou / via Higgsfield platform. Da cablare.',
  },
  {
    id: 'veo-3-1',
    name: 'Google Veo 3.1',
    provider: 'google',
    type: 'video',
    strengths:
      'Top tier video 2026: fino a 60s, qualità cinematica + audio nativo (musica, foley, dialoghi), comprensione fisica e camera direction superlative.',
    whenToUse:
      "Per spot premium 15–60s, narrazioni con audio, deliverable di alto valore. Costoso ma è il top assoluto per text-to-video puro.",
    costTier: 'high',
    isWired: false,
    notes: 'Richiede GOOGLE_AI_API_KEY o via Higgsfield V2. Da cablare.',
  },
];

export function getModelById(id: string): ModelOption | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export function getModelsByType(type: ModelType): ModelOption[] {
  return MODEL_REGISTRY.filter((m) => m.type === type);
}

/**
 * Per il prompt dell'agente: produce un blocco testuale leggibile della
 * registry, da iniettare nel system prompt così l'LLM sa cosa ha a
 * disposizione e con quali criteri proporlo.
 */
export function formatRegistryForPrompt(): string {
  return MODEL_REGISTRY.map(
    (m, i) =>
      `${i + 1}. id: "${m.id}" | ${m.name} | tipo: ${m.type} | cost: ${m.costTier}${m.isWired ? '' : ' (NOT YET WIRED)'}\n   Punti di forza: ${m.strengths}\n   Quando consigliarlo: ${m.whenToUse}${m.notes ? '\n   Note: ' + m.notes : ''}`,
  ).join('\n\n');
}
