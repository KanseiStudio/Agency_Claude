// Agent definition Project Manager AI.

import type { AgentDefinition } from '../../runtime/types';
import { projectManagerInputSchema, projectManagerOutputSchema } from './schema';
import { buildSystemPrompt, buildUserMessage } from './prompt';

export const projectManagerAgent: AgentDefinition<
  typeof projectManagerInputSchema,
  typeof projectManagerOutputSchema
> = {
  name: 'project-manager',
  promptVersion: '0.1.0',
  inputSchema: projectManagerInputSchema,
  outputSchema: projectManagerOutputSchema,
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  dbTable: 'agent_outputs',
  buildSystemPrompt,
  buildUserMessage,
};

export type {
  AgentRunSnapshot,
  RevisionRoundSnapshot,
  Blocker,
  NextAction,
  ProjectManagerInput,
  ProjectManagerOutput,
} from './schema';
export {
  projectManagerInputSchema,
  projectManagerOutputSchema,
  agentRunSnapshotSchema,
  revisionRoundSnapshotSchema,
  blockerSchema,
  nextActionSchema,
} from './schema';
