'use server';

// Server action: il cliente invia un nuovo brief.
//
// Catena di operazioni (transazione DB + scrittura storage):
//   1. Auth: deve essere loggato come client
//   2. Validazione input via Zod (briefSchema)
//   3. Generazione codice progetto univoco (con retry su collisione)
//   4. Persist file di reference su storage (se presente)
//   5. Creazione record DB: Project + Brief + ProjectFile + Approval + Event
//   6. Redirect alla pagina di dettaglio del progetto

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';
import { getStorage } from '@kansei/storage';
import { briefSchema, buildProjectCode, DELIVERABLE_TYPES } from '@kansei/shared';

type ActionResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
];

export async function createProjectAction(formData: FormData): Promise<ActionResult> {
  // ----- 1. Auth -----
  const session = await auth();
  if (!session?.user || session.user.role !== 'client' || !session.user.clientId) {
    return { ok: false, error: 'Non autorizzato.' };
  }
  const clientId = session.user.clientId;

  // ----- 2. Validazione input -----
  const rawDeliverables = formData.getAll('deliverableRichiesti').map(String);
  const allowed = new Set<string>(DELIVERABLE_TYPES);
  const validDeliverables = rawDeliverables.filter((d) => allowed.has(d));

  const parsed = briefSchema.safeParse({
    titolo: formData.get('titolo'),
    descrizione: formData.get('descrizione'),
    deliverableRichiesti: validDeliverables,
    deadline: formData.get('deadline') || undefined,
    budgetIndicativoEur: formData.get('budgetIndicativoEur') || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_root';
      fieldErrors[key] = issue.message;
    }
    return { ok: false, error: 'Brief non valido. Correggi i campi e riprova.', fieldErrors };
  }
  const data = parsed.data;

  // ----- 3. File reference (opzionale) -----
  const file = formData.get('file') as File | null;
  let fileMeta: {
    storageKey: string;
    filename: string;
    mime: string;
    sizeBytes: number;
  } | null = null;

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, error: 'File troppo grande (max 25 MB).' };
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      return { ok: false, error: `Tipo file non supportato: ${file.type || 'sconosciuto'}.` };
    }
    fileMeta = {
      storageKey: '', // popolato dopo aver creato il progetto (per usare project.id nella key)
      filename: file.name,
      mime: file.type,
      sizeBytes: file.size,
    };
  }

  // ----- 4. Generazione codice progetto con retry su collisione -----
  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  let project: { id: string; codiceProgetto: string };

  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.project.count({
      where: { createdAt: { gte: startOfYear } },
    });
    const codiceProgetto = buildProjectCode(year, count + 1 + attempt);
    try {
      project = await prisma.project.create({
        data: {
          clientId,
          codiceProgetto,
          titolo: data.titolo,
          projectType: 'one_shot',
          stato: 'in_attesa_approvazione_admin',
          language: session.user.locale,
        },
        select: { id: true, codiceProgetto: true },
      });
      break;
    } catch (e: unknown) {
      // Collisione su unique constraint → ritenta
      if ((e as { code?: string }).code === 'P2002') continue;
      throw e;
    }
  }
  if (!project!) {
    return { ok: false, error: 'Impossibile generare un codice progetto unico. Riprova.' };
  }

  // ----- 5. Salvataggio file su storage -----
  if (fileMeta && file) {
    const safeName = sanitizeFilename(file.name);
    fileMeta.storageKey = `uploads/${clientId}/${project!.id}/${Date.now()}_${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await getStorage().put(fileMeta.storageKey, buffer, { contentType: file.type });
  }

  // ----- 6. Brief + ProjectFile + Approval + Event in una transazione -----
  await prisma.$transaction(async (tx) => {
    await tx.brief.create({
      data: {
        projectId: project!.id,
        descrizione: data.descrizione,
        deliverableRichiesti: data.deliverableRichiesti,
        deadline: data.deadline,
        budgetIndicativoCents:
          data.budgetIndicativoEur !== undefined
            ? Math.round(data.budgetIndicativoEur * 100)
            : null,
      },
    });

    if (fileMeta) {
      await tx.projectFile.create({
        data: {
          projectId: project!.id,
          tipo: 'reference',
          storageKey: fileMeta.storageKey,
          filename: fileMeta.filename,
          mime: fileMeta.mime,
          dimensione: BigInt(fileMeta.sizeBytes),
          uploadedBy: session.user.id,
        },
      });
    }

    await tx.approval.create({
      data: {
        projectId: project!.id,
        checkpointCode: 'brief_iniziale',
        esito: 'pending',
        payload: {
          submittedBy: session.user.id,
          submittedAt: new Date().toISOString(),
        },
      },
    });

    await tx.event.create({
      data: {
        projectId: project!.id,
        tipo: 'project.created',
        payload: {
          codiceProgetto: project!.codiceProgetto,
          submittedBy: session.user.email,
        },
      },
    });
  });

  // Redirect fuori dal try/catch (Next 15+ throw NEXT_REDIRECT internamente).
  redirect(`/projects/${project!.id}`);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}
