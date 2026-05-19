// Agent definition del Direttore Operativo.

import type { AgentDefinition } from '../../runtime/types';
import {
  direttoreInputSchema,
  direttoreOutputSchema,
  clientAnalysisSchema,
  visualMoodAnalysisSchema,
} from './schema';
import { buildSystemPrompt, buildUserMessage } from './prompt';

export const direttoreOperativoAgent: AgentDefinition<
  typeof direttoreInputSchema,
  typeof direttoreOutputSchema
> = {
  name: 'direttore-operativo',
  promptVersion: '0.2.0',
  inputSchema: direttoreInputSchema,
  outputSchema: direttoreOutputSchema,
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  dbTable: 'agent_outputs',
  buildSystemPrompt,
  buildUserMessage,
};

export type {
  DirettoreInput,
  DirettoreOutput,
  ClientAnalysis,
  VisualMoodAnalysis,
} from './schema';
export {
  direttoreInputSchema,
  direttoreOutputSchema,
  clientAnalysisSchema,
  visualMoodAnalysisSchema,
};
