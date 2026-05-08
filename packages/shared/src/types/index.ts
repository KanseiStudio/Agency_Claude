// Tipi condivisi tra Next.js apps e logica agenti.
// Questo file è volutamente minimale in V0: lo riempiremo nelle fasi successive
// (schema completo: clienti, progetti, deliverable, preventivi, ecc.).

/**
 * Locale supportate dalla piattaforma.
 * V1: italiano + inglese.
 */
export type Locale = 'it' | 'en';

/**
 * Stati ad alto livello di un progetto.
 * Speculare a `projects.stato` nello schema MySQL/Prisma.
 */
export type ProjectStatus =
  | 'bozza'
  | 'in_attesa_approvazione_admin'
  | 'in_analisi'
  | 'preventivo_inviato'
  | 'preventivo_accettato'
  | 'in_produzione'
  | 'in_revisione'
  | 'sospeso_costi'
  | 'chiuso'
  | 'annullato';

/**
 * Tipologia progetto: lavoro one-shot o ciclo di una subscription ricorrente.
 */
export type ProjectType = 'one_shot' | 'recurring_cycle';

/**
 * Provider LLM/multimodali supportati. Aggiunto progressivamente.
 */
export type AgentProvider = 'anthropic' | 'openai' | 'google' | 'fal';
