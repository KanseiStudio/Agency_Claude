'use server';

// Server actions di approvazione/rifiuto del brief iniziale e
// trigger del Direttore Operativo.
// Solo admin loggato può eseguirle.

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';
import { runAgent, direttoreOperativoAgent } from '@kansei/agents';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    throw new Error('Non autorizzato.');
  }
  return session;
}

export async function approveBriefAction(projectId: string): Promise<{ ok: boolean }> {
  const session = await requireAdmin();

  await prisma.$transaction(async (tx) => {
    const approval = await tx.approval.findFirst({
      where: { projectId, checkpointCode: 'brief_iniziale', esito: 'pending' },
    });
    if (!approval) throw new Error('Approvazione non trovata o già decisa.');

    await tx.approval.update({
      where: { id: approval.id },
      data: {
        esito: 'approvato',
        decidedAt: new Date(),
        decidedById: session.user.id,
      },
    });

    await tx.project.update({
      where: { id: projectId },
      data: { stato: 'in_analisi' },
    });

    await tx.event.create({
      data: {
        projectId,
        tipo: 'project.brief_approved',
        payload: { decidedBy: session.user.email },
      },
    });
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/projects');
  return { ok: true };
}

/**
 * Lancia il Direttore Operativo sul progetto. Sincrono: l'admin attende
 * il completamento (con MOCK_LLM è ~300ms; con LLM reale 5-30s).
 * In V2 lo sposteremo dietro una coda asincrona.
 */
export async function runDirettoreOperativoAction(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { ragioneSociale: true } },
      briefs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!project) return { ok: false, error: 'Progetto non trovato.' };
  const brief = project.briefs[0];
  if (!brief) return { ok: false, error: 'Brief non trovato per questo progetto.' };

  try {
    await runAgent(
      direttoreOperativoAgent,
      {
        projectId: project.id,
        codiceProgetto: project.codiceProgetto,
        titolo: project.titolo,
        descrizione: brief.descrizione,
        deliverableRichiesti: Array.isArray(brief.deliverableRichiesti)
          ? (brief.deliverableRichiesti as string[])
          : [],
        deadline: brief.deadline ? brief.deadline.toISOString().slice(0, 10) : null,
        budgetIndicativoEur: brief.budgetIndicativoCents ? brief.budgetIndicativoCents / 100 : null,
        clientName: project.client.ragioneSociale,
        language: project.language as 'it' | 'en',
      },
      { projectId: project.id },
    );

    await prisma.event.create({
      data: {
        projectId: project.id,
        tipo: 'agent.direttore_operativo.success',
      },
    });
  } catch (e) {
    const message = (e as Error).message;
    await prisma.event.create({
      data: {
        projectId: project.id,
        tipo: 'agent.direttore_operativo.failed',
        payload: { error: message },
      },
    });
    return { ok: false, error: `Direttore Operativo fallito: ${message}` };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function rejectBriefAction(projectId: string, note: string): Promise<{ ok: boolean }> {
  const session = await requireAdmin();

  await prisma.$transaction(async (tx) => {
    const approval = await tx.approval.findFirst({
      where: { projectId, checkpointCode: 'brief_iniziale', esito: 'pending' },
    });
    if (!approval) throw new Error('Approvazione non trovata o già decisa.');

    await tx.approval.update({
      where: { id: approval.id },
      data: {
        esito: 'rifiutato',
        decidedAt: new Date(),
        decidedById: session.user.id,
        note: note || null,
      },
    });

    await tx.project.update({
      where: { id: projectId },
      data: { stato: 'annullato', closedAt: new Date() },
    });

    await tx.event.create({
      data: {
        projectId,
        tipo: 'project.brief_rejected',
        payload: { decidedBy: session.user.email, note: note || null },
      },
    });
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/projects');
  return { ok: true };
}
