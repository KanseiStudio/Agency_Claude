// Tipi condivisi del livello auth.

export type AuthRole = 'admin' | 'client';

/**
 * Forma minimale dell'utente autenticato esposta al frontend.
 * NON include la password hash o altri dati sensibili.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AuthRole;
  clientId: string | null;
  locale: 'it' | 'en';
}
