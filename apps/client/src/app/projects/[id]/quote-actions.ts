'use server';

// Server actions del cliente per accettare/rifiutare un preventivo.

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';

async function requireClientWithAccessToProject(projectId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'client' || !session.user.clientId) {
    throw new Error('Non autorizzato.');
  }
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true },
  });
  if (!project || project.clientId !== session.user.clientId) {
    throw new Error('Progetto non trovato o non autorizzato.');
  }
  return session;
}

export async function acceptQuoteAction(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireClientWithAccessToProject(projectId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const quote = await prisma.quote.findFirst({
    where: { projectId, status: 'inviato' },
    orderBy: { version: 'desc' },
  });
  if (!quote) {
    return { ok: false, error: 'Nessun preventivo da accettare.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quote.id },
      data: { status: 'accettato' },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { stato: 'preventivo_accettato' },
    });
    await tx.event.create({
      data: {
        projectId,
        tipo: 'project.quote_accepted',
        payload: { quoteVersion: quote.version },
      },
    });
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function rejectQuoteAction(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireClientWithAccessToProject(projectId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const quote = await prisma.quote.findFirst({
    where: { projectId, status: 'inviato' },
    orderBy: { version: 'desc' },
  });
  if (!quote) {
    return { ok: false, error: 'Nessun preventivo da rifiutare.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quote.id },
      data: { status: 'rifiutato' },
    });
    // Torna a in_analisi: l'admin può rigenerare il preventivo
    await tx.project.update({
      where: { id: projectId },
      data: { stato: 'in_analisi' },
    });
    await tx.event.create({
      data: {
        projectId,
        tipo: 'project.quote_rejected',
        payload: { quoteVersion: quote.version },
      },
    });
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
