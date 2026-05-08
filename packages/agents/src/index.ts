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

// Agente: Direttore Operativo
export {
  direttoreOperativoAgent,
  direttoreInputSchema,
  direttoreOutputSchema,
} from './agents/direttore-operativo';
export type { DirettoreInput, DirettoreOutput } from './agents/direttore-operativo';
export { buildMockDirettoreResponse } from './agents/direttore-operativo/mock';

// Configurazione mock di default per V1: registriamo tutte le risposte mock
// note. Nessun side-effect runtime se MOCK_LLM != 'true'.
import { setMockResponseProvider } from './runtime/llm/mock';
import { buildMockDirettoreResponse } from './agents/direttore-operativo/mock';

setMockResponseProvider(({ agentName, userMessage }) => {
  switch (agentName) {
    case 'direttore-operativo':
      return buildMockDirettoreResponse(userMessage);
    default:
      throw new Error(`Nessuna risposta mock registrata per agente "${agentName}"`);
  }
});
