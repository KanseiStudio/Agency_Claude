// Entry point del pacchetto @kansei/database.
// Esporta:
//   - il client Prisma singleton (`prisma`) — runtime
//   - i runtime utili (Prisma, PrismaClient)
//   - tutti i tipi generati da Prisma (User, Client, Project, ...) — type-only
//
// La distinzione runtime / type-only è importante: `@prisma/client` è un
// modulo CommonJS, quindi non possiamo fare `export *` runtime da esso in
// ESM strict. `export type *` invece funziona perché i tipi vengono
// cancellati a build time.
//
// Convenzione import: niente estensioni `.js` nei path relativi.
// La risoluzione TypeScript "Bundler" (definita in tsconfig.base.json) e
// Next.js Turbopack si occupano del resto.
//
// Uso da apps/admin o apps/client:
//   import { prisma, type Project, type User } from '@kansei/database';
//   import { Prisma } from '@kansei/database';

export { prisma } from './client';
export { Prisma, PrismaClient } from '@prisma/client';
export type * from '@prisma/client';
