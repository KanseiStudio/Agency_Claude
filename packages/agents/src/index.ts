// Entry point del pacchetto @kansei/agents.

// Runtime
export { runAgent } from './runtime/runner';
export type {
  AgentDefinition,
  AgentInput,
  AgentOutput,
  AgentRunContext,
  AgentRunResult,
  AgentProviderName,
  LLMUsage,
  LLMResponse,
} from './runtime/types';
export { setMockResponseProvider } from './runtime/llm/mock';
export { generateImage } from './runtime/image-gen';
export type { ImageGenInput, ImageGenResult, ImageGenMeta } from './runtime/image-gen';
export { generateVideo } from './runtime/video-gen';
export type { VideoGenInput, VideoGenResult, VideoGenMeta } from './runtime/video-gen';
export {
  higgsfieldGenerateImage,
  higgsfieldGenerateVideo,
  higgsfieldSubmitAndDownload,
  downloadAsset,
} from './runtime/higgsfield';
export type {
  HiggsfieldImageInput,
  HiggsfieldVideoInput,
  HiggsfieldResult,
} from './runtime/higgsfield';

// Agente: Direttore Operativo
export {
  direttoreOperativoAgent,
  direttoreInputSchema,
  direttoreOutputSchema,
} from './agents/direttore-operativo';
export type { DirettoreInput, DirettoreOutput } from './agents/direttore-operativo';
export { buildMockDirettoreResponse } from './agents/direttore-operativo/mock';

// Agente: Finance/Admin
export {
  financeAdminAgent,
  financeAdminInputSchema,
  financeAdminOutputSchema,
} from './agents/finance-admin';
export type {
  FinanceAdminInput,
  FinanceAdminOutput,
  QuoteItem,
} from './agents/finance-admin';
export { buildMockFinanceAdminResponse } from './agents/finance-admin/mock';

// Agente: Creative Lead
export {
  creativeLeadAgent,
  creativeLeadInputSchema,
  creativeLeadOutputSchema,
} from './agents/creative-lead';
export type { CreativeLeadInput, CreativeLeadOutput } from './agents/creative-lead';
export { buildMockCreativeLeadResponse } from './agents/creative-lead/mock';

// Agente: Copy Agent
export {
  copyAgentAgent,
  copyAgentInputSchema,
  copyAgentOutputSchema,
  copyDeliverableTypeEnum,
} from './agents/copy-agent';
export type {
  CopyAgentInput,
  CopyAgentOutput,
  CopyVariant,
  CopyDeliverable,
  CopyDeliverableType,
} from './agents/copy-agent';
export { buildMockCopyAgentResponse } from './agents/copy-agent/mock';

// Agente: Email Composer
export {
  emailComposerAgent,
  emailComposerInputSchema,
  emailComposerOutputSchema,
  emailKindSchema,
  emailContextSchema,
} from './agents/email-composer';
export type {
  EmailKind,
  EmailContext,
  EmailComposerInput,
  EmailComposerOutput,
} from './agents/email-composer';
export { buildMockEmailComposerResponse } from './agents/email-composer/mock';

// Agente: Project Manager
export {
  projectManagerAgent,
  projectManagerInputSchema,
  projectManagerOutputSchema,
  agentRunSnapshotSchema,
  revisionRoundSnapshotSchema,
  blockerSchema,
  nextActionSchema,
} from './agents/project-manager';
export type {
  AgentRunSnapshot,
  RevisionRoundSnapshot,
  Blocker,
  NextAction,
  ProjectManagerInput,
  ProjectManagerOutput,
} from './agents/project-manager';
export { buildMockProjectManagerResponse } from './agents/project-manager/mock';

// Agente: Art & Design
export {
  artDesignAgent,
  artDesignInputSchema,
  artDesignOutputSchema,
  paletteColorSchema,
  artDirectionSchema,
  imageBriefSchema,
  primaryAssetSchema,
  modelRecommendationSchema,
  generatedKeyframeSchema,
  generatedAssetSchema,
} from './agents/art-design';
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
} from './agents/art-design';
export { buildMockArtDesignResponse } from './agents/art-design/mock';

// Model registry (esposto per UI + dispatcher)
export {
  MODEL_REGISTRY,
  getModelById,
  getModelsByType,
  formatRegistryForPrompt,
} from './runtime/model-registry';
export type { ModelOption, ModelType, CostTier } from './runtime/model-registry';

// Asset dispatcher (instrada la richiesta al runtime del modello scelto)
export { dispatchAssetGeneration } from './runtime/asset-dispatcher';
export type {
  AssetDispatchInput,
  AssetDispatchResult,
} from './runtime/asset-dispatcher';

// Configurazione mock di default per V1: registriamo le risposte mock note.
import { setMockResponseProvider } from './runtime/llm/mock';
import { buildMockDirettoreResponse } from './agents/direttore-operativo/mock';
import { buildMockFinanceAdminResponse } from './agents/finance-admin/mock';
import { buildMockCreativeLeadResponse } from './agents/creative-lead/mock';
import { buildMockCopyAgentResponse } from './agents/copy-agent/mock';
import { buildMockArtDesignResponse } from './agents/art-design/mock';
import { buildMockProjectManagerResponse } from './agents/project-manager/mock';
import { buildMockEmailComposerResponse } from './agents/email-composer/mock';

setMockResponseProvider(({ agentName, userMessage }) => {
  switch (agentName) {
    case 'direttore-operativo':
      return buildMockDirettoreResponse(userMessage);
    case 'finance-admin':
      return buildMockFinanceAdminResponse(userMessage);
    case 'creative-lead':
      return buildMockCreativeLeadResponse(userMessage);
    case 'copy-agent':
      return buildMockCopyAgentResponse(userMessage);
    case 'art-design':
      return buildMockArtDesignResponse(userMessage);
    case 'project-manager':
      return buildMockProjectManagerResponse(userMessage);
    case 'email-composer':
      return buildMockEmailComposerResponse(userMessage);
    default:
      throw new Error(`Nessuna risposta mock registrata per agente "${agentName}"`);
  }
});
