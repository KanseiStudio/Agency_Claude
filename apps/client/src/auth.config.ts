// Config NextAuth "leggera" per Edge runtime (middleware).
// Stesso pattern di apps/admin/src/auth.config.ts.

import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
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
