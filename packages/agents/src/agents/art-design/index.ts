// Agent definition Art & Design.

import type { AgentDefinition } from '../../runtime/types';
import { artDesignInputSchema, artDesignOutputSchema } from './schema';
import { buildSystemPrompt, buildUserMessage } from './prompt';

export const artDesignAgent: AgentDefinition<
  typeof artDesignInputSchema,
  typeof artDesignOutputSchema
> = {
  name: 'art-design',
  promptVersion: '0.2.0',
  inputSchema: artDesignInputSchema,
  outputSchema: artDesignOutputSchema,
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  dbTable: 'agent_outputs',
  buildSystemPrompt,
  buildUserMessage,
};

export type {
  PaletteColor,
  ArtDirection,
  ImageBrief,
  PrimaryAsset,
  ModelRecommendation,
  GeneratedKeyframe,
  GeneratedAsset,
  ArtDesignInput,
  ArtDesignOutput,
} from './schema';
export {
  artDesignInputSchema,
  artDesignOutputSchema,
  paletteColorSchema,
  artDirectionSchema,
  imageBriefSchema,
  primaryAssetSchema,
  modelRecommendationSchema,
  generatedKeyframeSchema,
  generatedAssetSchema,
} from './schema';
