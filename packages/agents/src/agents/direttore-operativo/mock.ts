// Risposta canned del Direttore Operativo per la modalità MOCK_LLM.
// Restituisce un piano plausibile derivando agenti dai deliverable richiesti.

import type { DirettoreOutput } from './schema';

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
  // Heuristic: estrai i deliverable da "Deliverable richiesti: a, b, c" nel messaggio.
  const match = userMessage.match(/Deliverable richiesti:\s*(.+)/);
  const captured = match?.[1];
  const deliverables = captured
    ? captured
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['altro'];

  const agentSet = new Set<string>();
  agentSet.add('finance-admin');
  for (const d of deliverables) {
    const agents = DELIVERABLE_TO_AGENTS[d] ?? [];
    agents.forEach((a) => agentSet.add(a));
  }
  const requiredAgents = Array.from(agentSet);

  const executionPlan = requiredAgents.map((agent, i) => ({
    step: i + 1,
    agent,
    description: getAgentDescription(agent),
    estimated_duration_hours: estimateHours(agent, deliverables.length),
  }));

  // Stima complessità rozzamente in base al numero di deliverable.
  let complexity: DirettoreOutput['estimated_complexity'] = 'simple';
  if (deliverables.length >= 4) complexity = 'very_complex';
  else if (deliverables.length === 3) complexity = 'complex';
  else if (deliverables.length === 2) complexity = 'moderate';

  const out: DirettoreOutput = {
    summary: `Progetto ${deliverables.length === 1 ? 'mono-deliverable' : 'multi-deliverable'} (${deliverables.join(', ')}). Coinvolti ${requiredAgents.length} agenti specialisti coordinati dal Direttore Operativo.`,
    required_agents: requiredAgents,
    execution_plan: executionPlan,
    priority: deliverables.length >= 3 ? 'high' : 'medium',
    estimated_complexity: complexity,
    risks: [
      'Brief generato in modalità mock — verificare che la richiesta sia tecnicamente fattibile.',
      'Conferma dei riferimenti visivi prima di lanciare la produzione.',
    ],
    missing_information:
      deliverables.length > 0
        ? []
        : ['Lista deliverable più dettagliata', 'Riferimenti visivi del brand'],
    requires_human_approval: complexity === 'very_complex',
  };

  return JSON.stringify(out);
}

function getAgentDescription(agent: string): string {
  const map: Record<string, string> = {
    'account-manager': 'Interpreta la richiesta cliente e valida la completezza del brief.',
    'finance-admin': 'Calcola il preventivo applicando il listino servizi.',
    'brand-marketing-strategist': 'Definisce posizionamento, tono di voce e KPI di campagna.',
    'research-agent': 'Analizza competitor e trend di settore.',
    'creative-lead':
      'Sintetizza il concept creativo e produce brief operativi per copy, design e video.',
    'copy-agent': 'Scrive testi: claim, social, landing, script.',
    'art-design-agent': 'Direzione artistica e produzione asset grafici.',
    'video-audio-agent': 'Storyboard, generazione video, voiceover.',
    'publishing-performance-agent': 'Calendario editoriale, ad set e tracking performance.',
  };
  return map[agent] ?? 'Esegue il proprio task secondo le linee guida del Creative Lead.';
}

function estimateHours(agent: string, deliverableCount: number): number {
  const base: Record<string, number> = {
    'account-manager': 0.5,
    'finance-admin': 0.5,
    'brand-marketing-strategist': 2,
    'research-agent': 1.5,
    'creative-lead': 2,
    'copy-agent': 3,
    'art-design-agent': 4,
    'video-audio-agent': 6,
    'publishing-performance-agent': 1.5,
  };
  return Math.round((base[agent] ?? 1) * Math.max(1, deliverableCount * 0.5) * 10) / 10;
}
