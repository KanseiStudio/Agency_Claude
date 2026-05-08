// Wrapper attorno all'SDK Anthropic.
// Mappa il "modello logico" (es. claude-sonnet-4-6) sul nome modello reale
// usato dall'API.

import Anthropic from '@anthropic-ai/sdk';
import type { LLMResponse } from '../types';

let cached: Anthropic | null = null;

function client(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY non configurata. Imposta MOCK_LLM=true per dev.');
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

const MODEL_MAP: Record<string, string> = {
  'claude-opus-4-6': 'claude-opus-4-5-20250929',
  'claude-sonnet-4-6': 'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
};

export async function callAnthropic(input: {
  systemPrompt: string;
  userMessage: string;
  modelLogical: string;
  maxTokens?: number;
}): Promise<LLMResponse> {
  const c = client();
  const realModel = MODEL_MAP[input.modelLogical] ?? input.modelLogical;

  const response = await c.messages.create({
    model: realModel,
    max_tokens: input.maxTokens ?? 4096,
    system: input.systemPrompt,
    messages: [{ role: 'user', content: input.userMessage }],
  });

  // Estrai il testo dai blocchi (in 2025+ Anthropic ritorna un array di blocchi).
  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return {
    content: text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cachedTokens:
        (response.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
    },
    modelUsed: realModel,
  };
}
