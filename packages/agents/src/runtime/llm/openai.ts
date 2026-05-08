// Wrapper attorno all'SDK OpenAI. Stub per ora: lo useremo nei prossimi
// agenti (Finance/Admin con Structured Outputs, QA Agent, ecc.).
// Il pattern è identico ad Anthropic.

import OpenAI from 'openai';
import type { LLMResponse } from '../types';

let cached: OpenAI | null = null;

function client(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY non configurata. Imposta MOCK_LLM=true per dev.');
  }
  cached = new OpenAI({ apiKey });
  return cached;
}

export async function callOpenAI(input: {
  systemPrompt: string;
  userMessage: string;
  modelLogical: string;
  maxTokens?: number;
}): Promise<LLMResponse> {
  const c = client();

  const response = await c.chat.completions.create({
    model: input.modelLogical,
    max_completion_tokens: input.maxTokens ?? 4096,
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userMessage },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';

  return {
    content: text,
    usage: {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      cachedTokens:
        (response.usage as { prompt_tokens_details?: { cached_tokens?: number } } | undefined)
          ?.prompt_tokens_details?.cached_tokens ?? 0,
    },
    modelUsed: input.modelLogical,
  };
}
