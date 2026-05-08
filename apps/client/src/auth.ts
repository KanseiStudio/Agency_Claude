// Istanza NextAuth completa per il portale cliente (Node runtime).
// Usata da route handler e server component.

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { authenticateByCredentials, credentialsSchema, type AuthenticatedUser } from '@kansei/auth';

import { authConfig } from './auth.config';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await authenticateByCredentials(
          parsed.data.email,
          parsed.data.password,
          'client',
        );
        if (!user) return null;

        return user as unknown as AuthenticatedUser;
      },
    }),
  ],
});
