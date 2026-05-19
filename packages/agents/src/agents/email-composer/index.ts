// Agent definition Email Composer.

import type { AgentDefinition } from '../../runtime/types';
import { emailComposerInputSchema, emailComposerOutputSchema } from './schema';
import { buildSystemPrompt, buildUserMessage } from './prompt';

export const emailComposerAgent: AgentDefinition<
  typeof emailComposerInputSchema,
  typeof emailComposerOutputSchema
> = {
  name: 'email-composer',
  promptVersion: '0.1.0',
  inputSchema: emailComposerInputSchema,
  outputSchema: emailComposerOutputSchema,
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  dbTable: 'agent_outputs',
  buildSystemPrompt,
  buildUserMessage,
};

export type {
  EmailKind,
  EmailContext,
  EmailComposerInput,
  EmailComposerOutput,
} from './schema';
export {
  emailKindSchema,
  emailContextSchema,
  emailComposerInputSchema,
  emailComposerOutputSchema,
} from './schema';
