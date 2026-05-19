// runAgent: punto unico per eseguire un agente.
//
// Responsabilità:
//   - validazione input via Zod
//   - apertura record `agent_runs` (status = running)
//   - chiamata LLM (real o mock)
//   - parsing JSON dell'output + validazione contro outputSchema
//   - calcolo costo a partire dai token
//   - persistenza in `token_usage`
//   - persistenza in `agent_outputs` (payload completo)
//   - chiusura `agent_runs` (status = success/failed, latencyMs)
//   - log strutturato in `agent_logs`

import { prisma, Prisma } from '@kansei/database';
import type { ZodIssue } from 'zod';
import type {
  AgentDefinition,
  AgentInput,
  AgentOutput,
  AgentRunContext,
  AgentRunResult,
} from './types';
import { callLLM } from './llm/factory';
import { computeCost } from './cost';

// Nota di varianza: usiamo `AgentDefinition<any, any>` come bound per
// permettere a `runAgent` di accettare definizioni concrete con generici
// stretti (es. `AgentDefinition<typeof direttoreInputSchema, typeof
// direttoreOutputSchema>`). Senza l'`any, any` la tipizzazione contravariante
// dei callback `buildSystemPrompt`/`buildUserMessage` rende impossibile
// passare definizioni concrete a una firma generica più ampia.
// Il typing reale (validazione input/output) avviene comunque a runtime via Zod.
export async function runAgent<A extends AgentDefinition<any, any>>(
  agent: A,
  input: AgentInput<A>,
  ctx: AgentRunContext,
): Promise<AgentRunResult<A>> {
  const startedAt = new Date();
  const projectId = ctx.projectId;

  // Validazione input
  const parsedInput = agent.inputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error(
      `[runAgent:${agent.name}] input non valido: ${JSON.stringify(parsedInput.error.issues)}`,
    );
  }
  const validatedInput = parsedInput.data as AgentInput<A>;

  // Apri agent_run
  const run = await prisma.agentRun.create({
    data: {
      projectId,
      agente: agent.name,
      startedAt,
      status: 'running',
    },
  });

  try {
    const systemPrompt = agent.buildSystemPrompt(validatedInput);
    const baseUserMessage = agent.buildUserMessage(validatedInput);

    // Loop di retry su validazione output: tentiamo fino a 2 volte.
    // Se il primo output non aderisce allo schema, rimandiamo gli errori
    // di validazione all'LLM con un messaggio correttivo e gli diamo
    // un'altra chance prima di fallire.
    const MAX_ATTEMPTS = 2;
    let llmResponse: Awaited<ReturnType<typeof callLLM>> | null = null;
    let parsedJson: unknown = null;
    let parsedOutput: ReturnType<typeof agent.outputSchema.safeParse> | null = null;
    let lastUserMessage = baseUserMessage;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      llmResponse = await callLLM({
        agentName: agent.name,
        provider: agent.provider,
        systemPrompt,
        userMessage: lastUserMessage,
        modelLogical: agent.model,
      });

      try {
        parsedJson = parseJsonStrict(llmResponse.content);
      } catch (parseErr) {
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(
            `Output JSON non parsabile dopo ${MAX_ATTEMPTS} tentativi: ${(parseErr as Error).message}`,
          );
        }
        lastUserMessage =
          baseUserMessage +
          `\n\n---\nIl tuo precedente output NON era JSON valido (parse error: ${(parseErr as Error).message}). Rigenera SOLO un JSON valido, niente markdown né code fence, niente testo extra.`;
        continue;
      }

      parsedOutput = agent.outputSchema.safeParse(parsedJson);
      if (parsedOutput.success) break;

      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `Output non aderente allo schema: ${JSON.stringify(parsedOutput.error.issues)}`,
        );
      }

      const issuesText = (parsedOutput.error.issues as ZodIssue[])
        .map((iss: ZodIssue) => `  - path ${iss.path.join('.')}: ${iss.message}`)
        .join('\n');
      lastUserMessage =
        baseUserMessage +
        `\n\n---\nIl tuo precedente output NON ha superato la validazione dello schema. Errori:\n${issuesText}\n\nRigenera l'INTERO JSON corretto, includendo TUTTI i campi richiesti per OGNI elemento degli array. Non omettere nulla.`;
    }

    if (!llmResponse || !parsedOutput || !parsedOutput.success) {
      // Difensivo: non dovrebbe accadere visto che usciamo sopra.
      throw new Error('Output non valido dopo i retry');
    }
    const output = parsedOutput.data as AgentOutput<A>;

    // Costi
    const cost = await computeCost({
      provider: agent.provider,
      model: agent.model,
      usage: llmResponse.usage,
    });

    // Persisti token_usage
    await prisma.tokenUsage.create({
      data: {
        runId: run.id,
        projectId,
        agente: agent.name,
        provider: agent.provider,
        model: llmResponse.modelUsed,
        inputTokens: llmResponse.usage.inputTokens,
        outputTokens: llmResponse.usage.outputTokens,
        cachedTokens: llmResponse.usage.cachedTokens,
        totalTokens:
          llmResponse.usage.inputTokens +
          llmResponse.usage.outputTokens +
          llmResponse.usage.cachedTokens,
        costUsd: cost.costUsd,
        costEur: cost.costEur,
      },
    });

    // Persisti agent_outputs (payload generico, sempre)
    await prisma.agentOutput.create({
      data: {
        projectId,
        agente: agent.name,
        runId: run.id,
        payload: output as unknown as Prisma.InputJsonValue,
        status: 'success',
        version: 1,
      },
    });

    // Log info
    await prisma.agentLog.create({
      data: {
        projectId,
        agente: agent.name,
        runId: run.id,
        livello: 'info',
        messaggio: `Run completata: ${
          llmResponse.usage.inputTokens + llmResponse.usage.outputTokens
        } token, $${cost.costUsd.toFixed(4)}`,
      },
    });

    // Chiudi agent_run
    const endedAt = new Date();
    const latencyMs = endedAt.getTime() - startedAt.getTime();
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { endedAt, status: 'success', latencyMs },
    });

    return {
      runId: run.id,
      output,
      usage: llmResponse.usage,
      costUsd: cost.costUsd,
      costEur: cost.costEur,
      modelUsed: llmResponse.modelUsed,
      latencyMs,
    };
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    const endedAt = new Date();
    const latencyMs = endedAt.getTime() - startedAt.getTime();

    await prisma.agentRun.update({
      where: { id: run.id },
      data: { endedAt, status: 'failed', latencyMs },
    });

    await prisma.agentLog.create({
      data: {
        projectId,
        agente: agent.name,
        runId: run.id,
        livello: 'error',
        messaggio: message,
      },
    });

    throw e;
  }
}

/**
 * Parse JSON tollerante di code fence Markdown.
 * Gli LLM tendono a wrappare il JSON in ```json ... ``` anche quando dici di non farlo.
 */
function parseJsonStrict(raw: string): unknown {
  let cleaned = raw.trim();
  // rimuovi ```json ... ``` o ``` ... ```
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
}
