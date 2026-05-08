// Definizione del contratto comune a tutti gli agenti AI di Kansei-Studio.
// Ogni agente del sistema (Direttore Operativo, Account Manager, Copy, ecc.)
// implementa questa interfaccia, garantendo coerenza fra Next.js e n8n.

import type { z, ZodTypeAny } from 'zod';
import type { AgentProvider } from '../types/index';

/**
 * Definizione formale di un agente AI.
 *
 * @template TInput  Schema Zod che valida l'input dell'agente
 * @template TOutput Schema Zod che valida l'output dell'agente
 */
export interface AgentDefinition<
  TInput extends ZodTypeAny = ZodTypeAny,
  TOutput extends ZodTypeAny = ZodTypeAny,
> {
  /** Nome unico dell'agente, kebab-case. Es: "direttore-operativo" */
  name: string;

  /** Versione semantica del prompt. Bump quando cambia la prompt. */
  promptVersion: string;

  /** Schema Zod dell'input atteso dall'agente */
  inputSchema: TInput;

  /** Schema Zod dell'output prodotto dall'agente */
  outputSchema: TOutput;

  /** Variabile d'ambiente che contiene l'URL webhook n8n di questo agente */
  n8nWebhookEnvKey: string;

  /** Tabella DB primaria su cui questo agente persiste i suoi output */
  dbTable: string;

  /** Provider LLM/AI usato dall'agente */
  provider: AgentProvider;

  /** Identificativo del modello (es. "claude-sonnet-4-6", "gpt-4o") */
  model: string;

  /** Descrizione human-readable del ruolo dell'agente */
  description: string;
}

/**
 * Tipo di utilità per estrarre il tipo TS dell'input di un agente.
 */
export type AgentInput<A extends AgentDefinition> = z.infer<A['inputSchema']>;

/**
 * Tipo di utilità per estrarre il tipo TS dell'output di un agente.
 */
export type AgentOutput<A extends AgentDefinition> = z.infer<A['outputSchema']>;

/**
 * Stato di una run di un agente. Persistito in tabella `agent_runs`.
 */
export type AgentRunStatus = 'running' | 'success' | 'failed' | 'timeout';

/**
 * Payload registrato a fine run, per tracking token e costi.
 * Persistito in `token_usage` (LLM) o `external_api_usage` (image/video/audio).
 */
export interface AgentUsageReport {
  runId: string;
  projectId: string;
  agent: string;
  provider: AgentProvider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
  /** Costo calcolato in USD usando `pricing_models` corrente */
  costUsd: number;
  /** Costo in EUR (conversione tasso giornaliero) */
  costEur: number;
  /** Per chiamate non-LLM: unità (es. immagini generate, secondi video, caratteri TTS) */
  externalUnits?: number;
  externalUnitType?: string;
}
