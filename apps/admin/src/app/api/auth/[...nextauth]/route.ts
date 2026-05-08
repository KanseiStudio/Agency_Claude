// Endpoint catch-all per i flussi NextAuth v5.
// Gestisce: signin, signout, callback, csrf, providers, session.
//
// `handlers` è esportato da @/auth come oggetto { GET, POST };
// lo destrutturiamo qui per esporre le due route HTTP che Next.js si
// aspetta dai route handler dell'App Router.

import { handlers } from '@/auth';

export const { GET, POST } = handlers;
