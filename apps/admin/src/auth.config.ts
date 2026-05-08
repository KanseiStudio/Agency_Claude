// Config NextAuth "leggera" sicura per Edge runtime.
// Non importa Prisma né altri moduli Node-only.
// Usata dal middleware per l'auth check (verifica JWT del cookie).
//
// Il middleware Next.js gira in Edge runtime, dove Prisma e bcrypt
// (entrambi Node-only) non possono essere caricati.
//
// La config completa (con Credentials provider che chiama Prisma) vive
// in auth.ts e viene usata SOLO nella route handler /api/auth, che gira
// in runtime Node.

import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  // Niente providers qui: il middleware non ha bisogno di autenticare,
  // gli serve solo verificare il cookie esistente. I providers vivono
  // nella config completa (auth.ts).
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          role: 'admin' | 'client';
          clientId: string | null;
          locale: 'it' | 'en';
        };
        token.id = u.id;
        token.role = u.role;
        token.clientId = u.clientId;
        token.locale = u.locale;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'admin' | 'client';
        session.user.clientId = (token.clientId as string | null) ?? null;
        session.user.locale = (token.locale as 'it' | 'en') ?? 'it';
      }
      return session;
    },
  },
};
