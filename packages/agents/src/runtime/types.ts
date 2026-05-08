// Tipi del runtime degli agenti.
//
// LLMResponse: forma normalizzata della risposta dei provider LLM
// (Anthropic, OpenAI, Mock). Il runner unifica le metriche per tracking.

import type { ZodTypeAny, z } from 'zod';

export type AgentProviderName = 'anthropic' | 'openai' | 'google' | 'fal' | 'mock';

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export interface LLMResponse {
  /** Testo (o JSON serializzato) prodotto dal modello. */
  content: string;
  /** Metrica di uso, normalizzata cross-provider. */
  usage: LLMUsage;
  /** Identificativo del modello reale chiamato (es. "claude-sonnet-4-5-20250929"). */
  modelUsed: string;
}

export interface AgentDefinition<
  TInput extends ZodTypeAny = ZodTypeAny,
  TOutput extends ZodTypeAny = ZodTypeAny,
> {
  /** Identificativo univoco dell'agente (kebab-case). */
  name: string;
  /** Versione del prompt. Bump quando il prompt cambia. */
  promptVersion: string;
  /** Schema Zod dell'input. */
  inputSchema: TInput;
  /** Schema Zod dell'output. */
  outputSchema: TOutput;
  /** Provider preferito. */
  provider: AgentProviderName;
  /** Modello "logico" (es. "claude-sonnet-4-6"). Mappato dai wrapper. */
  model: string;
  /** Tabella DB primaria di persistenza. */
  dbTable: string;
  /** Funzione che costruisce il messaggio user a partire dall'input. */
  buildUserMessage: (input: z.infer<TInput>) => string;
  /** System prompt (può dipendere da locale o altri parametri). */
  buildSystemPrompt: (input: z.infer<TInput>) => string;
}

export type AgentInput<A extends AgentDefinition> = z.infer<A['inputSchema']>;
export type AgentOutput<A extends AgentDefinition> = z.infer<A['outputSchema']>;

/**
 * Contesto di esecuzione passato a `runAgent`.
 * In V1 ogni agente gira nel contesto di un progetto, quindi `projectId`
 * è obbligatorio (la tabella `agent_outputs` lo richiede non-null).
 */
export interface AgentRunContext {
  projectId: string;
}

export interface AgentRunResult<A extends AgentDefinition> {
  runId: string;
  output: AgentOutput<A>;
  usage: LLMUsage;
  costUsd: number;
  costEur: number;
  modelUsed: string;
  latencyMs: number;
}
