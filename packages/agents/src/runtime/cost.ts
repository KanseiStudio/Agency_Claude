// Calcolo del costo di una run a partire dai token + listino su DB.
//
// Strategia: cerchiamo nella tabella `pricing_models` la tariffa corrente
// (validFrom <= ora <= validTo o validTo nullo) per (provider, modello).
// Se non c'è entry, fallback a 0 e log warning.

import { prisma } from '@kansei/database';
import type { LLMUsage } from './types';

export interface ComputeCostInput {
  provider: string;
  model: string;
  usage: LLMUsage;
}

export interface ComputeCostResult {
  costUsd: number;
  /** Conversione USD→EUR. In dev approssimiamo 1 USD = 0.92 EUR. */
  costEur: number;
}

const USD_TO_EUR = 0.92;

export async function computeCost(input: ComputeCostInput): Promise<ComputeCostResult> {
  const now = new Date();

  const pricing = await prisma.pricingModel.findFirst({
    where: {
      provider: input.provider,
      model: input.model,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    orderBy: { validFrom: 'desc' },
  });

  if (!pricing) {
    console.warn(
      `[computeCost] Nessun pricing per ${input.provider}/${input.model}. Costo impostato a 0. Aggiorna pricing.yaml.`,
    );
    return { costUsd: 0, costEur: 0 };
  }

  const inputPrice = Number(pricing.inputPricePer1k);
  const outputPrice = Number(pricing.outputPricePer1k);
  const cachedPrice = pricing.cachedPricePer1k ? Number(pricing.cachedPricePer1k) : 0;

  const costUsd =
    (input.usage.inputTokens / 1000) * inputPrice +
    (input.usage.outputTokens / 1000) * outputPrice +
    (input.usage.cachedTokens / 1000) * cachedPrice;

  return {
    costUsd: roundToCents(costUsd),
    costEur: roundToCents(costUsd * USD_TO_EUR),
  };
}

function roundToCents(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000; // 6 decimali
}
