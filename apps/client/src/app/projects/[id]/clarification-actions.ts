'use server';

// Server action cliente: rispondi alle domande di chiarimento del Direttore.
//
// Effetti:
//   1. Salva le risposte sulla ClarificationRequest (status: responded)
//   2. Appende le Q&A alla descrizione del Brief (così Direttore re-run le vede)
//   3. Riporta lo stato progetto da "attesa_chiarimenti" a "bozza_approvata"
//      (il flusso può ri-partire)
//   4. Auto-trigger email admin "brief_clarification_responded"

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';
import { safelyTriggerEmail } from '@/lib/notifications';

export async function respondToClarificationAction(
  clarificationRequestId: string,
  responses: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'client' || !session.user.clientId) {
    return { ok: false, error: 'Non autorizzato.' };
  }

  const request = await prisma.clarificationRequest.findUnique({
    where: { id: clarificationRequestId },
    include: {
      project: { select: { id: true, clientId: true, stato: true } },
      brief: { select: { id: true, descrizione: true } },
    },
  });
  if (!request) return { ok: false, error: 'Richiesta chiarimento non trovata.' };

  // Verifica ownership progetto
  if (request.project.clientId !== session.user.clientId) {
    return { ok: false, error: 'Non autorizzato a questo progetto.' };
  }

  if (request.status !== 'pending') {
    return {
      ok: false,
      error: `Richiesta in stato "${request.status}" — non più rispondibile.`,
    };
  }

  // Verifica numero risposte
  const questions = request.questions as unknown as string[];
  if (responses.length !== questions.length) {
    return {
      ok: false,
      error: `Risposte attese ${questions.length}, ricevute ${responses.length}.`,
    };
  }
  // Almeno una risposta deve essere non vuota
  const nonEmptyCount = responses.filter((r) => r.trim().length > 0).length;
  if (nonEmptyCount === 0) {
    return { ok: false, error: 'Almeno una risposta deve essere compilata.' };
  }

  // Costruisce blocco di addendum per il brief: "Q1: ... A1: ..."
  const briefAddendum = [
    '',
    '---',
    '## Chiarimenti aggiuntivi (' + new Date().toLocaleDateString('it-IT') + ')',
    '',
    ...questions.flatMap((q, i) => [
      `**Q${i + 1}.** ${q}`,
      `**R.** ${responses[i]?.trim() || '(nessuna risposta)'}`,
      '',
    ]),
  ].join('\n');

  await prisma.$transaction(async (tx) => {
    await tx.clarificationRequest.update({
      where: { id: clarificationRequestId },
      data: {
        responses: responses as unknown as object,
        status: 'responded',
        respondedAt: new Date(),
      },
    });
    // Appende l'addendum alla descrizione del brief
    await tx.brief.update({
      where: { id: request.briefId },
      data: {
        descrizione: request.brief.descrizione + briefAddendum,
      },
    });
    // Riporta il progetto in "in_analisi" così l'admin può ri-eseguire il
    // Direttore Operativo sul brief aggiornato
    await tx.project.update({
      where: { id: request.project.id },
      data: { stato: 'in_analisi' },
    });
    await tx.event.create({
      data: {
        projectId: request.project.id,
        tipo: 'project.clarification_responded',
        payload: {
          clarificationRequestId,
          questionsCount: questions.length,
          respondedBy: session.user!.email,
        },
      },
    });
  });

  // Notifica all'admin: "il cliente ha risposto, puoi procedere"
  // Indirizzata al cliente fatturazione MA letta dall'admin nella inbox
  // agency@kansei-studio.art (è una mail "interna" all'agenzia).
  // Per ora la mandiamo al cliente come notifica di ricezione + log admin.
  await safelyTriggerEmail({
    projectId: request.project.id,
    kind: 'brief_clarification_responded',
  });

  revalidatePath(`/projects/${request.project.id}`);
  return { ok: true };
}
