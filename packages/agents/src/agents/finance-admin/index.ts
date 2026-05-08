// Agent definition Finance/Admin.

import type { AgentDefinition } from '../../runtime/types';
import { financeAdminInputSchema, financeAdminOutputSchema } from './schema';
import { buildSystemPrompt, buildUserMessage } from './prompt';

export const financeAdminAgent: AgentDefinition<
  typeof financeAdminInputSchema,
  typeof financeAdminOutputSchema
> = {
  name: 'finance-admin',
  promptVersion: '0.1.0',
  inputSchema: financeAdminInputSchema,
  outputSchema: financeAdminOutputSchema,
  // OpenAI con Structured Outputs è ideale qui, ma per V1 condividiamo
  // il pattern del Direttore (Anthropic + JSON parsing). Switch a OpenAI
  // possibile cambiando solo `provider` e `model` qui.
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  dbTable: 'project_finance_outputs',
  buildSystemPrompt,
  buildUserMessage,
};

export type { FinanceAdminInput, FinanceAdminOutput, QuoteItem } from './schema';
export { financeAdminInputSchema, financeAdminOutputSchema };
