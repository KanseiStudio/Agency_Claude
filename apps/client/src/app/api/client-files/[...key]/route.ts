// Route handler che serve file deliverable al cliente.
// Gating: auth client + ownership progetto + payment confermato.
//
// URL pattern: /api/client-files/<storage_key>
// Esempio: /api/client-files/deliverables/PROJECT/copy/01-claim.md

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';
import { getStorage } from '@kansei/storage';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  // Auth: client autenticato
  const session = await auth();
  if (!session?.user || session.user.role !== 'client' || !session.user.clientId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { key: keyParts } = await params;
  const storageKey = keyParts.join('/');

  // Trova il deliverable da storage_key
  const deliverable = await prisma.deliverable.findFirst({
    where: { storageKey },
    include: {
      project: {
        select: {
          clientId: true,
          invoices: {
            where: { status: 'pagata' },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!deliverable) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // Ownership: il deliverable appartiene a un progetto del cliente loggato
  if (deliverable.project.clientId !== session.user.clientId) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Payment gating: deve esserci almeno una fattura pagata per il progetto
  if (deliverable.project.invoices.length === 0) {
    return new NextResponse('Payment required', { status: 402 });
  }

  // Servi il file
  const storage = getStorage();
  const exists = await storage.exists(storageKey);
  if (!exists) {
    return new NextResponse('Not Found in storage', { status: 404 });
  }
  const buffer = await storage.get(storageKey);
  const mime = deliverable.mime ?? inferMime(storageKey);
  const filename = storageKey.split('/').pop() ?? 'download';

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(buffer.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

function inferMime(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    case 'md':
      return 'text/markdown';
    case 'txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}
