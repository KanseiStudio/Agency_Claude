// Agent definition Copy Agent.

import type { AgentDefinition } from '../../runtime/types';
import { copyAgentInputSchema, copyAgentOutputSchema } from './schema';
import { buildSystemPrompt, buildUserMessage } from './prompt';

export const copyAgentAgent: AgentDefinition<
  typeof copyAgentInputSchema,
  typeof copyAgentOutputSchema
> = {
  name: 'copy-agent',
  promptVersion: '0.1.0',
  inputSchema: copyAgentInputSchema,
  outputSchema: copyAgentOutputSchema,
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  dbTable: 'agent_outputs',
  buildSystemPrompt,
  buildUserMessage,
};

export type {
  CopyAgentInput,
  CopyAgentOutput,
  CopyVariant,
  CopyDeliverable,
  CopyDeliverableType,
} from './schema';
export { copyAgentInputSchema, copyAgentOutputSchema, copyDeliverableTypeEnum } from './schema';
