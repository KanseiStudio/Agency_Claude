// Agent definition del Direttore Operativo.

import type { AgentDefinition } from '../../runtime/types';
import { direttoreInputSchema, direttoreOutputSchema } from './schema';
import { buildSystemPrompt, buildUserMessage } from './prompt';

export const direttoreOperativoAgent: AgentDefinition<
  typeof direttoreInputSchema,
  typeof direttoreOutputSchema
> = {
  name: 'direttore-operativo',
  promptVersion: '0.1.0',
  inputSchema: direttoreInputSchema,
  outputSchema: direttoreOutputSchema,
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  dbTable: 'agent_outputs',
  buildSystemPrompt,
  buildUserMessage,
};

export type { DirettoreInput, DirettoreOutput } from './schema';
export { direttoreInputSchema, direttoreOutputSchema };
