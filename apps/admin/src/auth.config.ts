// Config NextAuth "leggera" sicura per Edge runtime.
// Non importa Prisma né altri moduli Node-only.
// Usata dal middleware per l'auth check (verifica JWT del cookie).
//
// Cookie scoped per app: in dev locale admin (:3000) e client (:3001)
// vivono sullo stesso `localhost` e si sovrascriverebbero a vicenda
// se usassero il nome cookie default `authjs.session-token`.
// Per evitarlo prefissiamo "kansei.admin" sui cookie di questa app.

import type { NextAuthConfig } from 'next-auth';

const useSecure = process.env.NODE_ENV === 'production';

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [],
  cookies: {
    sessionToken: {
      name: useSecure ? '__Secure-kansei.admin.session-token' : 'kansei.admin.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecure,
      },
    },
    callbackUrl: {
      name: useSecure ? '__Secure-kansei.admin.callback-url' : 'kansei.admin.callback-url',
      options: { sameSite: 'lax', path: '/', secure: useSecure },
    },
    csrfToken: {
      name: useSecure ? '__Host-kansei.admin.csrf-token' : 'kansei.admin.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecure,
      },
    },
  },
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
