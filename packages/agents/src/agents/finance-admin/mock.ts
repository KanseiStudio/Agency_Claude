// Risposta canned del Finance/Admin agent in modalità MOCK_LLM.
// Calcola un preventivo plausibile parsando il userMessage (che ha
// formato standard prodotto da prompt.ts), rispettando il vincolo gap <= 15%.

import type { FinanceAdminOutput, QuoteItem } from './schema';

const DELIVERABLE_PRICING: Record<
  string,
  { codice: string; voce: string; agente: string; quantitaDefault: number }
> = {
  logo: {
    codice: 'LOGO_BASIC',
    voce: 'Logo design + 2 revisioni',
    agente: 'art-design-agent',
    quantitaDefault: 1,
  },
  image_pack: {
    codice: 'IMAGE_PACK_3',
    voce: 'Pacchetto 3 immagini AI brandizzate',
    agente: 'art-design-agent',
    quantitaDefault: 1,
  },
  video_reel: {
    codice: 'VIDEO_REEL_15',
    voce: 'Reel social 15 secondi',
    agente: 'video-audio-agent',
    quantitaDefault: 1,
  },
  social_plan: {
    codice: 'SOCIAL_PLAN_MONTH',
    voce: 'Piano editoriale social mensile (16 post)',
    agente: 'publishing-performance-agent',
    quantitaDefault: 1,
  },
  newsletter: {
    codice: 'NEWSLETTER',
    voce: 'Newsletter HTML brandizzata',
    agente: 'copy-agent',
    quantitaDefault: 1,
  },
  landing_page: {
    codice: 'LANDING_PAGE',
    voce: 'Landing page (single section)',
    agente: 'creative-lead',
    quantitaDefault: 1,
  },
  press_release: {
    codice: 'PRESS_RELEASE',
    voce: 'Comunicato stampa',
    agente: 'copy-agent',
    quantitaDefault: 1,
  },
  altro: {
    codice: 'CUSTOM',
    voce: 'Lavorazione custom da concordare',
    agente: 'creative-lead',
    quantitaDefault: 1,
  },
};

const COMPLEXITY_MULTIPLIER: Record<string, number> = {
  simple: 1.0,
  moderate: 1.15,
  complex: 1.35,
  very_complex: 1.6,
};

interface ParsedCatalogEntry {
  codice: string;
  prezzoBaseMinEur: number;
  prezzoBaseMaxEur: number;
}

export function buildMockFinanceAdminResponse(userMessage: string): string {
  // Parse deliverable
  const deliverablesMatch = userMessage.match(/Deliverable richiesti:\s*(.+)/);
  const captured = deliverablesMatch?.[1];
  const deliverables = captured
    ? captured
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['altro'];

  // Parse complessità
  const complexityMatch = userMessage.match(/Complessità:\s*(\w+)/);
  const complexity = complexityMatch?.[1] ?? 'moderate';
  const multiplier = COMPLEXITY_MULTIPLIER[complexity] ?? 1.15;

  // Parse budget cliente
  const budgetMatch = userMessage.match(/Budget indicativo cliente:\s*€\s*(\d+(?:[.,]\d+)?)/);
  const budgetCliente = budgetMatch ? parseFloat(budgetMatch[1]!.replace(',', '.')) : null;

  // Parse listino: righe come "  - CODICE — descrizione — € min / € max"
  const catalogLines =
    userMessage.match(
      /^\s*-\s*([A-Z_]+)\s*—.*?€\s*(\d+(?:[.,]\d+)?)\s*\/\s*€\s*(\d+(?:[.,]\d+)?)/gm,
    ) ?? [];
  const catalog: ParsedCatalogEntry[] = catalogLines
    .map((line) => {
      const m = line.match(
        /^\s*-\s*([A-Z_]+)\s*—.*?€\s*(\d+(?:[.,]\d+)?)\s*\/\s*€\s*(\d+(?:[.,]\d+)?)/,
      );
      if (!m) return null;
      return {
        codice: m[1]!,
        prezzoBaseMinEur: parseFloat(m[2]!.replace(',', '.')),
        prezzoBaseMaxEur: parseFloat(m[3]!.replace(',', '.')),
      };
    })
    .filter((x): x is ParsedCatalogEntry => x !== null);

  // Costruisci breakdown
  const items: QuoteItem[] = [];

  for (const d of deliverables) {
    const meta = DELIVERABLE_PRICING[d] ?? DELIVERABLE_PRICING.altro!;
    const cat = catalog.find((c) => c.codice === meta.codice);
    const baseMin = cat?.prezzoBaseMinEur ?? 200;
    const baseMax = cat?.prezzoBaseMaxEur ?? 350;
    const baseAvg = (baseMin + baseMax) / 2;
    const prezzoUnitario = roundEur(baseAvg * multiplier);

    items.push({
      voce: meta.voce,
      agente: meta.agente,
      quantita: meta.quantitaDefault,
      prezzo_unitario_eur: prezzoUnitario,
      prezzo_totale_eur: roundEur(prezzoUnitario * meta.quantitaDefault),
      opzionale: false,
    });
  }

  // PM su complex/very_complex
  if (complexity === 'complex' || complexity === 'very_complex') {
    const baseTotale = items.reduce((sum, i) => sum + i.prezzo_totale_eur, 0);
    items.push({
      voce: 'Project management & coordinamento agenti',
      agente: 'direttore-operativo',
      quantita: 1,
      prezzo_unitario_eur: roundEur(baseTotale * 0.1),
      prezzo_totale_eur: roundEur(baseTotale * 0.1),
      opzionale: false,
    });
  }

  // Range con gap 12% (sotto il vincolo 15%)
  const totaleObbligatorio = items
    .filter((i) => !i.opzionale)
    .reduce((sum, i) => sum + i.prezzo_totale_eur, 0);
  const prezzoMin = roundEur(totaleObbligatorio * 0.94);
  const prezzoMax = roundEur(totaleObbligatorio * 1.06);
  const gapPct = roundDecimal(((prezzoMax - prezzoMin) / prezzoMin) * 100, 2);

  // Valid until: oggi + 30 giorni
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  const validUntilStr = validUntil.toISOString().slice(0, 10);

  // Note: budget cliente troppo basso?
  let note: string | undefined;
  if (budgetCliente && budgetCliente < prezzoMin * 0.7) {
    note = `Il budget indicativo del cliente (€${budgetCliente}) è sensibilmente inferiore al prezzo minimo realistico (€${prezzoMin}). Suggerito un confronto preliminare con il cliente.`;
  }

  const out: FinanceAdminOutput = {
    prezzo_min_eur: prezzoMin,
    prezzo_max_eur: prezzoMax,
    gap_pct: gapPct,
    breakdown: items,
    conditions: [
      'Il preventivo include 3 round di revisione gratuiti. Round successivi a pagamento.',
      'I file finali sono scaricabili solo a pagamento avvenuto.',
      'Tempi di consegna stimati. Eventuali ritardi causati da feedback del cliente non rientrano nei tempi.',
    ],
    valid_until: validUntilStr,
    note,
  };

  return JSON.stringify(out);
}

function roundEur(n: number): number {
  return Math.round(n);
}

function roundDecimal(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
