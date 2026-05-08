// Estensione dei tipi di Auth.js (NextAuth v5) per includere i campi
// custom (role, clientId, locale) nel session.user.
//
// Questo file non viene mai importato esplicitamente: TypeScript lo
// "vede" perché si chiama .d.ts e si trova nei path indicizzati da
// tsconfig. Vivendo qui non inquina il pacchetto @kansei/auth con
// dipendenze a NextAuth.

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
