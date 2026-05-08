'use server';

// Server actions di approvazione/rifiuto del brief iniziale.
// Solo admin loggato può eseguirle.

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';

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
