// Estensione tipi NextAuth per il client portal.
// Identico al file equivalente in apps/admin: i tipi sono per-app.

import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    role: 'admin' | 'client';
    clientId: string | null;
    locale: 'it' | 'en';
  }

  interface Session {
    user: {
      id: string;
      email: string;
      role: 'admin' | 'client';
      clientId: string | null;
      locale: 'it' | 'en';
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'admin' | 'client';
    clientId?: string | null;
    locale?: 'it' | 'en';
  }
}
