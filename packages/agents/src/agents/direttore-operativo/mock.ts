// Mock del Direttore Operativo "senior consultant".
// Produce output analitico ricco: client_analysis + visual_mood_analysis +
// assumptions + missing_info concrete + plan dettagliato.
//
// Heuristica: parsiamo nome cliente, deliverable, mood keywords dal
// userMessage e generiamo un output credibile derivando inferences plausibili.

import type {
  DirettoreOutput,
  ClientAnalysis,
  VisualMoodAnalysis,
} from './schema';

const DELIVERABLE_TO_AGENTS: Record<string, string[]> = {
  logo: ['brand-marketing-strategist', 'creative-lead', 'art-design-agent'],
  image_pack: ['creative-lead', 'art-design-agent'],
  video_reel: ['creative-lead', 'video-audio-agent'],
  social_plan: [
    'brand-marketing-strategist',
    'creative-lead',
    'copy-agent',
    'publishing-performance-agent',
  ],
  newsletter: ['copy-agent', 'art-design-agent'],
  landing_page: ['brand-marketing-strategist', 'creative-lead', 'copy-agent', 'art-design-agent'],
  press_release: ['copy-agent'],
  altro: ['account-manager', 'creative-lead'],
};

export function buildMockDirettoreResponse(userMessage: string): string {
  // ---- Parsing input ----
  const deliverables = parseList(userMessage, /Deliverable richiesti:\s*(.+)/);
  const clientName = match(userMessage, /Cliente:\s*(.+)/) ?? 'Cliente';
  const clientEmail = match(userMessage, /Email cliente:\s*(\S+)/);
  const piva = match(userMessage, /P\.IVA:\s*(\S+)/);
  const titolo = match(userMessage, /Titolo:\s*(.+)/) ?? '';
  const descrizione = match(
    userMessage,
    /Descrizione brief:\s*\n([\s\S]+?)(?:\n\nDeliverable richiesti|\n\nDeadline|$)/,
  ) ?? '';
  const deadline = match(userMessage, /Deadline:\s*(.+)/);
  const budget = match(userMessage, /Budget indicativo:\s*€\s*(\d+(?:[\.,]\d+)?)/);

  // ---- Analisi cliente (deduzione) ----
  const clientAnalysis = inferClientAnalysis(
    clientName,
    clientEmail,
    piva,
    descrizione,
    deliverables,
    titolo,
  );

  // ---- Analisi mood visivo (deduzione) ----
  const moodAnalysis = inferVisualMood(deliverables, clientAnalysis, descrizione);

  // ---- Agenti coinvolti ----
  const agentSet = new Set<string>();
  agentSet.add('finance-admin');
  for (const d of deliverables) {
    (DELIVERABLE_TO_AGENTS[d] ?? []).forEach((a) => agentSet.add(a));
  }
  const requiredAgents = Array.from(agentSet);

  // ---- Piano esecutivo specifico ----
  const executionPlan = requiredAgents.map((agent, i) => ({
    step: i + 1,
    agent,
    description: buildSpecificDescription(agent, deliverables, clientAnalysis),
    estimated_duration_hours: estimateHours(agent, deliverables.length),
  }));

  // ---- Complessità ----
  let complexity: DirettoreOutput['estimated_complexity'] = 'simple';
  if (deliverables.length >= 4) complexity = 'very_complex';
  else if (deliverables.length === 3) complexity = 'complex';
  else if (deliverables.length === 2) complexity = 'moderate';

  // ---- Assunzioni esplicite ----
  const assumptions: string[] = [
    `Settore "${clientAnalysis.sector_inferred}" dedotto da: ${clientAnalysis.inference_signals.slice(0, 2).join(', ')}.`,
    `Target audience "${clientAnalysis.target_audience_hypothesis}" ipotizzato dal posizionamento "${clientAnalysis.competitive_positioning}".`,
  ];
  if (!moodAnalysis.has_references) {
    assumptions.push(
      `Mood visivo inferito perché il brief non contiene file di reference: ${moodAnalysis.inferred_style_keywords.slice(0, 3).join(', ')}.`,
    );
  }
  if (!budget) {
    assumptions.push(
      `Budget non dichiarato: applichiamo listino base + maggiorazione 10% per complessità ${complexity}.`,
    );
  }

  // ---- Missing info concrete ----
  const missingInfo = buildMissingInfo(
    deliverables,
    clientAnalysis,
    moodAnalysis,
    !!budget,
    !!deadline,
  );

  // ---- Rischi specifici ----
  const risks = buildSpecificRisks(deliverables, clientAnalysis, moodAnalysis, !!deadline);

  const out: DirettoreOutput = {
    summary: buildSummary(deliverables, clientAnalysis, complexity),
    client_analysis: clientAnalysis,
    visual_mood_analysis: moodAnalysis,
    required_agents: requiredAgents,
    execution_plan: executionPlan,
    priority: deliverables.length >= 3 ? 'high' : 'medium',
    estimated_complexity: complexity,
    risks,
    missing_information: missingInfo,
    assumptions_made: assumptions,
    requires_human_approval: complexity === 'very_complex' || missingInfo.length >= 5,
  };

  return JSON.stringify(out);
}

// ---------- INFERENZE ----------

function inferClientAnalysis(
  clientName: string,
  clientEmail: string | null,
  piva: string | null,
  descrizione: string,
  deliverables: string[],
  titolo: string,
): ClientAnalysis {
  const lowerName = clientName.toLowerCase();
  const lowerDesc = descrizione.toLowerCase();
  const lowerTitolo = titolo.toLowerCase();
  const lowerEmail = (clientEmail ?? '').toLowerCase();

  // Settore (deduzione euristica)
  let sector = 'servizi alle imprese generico';
  let signals: string[] = [];
  const sectorRules: Array<{ keys: string[]; sector: string; signal: string }> = [
    { keys: ['trattoria', 'ristoran', 'pizzeria', 'osteria', 'bar', 'menu'], sector: 'ristorazione tradizionale italiana', signal: 'parole chiave ristorazione nel nome/brief' },
    { keys: ['studio', 'architett', 'design.it'], sector: 'studi professionali design/architettura', signal: 'tipologia studio professionale' },
    { keys: ['app', 'saas', 'software', 'tech', 'cloud', 'platform'], sector: 'SaaS / tech B2B', signal: 'lessico tecnologico' },
    { keys: ['boutique', 'fashion', 'abbigliamento', 'moda', 'atelier'], sector: 'fashion / lifestyle premium', signal: 'lessico fashion/moda' },
    { keys: ['ecommerce', 'shop', 'store online', 'd2c'], sector: 'ecommerce / D2C', signal: 'lessico vendita online' },
    { keys: ['hotel', 'b&b', 'resort', 'agriturismo', 'turism'], sector: 'hospitality / turismo', signal: 'lessico hospitality' },
    { keys: ['onlus', 'no profit', 'fondazion', 'associazione'], sector: 'non-profit / fondazioni', signal: 'natura giuridica no-profit' },
    { keys: ['legal', 'avvocato', 'studio legale', 'commercialist'], sector: 'studi legali / consulenza', signal: 'lessico studi professionali' },
    { keys: ['edili', 'costruzion', 'immobiliar', 'real estate'], sector: 'costruzioni / immobiliare', signal: 'lessico edile/immobiliare' },
    { keys: ['salute', 'medic', 'clinica', 'dentista', 'farmacia'], sector: 'sanità / wellness', signal: 'lessico sanitario' },
  ];

  for (const rule of sectorRules) {
    const haystack = lowerName + ' ' + lowerDesc + ' ' + lowerTitolo + ' ' + lowerEmail;
    if (rule.keys.some((k) => haystack.includes(k))) {
      sector = rule.sector;
      signals.push(rule.signal);
      break;
    }
  }
  if (piva) signals.push(`P.IVA italiana ${piva.slice(0, 5)}...`);
  if (clientEmail) signals.push(`dominio email ${clientEmail.split('@')[1] ?? 'cliente'}`);
  if (signals.length === 0) signals.push('nessun segnale chiaro nel brief');

  // Business model
  let businessModel = 'B2C retail';
  if (sector.includes('SaaS') || sector.includes('legal')) businessModel = 'B2B servizi';
  if (sector.includes('hospitality')) businessModel = 'B2C hospitality / esperienziale';
  if (sector.includes('non-profit')) businessModel = 'non-profit / donor-funded';
  if (sector.includes('ecommerce')) businessModel = 'D2C ecommerce';

  // Target audience
  let target = 'pubblico generalista italiano 25-55 anni';
  if (sector.includes('ristorazione')) target = 'clienti fascia 25-65 anni, italiani + turisti, contesto di consumo conviviale';
  if (sector.includes('SaaS')) target = 'decision-maker B2B aziende 10-500 dipendenti, profili IT/HR/operations';
  if (sector.includes('fashion')) target = 'clientela 30-50 anni con potere di spesa medio-alto, urbana';
  if (sector.includes('hospitality')) target = 'viaggiatori 28-55 anni alla ricerca di esperienza autentica';
  if (sector.includes('legal')) target = 'aziende PMI italiane + persone giuridiche';
  if (sector.includes('sanità')) target = 'pazienti adulti zona di riferimento';

  // Posizionamento
  let positioning = 'mass market accessibile';
  if (lowerDesc.includes('premium') || lowerDesc.includes('lusso')) positioning = 'premium / luxury';
  if (sector.includes('fashion') || sector.includes('hospitality')) positioning = 'premium con identità artigianale';
  if (sector.includes('SaaS')) positioning = 'professionale ma accessibile (no enterprise-only)';
  if (sector.includes('non-profit')) positioning = 'umanistico, trasparente, autorevole';
  if (sector.includes('ristorazione')) positioning = 'tradizione artigianale italiana, qualità prima del prezzo';

  // Confidence
  const confidence: 'high' | 'medium' | 'low' =
    signals.length >= 3 && signals[0] !== 'nessun segnale chiaro nel brief'
      ? 'medium'
      : signals.length >= 2
        ? 'low'
        : 'low';

  return {
    sector_inferred: sector,
    business_model: businessModel,
    target_audience_hypothesis: target,
    competitive_positioning: positioning,
    information_confidence: confidence,
    inference_signals: signals.slice(0, 4),
  };
}

function inferVisualMood(
  deliverables: string[],
  client: ClientAnalysis,
  descrizione: string,
): VisualMoodAnalysis {
  const lowerDesc = descrizione.toLowerCase();
  const hasReferences = lowerDesc.includes('riferimenti') || lowerDesc.includes('reference') || lowerDesc.includes('allegato');

  // Keywords per settore
  let styleKeywords: string[];
  let colorDirections: string[];
  let typography: string;

  if (client.sector_inferred.includes('ristorazione')) {
    styleKeywords = ['warm tones', 'hand-crafted', 'editorial italian', 'rustic chic', 'natural light', 'artisanal'];
    colorDirections = ['tonalità terrose calde (terracotta, ocra, crema)', 'duotone editoriale verde oliva + bordeaux'];
    typography = 'serif editoriale italiano con dettagli artigianali (es. Recoleta, GT Sectra), pair con sans humanist per il body';
  } else if (client.sector_inferred.includes('SaaS') || client.sector_inferred.includes('tech')) {
    styleKeywords = ['minimal', 'geometric', 'tech-clean', 'monochrome accents', 'subtle gradient', 'modern'];
    colorDirections = ['monochrome scuro con accent vivido (blu elettrico o verde lime)', 'duotone bianco/grigio + colore brand'];
    typography = 'sans-serif geometrico moderno (Inter, GT America, Söhne) con gerarchie ampie';
  } else if (client.sector_inferred.includes('fashion')) {
    styleKeywords = ['editorial', 'minimal luxury', 'serif elegant', 'monochrome with hero color', 'high contrast', 'sophisticated'];
    colorDirections = ['palette bianco/nero con un solo accent colorato di forte identità', 'tonalità nude (crema, sand, taupe)'];
    typography = 'serif display ad alto contrasto (es. Didot, Saol Display) per heading, sans neutrale per body';
  } else if (client.sector_inferred.includes('hospitality')) {
    styleKeywords = ['warm welcoming', 'natural materials', 'editorial travel', 'authentic Italy', 'soft light', 'painterly'];
    colorDirections = ['tonalità calde mediterranee (terracotta, oliva, blu mare)', 'palette neutri caldi con accent oro brunito'];
    typography = 'mix serif autoriale + sans humanist per equilibrio formale/accogliente';
  } else if (client.sector_inferred.includes('non-profit')) {
    styleKeywords = ['humanistic', 'editorial documentary', 'authentic', 'high contrast b/w + 1 color', 'serious'];
    colorDirections = ['monochrome + accent di mission (es. azzurro per acqua, verde per ambiente)'];
    typography = 'sans humanist (Inter, Söhne) con grande leggibilità + serif autorevole per quote';
  } else if (client.sector_inferred.includes('legal')) {
    styleKeywords = ['classico professionale', 'sobrio', 'serif tradizionale', 'duotone scuro', 'high credibility'];
    colorDirections = ['palette navy + crema con accent metallico (oro/bronzo)', 'monocromia neutra'];
    typography = 'serif transizionale (es. Caslon, Garamond) per heading, sans neutrale per body';
  } else {
    styleKeywords = ['editorial', 'clean', 'italian aesthetic', 'warm neutrals', 'photographic'];
    colorDirections = ['palette neutra calda con un accent saturo per CTA', 'duotone editoriale'];
    typography = 'mix serif editoriale + sans humanist per equilibrio contemporaneo';
  }

  const rationale = hasReferences
    ? `Il brief menziona riferimenti visivi forniti dal cliente; il Creative Lead userà quelli come base.`
    : `Senza file di reference, il mood è stato dedotto da settore (${client.sector_inferred}) e posizionamento (${client.competitive_positioning}). Le direzioni proposte sono ipotesi di partenza che vanno validate col cliente prima della produzione.`;

  return {
    has_references: hasReferences,
    inferred_style_keywords: styleKeywords,
    suggested_color_directions: colorDirections,
    inferred_typography_style: typography,
    rationale,
  };
}

function buildSummary(
  deliverables: string[],
  client: ClientAnalysis,
  complexity: DirettoreOutput['estimated_complexity'],
): string {
  return `Progetto ${deliverables.length === 1 ? 'mono-deliverable' : 'multi-deliverable'} (${deliverables.join(', ')}) per cliente del settore "${client.sector_inferred}" con posizionamento ${client.competitive_positioning}. Complessità stimata: ${complexity}. Confidenza analisi: ${client.information_confidence}.`;
}

function buildSpecificDescription(
  agent: string,
  deliverables: string[],
  client: ClientAnalysis,
): string {
  const sectorTag = client.sector_inferred.split(' ')[0] ?? 'generale';
  const dList = deliverables.join(', ');
  const map: Record<string, string> = {
    'account-manager': `Kick-off cliente per validare il brief e raccogliere eventuali chiarimenti rimasti aperti sull'analisi del settore "${sectorTag}".`,
    'finance-admin': `Compone preventivo basato su: ${dList}. Listino base + maggiorazione settore ${sectorTag} + adjustement per posizionamento ${client.competitive_positioning}.`,
    'brand-marketing-strategist': `Definisce posizionamento dettagliato, tono di voce e KPI di campagna per il settore "${sectorTag}", basandosi sulla target audience "${client.target_audience_hypothesis}".`,
    'research-agent': `Analisi competitiva del settore "${client.sector_inferred}", studio trend visual identity di riferimento, benchmark di posizionamento diretto e indiretto.`,
    'creative-lead': `Sviluppo concept creativi (3-4 direzioni divergenti), moodboard coerenti col posizionamento "${client.competitive_positioning}", brief dettagliato per art-design-agent e copy-agent.`,
    'copy-agent': `Produzione testi (claim + varianti A/B/C) tarati su tono di voce stabilito dal brand-marketing-strategist per il target "${client.target_audience_hypothesis}".`,
    'art-design-agent': `Direzione artistica + asset visivi per ${dList}, applicazione palette + tipografia derivata dall'analisi mood. Mockup applicativi per validazione finale.`,
    'video-audio-agent': `Storyboard video + generazione frame keyframe + composizione finale + sottotitoli/voiceover se richiesti.`,
    'publishing-performance-agent': `Calendario editoriale, ad set, configurazione tracking conversioni, primo set di varianti per A/B testing.`,
  };
  return map[agent] ?? `Esecuzione task ${agent} secondo brief operativi del Creative Lead.`;
}

function buildMissingInfo(
  deliverables: string[],
  client: ClientAnalysis,
  mood: VisualMoodAnalysis,
  hasBudget: boolean,
  hasDeadline: boolean,
): string[] {
  const qs: string[] = [];

  // ============================================================
  // DOMANDE OBBLIGATORIE PER DELIVERABLE — sempre in cima
  // ============================================================
  if (deliverables.includes('logo')) {
    // ⚠️ CRITICA: il nome sul logo può essere DIVERSO dalla ragione sociale
    qs.push(
      `Qual è il NOME ESATTO che deve apparire sul logo? Includi maiuscole/minuscole/punteggiatura come vorresti scritto (es. "BUONGUSTO", "Buongusto", "Trattoria da Mario", "BG"). Nota: il nome del logo può essere diverso dalla ragione sociale aziendale.`,
    );
    qs.push(
      `Vuoi un payoff/tagline sotto il logo (es. "cucina di famiglia dal 1965", "design that thinks")? Se sì, qual è?`,
    );
    qs.push(
      `Preferenza tra wordmark (solo testo), pittogramma (solo simbolo) o lockup (testo + simbolo combinati)? Se non hai una preferenza tecnica, descrivi a parole cosa immagini.`,
    );
  }
  if (deliverables.includes('social_plan') || deliverables.includes('image_pack')) {
    qs.push(
      `Quali sono gli @ handle / nomi account social ufficiali (Instagram, Facebook, LinkedIn, TikTok)? E ci sono hashtag aziendali da usare sempre?`,
    );
  }
  if (deliverables.includes('video_reel') || deliverables.some((d) => /video/i.test(d))) {
    qs.push(
      `Il video avrà voice-over, sottotitoli o solo musica? Su quale canale principale andrà (TikTok, IG Reel, YouTube)? Questo determina durata e formato.`,
    );
  }
  if (deliverables.includes('newsletter')) {
    qs.push(
      `Quale piattaforma email usate (Mailchimp, Brevo, Klaviyo, altro)? E qual è il nome mittente che apparirà nelle inbox dei destinatari?`,
    );
  }
  if (deliverables.includes('landing_page')) {
    qs.push(
      `Su quale URL/dominio andrà pubblicata la landing? Qual è l'obiettivo di conversione principale (lead gen, vendita, prenotazione)? Serve integrazione tracking (GA4, Meta Pixel)?`,
    );
  }

  // ============================================================
  // DOMANDE STANDARD (uso, canali, ecc.) — già non duplicate sopra
  // ============================================================
  if (deliverables.includes('logo')) {
    qs.push(
      `Il logo verrà usato principalmente in digitale (social, web, presentazioni) o anche in stampa (insegne, packaging, materiale fisico)? Questo influisce sulle versioni richieste (responsive, mono, mini-icona).`,
    );
  }
  if (!mood.has_references) {
    qs.push(
      `Avete riferimenti visivi (brand che ammirate, palette particolari, font preferiti) che vorreste come ispirazione? Anche 2-3 link sono utilissimi.`,
    );
  }
  // Brand identity verbal
  qs.push(
    `Esiste già un claim/payoff aziendale, valori o key messages che il deliverable deve rispecchiare? Se sì, condividi il documento o un sommario.`,
  );
  // Vincoli colore/font
  qs.push(
    `Ci sono colori, font o elementi grafici aziendali esistenti che dobbiamo rispettare (es. logo già esistente, palette di brand)?`,
  );
  // Must avoid
  qs.push(
    `Ci sono elementi che NON vorreste assolutamente vedere (es. specifici colori, stili, riferimenti culturali)?`,
  );
  // Budget se mancante
  if (!hasBudget) {
    qs.push(
      `Avete una fascia di budget di riferimento? Anche un range aiuta a calibrare l'offerta (es. €500-1000, €1000-3000, ecc.).`,
    );
  }
  // Deadline se mancante
  if (!hasDeadline) {
    qs.push(
      `C'è una deadline specifica entro cui dovete avere i deliverable finali pronti?`,
    );
  }

  return qs.slice(0, 8); // cap a 8 per non sovraccaricare il cliente
}

function buildSpecificRisks(
  deliverables: string[],
  client: ClientAnalysis,
  mood: VisualMoodAnalysis,
  hasDeadline: boolean,
): string[] {
  const risks: string[] = [];
  if (!mood.has_references) {
    risks.push(
      `Assenza di riferimenti visivi forniti dal cliente: il mood proposto (${mood.inferred_style_keywords.slice(0, 2).join(', ')}) è ipotesi che potrebbe richiedere 1-2 round di revisione extra se non incontra il gusto del committente.`,
    );
  }
  if (client.information_confidence === 'low') {
    risks.push(
      `Confidenza bassa sull'analisi cliente (settore "${client.sector_inferred}" dedotto da pochi segnali): le scelte di posizionamento andrebbero validate prima di lanciare la produzione completa.`,
    );
  }
  if (deliverables.length >= 4) {
    risks.push(
      `Volume di deliverable elevato (${deliverables.length}): considerare splittaggio in due milestone per gestione cliente più graduale e revisione intermedia.`,
    );
  }
  if (!hasDeadline) {
    risks.push(
      `Mancanza di deadline esplicita: potrebbe causare slittamenti se il cliente non sente urgenza nelle revisioni intermedie.`,
    );
  }
  return risks;
}

// ---------- HELPERS ----------

function match(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1]?.trim() ?? null;
}

function parseList(text: string, re: RegExp): string[] {
  const v = match(text, re);
  if (!v) return ['altro'];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

function estimateHours(agent: string, deliverableCount: number): number {
  const base: Record<string, number> = {
    'account-manager': 0.5,
    'finance-admin': 0.5,
    'brand-marketing-strategist': 3,
    'research-agent': 2,
    'creative-lead': 3,
    'copy-agent': 4,
    'art-design-agent': 6,
    'video-audio-agent': 8,
    'publishing-performance-agent': 2,
  };
  return Math.round((base[agent] ?? 1) * Math.max(1, deliverableCount * 0.6) * 10) / 10;
}
