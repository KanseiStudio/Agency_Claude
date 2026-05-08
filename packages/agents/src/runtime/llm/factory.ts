// Factory che decide quale provider chiamare per un agente.
//
// Logica di selezione:
//   1. Se MOCK_LLM=true in env → sempre mock
//   2. Altrimenti: usa il provider richiesto dall'agente. Se manca la
//      relativa API key, fallback a mock con warning.

import type { AgentProviderName, LLMResponse } from '../types';
import { callMock } from './mock';
import { callAnthropic } from './anthropic';
import { callOpenAI } from './openai';

export interface CallLLMInput {
  agentName: string;
  provider: AgentProviderName;
  systemPrompt: string;
  userMessage: string;
  modelLogical: string;
  maxTokens?: number;
}

export async function callLLM(input: CallLLMInput): Promise<LLMResponse> {
  if (process.env.MOCK_LLM === 'true') {
    return callMock({
      agentName: input.agentName,
      systemPrompt: input.systemPrompt,
      userMessage: input.userMessage,
      modelLogical: input.modelLogical,
    });
  }

  switch (input.provider) {
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) return fallbackMock(input, 'ANTHROPIC_API_KEY');
      return callAnthropic({
        systemPrompt: input.systemPrompt,
        userMessage: input.userMessage,
        modelLogical: input.modelLogical,
        maxTokens: input.maxTokens,
      });
    case 'openai':
      if (!process.env.OPENAI_API_KEY) return fallbackMock(input, 'OPENAI_API_KEY');
      return callOpenAI({
        systemPrompt: input.systemPrompt,
        userMessage: input.userMessage,
        modelLogical: input.modelLogical,
        maxTokens: input.maxTokens,
      });
    case 'google':
    case 'fal':
    case 'mock':
      return callMock({
        agentName: input.agentName,
        systemPrompt: input.systemPrompt,
        userMessage: input.userMessage,
        modelLogical: input.modelLogical,
      });
  }
}

function fallbackMock(input: CallLLMInput, missingKey: string): Promise<LLMResponse> {
  console.warn(
    `[callLLM] ${missingKey} non configurata per agente "${input.agentName}". Fallback a MOCK. Imposta la chiave per usare il provider reale.`,
  );
  return callMock({
    agentName: input.agentName,
    systemPrompt: input.systemPrompt,
    userMessage: input.userMessage,
    modelLogical: input.modelLogical,
  });
}
