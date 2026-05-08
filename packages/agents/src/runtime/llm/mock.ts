// Provider LLM "mock": usato in dev quando non c'è API key configurata.
// Restituisce risposte canned coerenti con lo schema dell'agente.
//
// Ogni agente registra qui (via parametro `mockResponses`) le risposte
// che il runner serve a fronte del nome agente.

import type { LLMResponse } from '../types';

export type MockResponseProvider = (input: { agentName: string; userMessage: string }) => string;

let mockProvider: MockResponseProvider | null = null;

export function setMockResponseProvider(p: MockResponseProvider): void {
  mockProvider = p;
}

export async function callMock(input: {
  agentName: string;
  systemPrompt: string;
  userMessage: string;
  modelLogical: string;
}): Promise<LLMResponse> {
  if (!mockProvider) {
    throw new Error(
      `MOCK_LLM attivo ma nessun mock response provider registrato. Aggiungilo via setMockResponseProvider().`,
    );
  }

  // Latenza simulata 100-300ms per essere realistico in dev.
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

  const content = mockProvider({
    agentName: input.agentName,
    userMessage: input.userMessage,
  });

  // Simuliamo un consumo plausibile. Niente di esatto: serve solo ad avere
  // numeri non nulli nella tabella token_usage durante i test.
  const inputTokens = Math.ceil((input.systemPrompt.length + input.userMessage.length) / 4);
  const outputTokens = Math.ceil(content.length / 4);

  return {
    content,
    usage: { inputTokens, outputTokens, cachedTokens: 0 },
    modelUsed: `mock(${input.modelLogical})`,
  };
}
