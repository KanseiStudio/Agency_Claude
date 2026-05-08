// Config NextAuth "leggera" per Edge runtime (middleware) del client portal.
//
// Cookie scoped per app: vedi commento equivalente in
// apps/admin/src/auth.config.ts. Qui prefissiamo "kansei.client" sui cookie
// per non collidere con quelli dell'app admin in dev locale.

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
      name: useSecure ? '__Secure-kansei.client.session-token' : 'kansei.client.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecure,
      },
    },
    callbackUrl: {
      name: useSecure ? '__Secure-kansei.client.callback-url' : 'kansei.client.callback-url',
      options: { sameSite: 'lax', path: '/', secure: useSecure },
    },
    csrfToken: {
      name: useSecure ? '__Host-kansei.client.csrf-token' : 'kansei.client.csrf-token',
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
