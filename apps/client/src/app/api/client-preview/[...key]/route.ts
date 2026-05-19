// Route handler per ANTEPRIMA dei deliverable lato cliente.
// Differente da /api/client-files/[...key]:
//   - QUESTO endpoint: auth + ownership progetto, NO payment check.
//     Serve il file inline (no attachment header). Usato per <img src="...">
//     prima del pagamento, così il cliente vede l'anteprima protetta.
//   - L'altro endpoint: auth + ownership + payment. Serve il file come
//     attachment per il download finale.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@kansei/database';
import { getStorage } from '@kansei/storage';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'client' || !session.user.clientId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { key: keyParts } = await params;
  const storageKey = keyParts.join('/');

  const deliverable = await prisma.deliverable.findFirst({
    where: { storageKey },
    include: {
      project: { select: { clientId: true } },
    },
  });

  if (!deliverable) {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (deliverable.project.clientId !== session.user.clientId) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const storage = getStorage();
  const exists = await storage.exists(storageKey);
  if (!exists) {
    return new NextResponse('Not Found in storage', { status: 404 });
  }

  const buffer = await storage.get(storageKey);
  const mime = deliverable.mime ?? 'application/octet-stream';

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(buffer.byteLength),
      // Niente attachment: l'<img> deve renderizzare inline.
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
