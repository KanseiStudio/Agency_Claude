// Istanza NextAuth dedicata all'app admin.
//
// Pattern Next.js + Auth.js v5: questo file viene importato sia dalla route
// handler `/api/auth/[...nextauth]/route.ts` (per servire i flussi auth)
// sia dal middleware (per proteggere le route) sia dai server component
// (per leggere la sessione corrente).
//
// Strategia di sessione: JWT (no DB session). I dati utente vengono
// firmati e salvati nel cookie. Niente lookup DB ad ogni richiesta.
//
// Provider attivo: Credentials (email + password). Magic-link via email
// verrà aggiunto in fase successiva.

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { authenticateByCredentials, credentialsSchema, type AuthenticatedUser } from '@kansei/auth';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials) {
        // Validazione formato input via Zod.
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        // Verifica credenziali + ruolo "admin" obbligatorio per questa app.
        const user = await authenticateByCredentials(
          parsed.data.email,
          parsed.data.password,
          'admin',
        );
        if (!user) return null;

        // L'oggetto ritornato qui finisce nel JWT.
        return user;
      },
    }),
  ],
  callbacks: {
    // Embed dei campi custom dell'utente (role, clientId, locale)
    // dentro al JWT.
    async jwt({ token, user }) {
      if (user) {
        const u = user as AuthenticatedUser;
        token.id = u.id;
        token.role = u.role;
        token.clientId = u.clientId;
        token.locale = u.locale;
      }
      return token;
    },
    // Esposizione dei campi custom nella `Session` accessibile via `auth()`.
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
});
