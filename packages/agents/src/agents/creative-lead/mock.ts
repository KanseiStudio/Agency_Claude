// Mock response del Creative Lead. Parsea il userMessage per estrarre
// deliverable + complessità e genera un concept plausibile.

import type { CreativeLeadOutput } from './schema';

const MOOD_BY_DELIVERABLE: Record<string, string[]> = {
  logo: ['identità', 'memorabile', 'distintivo', 'pulito'],
  image_pack: ['coerente', 'evocativo', 'fotografico'],
  video_reel: ['dinamico', 'ritmico', 'emozionale'],
  social_plan: ['conversazionale', 'autentico', 'immediato'],
  newsletter: ['confidenziale', 'curato', 'personale'],
  landing_page: ['chiaro', 'persuasivo', 'fluido'],
  press_release: ['autorevole', 'sintetico', 'preciso'],
  altro: ['adattabile', 'su misura'],
};

export function buildMockCreativeLeadResponse(userMessage: string): string {
  // Parse deliverable
  const dMatch = userMessage.match(/Deliverable richiesti:\s*(.+)/);
  const captured = dMatch?.[1];
  const deliverables = captured
    ? captured
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['altro'];

  // Parse complessità
  const cMatch = userMessage.match(/Complessità.*?:\s*(\w+)/);
  const complexity = cMatch?.[1] ?? 'moderate';

  // Parse titolo
  const tMatch = userMessage.match(/Titolo:\s*(.+)/);
  const titolo = tMatch?.[1]?.trim() ?? 'Progetto';

  const hasVideo = deliverables.includes('video_reel');
  const hasCopy = deliverables.some((d) =>
    ['social_plan', 'newsletter', 'landing_page', 'press_release'].includes(d),
  );

  const moodSet = new Set<string>(['contemporaneo', 'autentico']);
  for (const d of deliverables) {
    const m = MOOD_BY_DELIVERABLE[d] ?? MOOD_BY_DELIVERABLE.altro!;
    m.forEach((k) => moodSet.add(k));
  }

  const out: CreativeLeadOutput = {
    concept_principale: `${titolo}: un'identità di comunicazione che unisce coerenza estetica e voce riconoscibile, costruita per restare nella memoria del pubblico target senza forzature.`,
    alternative_concepts:
      complexity === 'simple'
        ? []
        : [
            'Approccio editoriale lento, fotografico, con palette desaturata: punta a un\'estetica "premium quiet" anti-iperstimolo.',
            'Approccio pop/bold con tipografia maiuscola, color blocking deciso e ritmo veloce: punta alla riconoscibilità immediata sui social.',
          ],
    brief_copy: hasCopy
      ? `Tono di voce: caldo, diretto, mai gergale. Frasi brevi, soggetto chiaro. Per i social usa una "voce di brand" in prima persona plurale (noi/voi). Per la newsletter, registro più confidenziale. Includi un claim breve (max 6 parole) candidato come payoff. Evita superlativi generici ("il migliore", "unico").`
      : 'Non richiesto in questo progetto.',
    brief_design: `Direzione visiva centrata su: ${[...moodSet].slice(0, 5).join(', ')}. Palette: bilanciata, con un colore primario distintivo + 2 neutri. Tipografia: pairing sans-serif moderno + serif editoriale per accenti. Foto/illustrazione: preferire fotografia naturale, luce ambient, niente stock generico. Format: ${
      deliverables.includes('logo') ? 'logo in versione full + monogramma compatto + b/n; ' : ''
    }${
      deliverables.includes('image_pack') ? 'pacchetto immagini in 1:1, 4:5 e 9:16; ' : ''
    }nessun template piatto.`,
    brief_video: hasVideo
      ? `Reel 15s, ritmo medio, estetica cinematografica leggera. Apertura con hook visivo nei primi 2 secondi (logica swipe-stop). Voiceover opzionale, preferire kinetic typography sincronizzata. Musica: track originale o royalty-free a tema (nessun trend stock di stagione che invecchia in 2 mesi). Output 9:16 + 1:1.`
      : '',
    mood_keywords: [...moodSet].slice(0, 8),
    must_haves: [
      `Logo del brand visibile in posizione coerente su tutti i deliverable visivi`,
      `Tono di voce coerente fra social, newsletter e landing`,
      complexity === 'very_complex' || complexity === 'complex'
        ? 'Versioning chiaro nei file consegnati (v1, v2, v3) per gestire i 3 round di revisione'
        : 'Almeno una variante alternativa per ogni asset chiave',
    ],
    must_avoids: [
      'Cliché generici di settore',
      'Font di sistema (Arial, Times, Comic Sans)',
      'Immagini stock palesemente AI-generated senza ritocco',
      'Claim al superlativo non sostenibili ("il migliore", "il primo")',
    ],
    note:
      complexity === 'very_complex'
        ? 'Progetto molto complesso: suggerito mid-review intermedia con Michele dopo la fase di concept, prima di passare ai deliverable finali.'
        : undefined,
  };

  return JSON.stringify(out);
}
