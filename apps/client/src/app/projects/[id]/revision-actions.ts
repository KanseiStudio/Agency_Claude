'use server';

// Server action cliente: richiedi una revisione su un deliverable.
//
// Tracking dei round:
//   - Round 1, 2, 3: tipo `incluso` (gratuiti).
//   - Round 4+: tipo `extra_a_pagamento` (V1 li registra ma NON blocca).
//     Il gating reale del pagamento verrà aggiunto in Setup 12.
//
// Tutte le RevisionRequest dentro lo stesso "click di richiesta" finiscono
// in un singolo RevisionRound. Se l'ultimo round è ancora aperto (status
// `richiesta` o `in_lavorazione`), la nuova richiesta si aggancia lì.
// Altrimenti viene creato un nuovo round.

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';

const MAX_FREE_ROUNDS = 3;

export async function requestRevisionAction(
  projectId: string,
  deliverableId: string,
  descrizione: string,
): Promise<{ ok: true; roundNumber: number; isPaid: boolean } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'client' || !session.user.clientId) {
    return { ok: false, error: 'Non autorizzato.' };
  }

  if (descrizione.trim().length < 10) {
    return { ok: false, error: 'Descrivi la modifica richiesta (almeno 10 caratteri).' };
  }
  if (descrizione.length > 2000) {
    return { ok: false, error: 'Descrizione troppo lunga (max 2000 caratteri).' };
  }

  // Verifica che il progetto sia del cliente loggato e in stato compatibile
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true, stato: true },
  });
  if (!project || project.clientId !== session.user.clientId) {
    return { ok: false, error: 'Progetto non trovato.' };
  }
  if (project.stato !== 'in_revisione') {
    return {
      ok: false,
      error: 'Il progetto non è in revisione. Non puoi richiedere modifiche ora.',
    };
  }

  // Verifica che il deliverable appartenga al progetto
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: { projectId: true, titolo: true },
  });
  if (!deliverable || deliverable.projectId !== projectId) {
    return { ok: false, error: 'Deliverable non trovato.' };
  }

  let roundNumber = 0;
  let isPaid = false;

  await prisma.$transaction(async (tx) => {
    // Cerca un round aperto recente (gli aggreghiamo la richiesta)
    const openRound = await tx.revisionRound.findFirst({
      where: {
        projectId,
        status: { in: ['richiesta', 'in_lavorazione'] },
      },
      orderBy: { numero: 'desc' },
    });

    let round = openRound;
    if (!round) {
      const lastRound = await tx.revisionRound.findFirst({
        where: { projectId },
        orderBy: { numero: 'desc' },
      });
      const nextNumber = (lastRound?.numero ?? 0) + 1;
      const isExtra = nextNumber > MAX_FREE_ROUNDS;
      round = await tx.revisionRound.create({
        data: {
          projectId,
          numero: nextNumber,
          tipo: isExtra ? 'extra_a_pagamento' : 'incluso',
          prezzoCents: isExtra ? 5000 : 0, // 50€ a round extra (placeholder, configurabile)
          status: 'richiesta',
        },
      });
    }

    await tx.revisionRequest.create({
      data: {
        roundId: round.id,
        deliverableId,
        descrizioneModifica: descrizione,
      },
    });

    await tx.event.create({
      data: {
        projectId,
        tipo: 'revision.requested',
        payload: {
          roundNumber: round.numero,
          deliverableTitolo: deliverable.titolo,
          isPaid: round.tipo === 'extra_a_pagamento',
        },
      },
    });

    roundNumber = round.numero;
    isPaid = round.tipo === 'extra_a_pagamento';
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, roundNumber, isPaid };
}
