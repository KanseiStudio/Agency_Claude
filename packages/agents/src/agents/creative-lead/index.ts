// Agent definition Creative Lead.

import type { AgentDefinition } from '../../runtime/types';
import { creativeLeadInputSchema, creativeLeadOutputSchema } from './schema';
import { buildSystemPrompt, buildUserMessage } from './prompt';

export const creativeLeadAgent: AgentDefinition<
  typeof creativeLeadInputSchema,
  typeof creativeLeadOutputSchema
> = {
  name: 'creative-lead',
  promptVersion: '0.1.0',
  inputSchema: creativeLeadInputSchema,
  outputSchema: creativeLeadOutputSchema,
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  dbTable: 'project_creative_outputs',
  buildSystemPrompt,
  buildUserMessage,
};

export type { CreativeLeadInput, CreativeLeadOutput } from './schema';
export { creativeLeadInputSchema, creativeLeadOutputSchema };
