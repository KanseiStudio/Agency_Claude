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

// Agente: Finance/Admin
export {
  financeAdminAgent,
  financeAdminInputSchema,
  financeAdminOutputSchema,
} from './agents/finance-admin';
export type { FinanceAdminInput, FinanceAdminOutput, QuoteItem } from './agents/finance-admin';
export { buildMockFinanceAdminResponse } from './agents/finance-admin/mock';

// Agente: Creative Lead
export {
  creativeLeadAgent,
  creativeLeadInputSchema,
  creativeLeadOutputSchema,
} from './agents/creative-lead';
export type { CreativeLeadInput, CreativeLeadOutput } from './agents/creative-lead';
export { buildMockCreativeLeadResponse } from './agents/creative-lead/mock';

// Configurazione mock di default per V1: registriamo le risposte mock note.
import { setMockResponseProvider } from './runtime/llm/mock';
import { buildMockDirettoreResponse } from './agents/direttore-operativo/mock';
import { buildMockFinanceAdminResponse } from './agents/finance-admin/mock';
import { buildMockCreativeLeadResponse } from './agents/creative-lead/mock';

setMockResponseProvider(({ agentName, userMessage }) => {
  switch (agentName) {
    case 'direttore-operativo':
      return buildMockDirettoreResponse(userMessage);
    case 'finance-admin':
      return buildMockFinanceAdminResponse(userMessage);
    case 'creative-lead':
      return buildMockCreativeLeadResponse(userMessage);
    default:
      throw new Error(`Nessuna risposta mock registrata per agente "${agentName}"`);
  }
});
