// Logica di autenticazione condivisa tra le due app.
// Verifica le credenziali contro il DB e applica il filtro di ruolo.
//
// Usato dal callback `authorize` di NextAuth in apps/admin e apps/client.

import { prisma } from '@kansei/database';
import { verifyPassword } from './password';
import type { AuthenticatedUser, AuthRole } from './types';

/**
 * Autentica un utente verificando email + password e il ruolo richiesto.
 *
 * @param email     email fornita dal form di login
 * @param password  password in chiaro fornita dal form di login
 * @param expectedRole  ruolo che l'utente deve avere per accedere a questa app
 * @returns l'utente autenticato (senza dati sensibili) oppure null se la
 *          combinazione email+password+ruolo non è valida
 */
export async function authenticateByCredentials(
  email: string,
  password: string,
  expectedRole: AuthRole,
): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user || !user.passwordHash) {
    // L'utente non esiste, oppure non ha una password (es. account magic-link only).
    return null;
  }

  if (user.role !== expectedRole) {
    // L'utente esiste ma non ha il ruolo richiesto.
    // Es. un client non può loggarsi sull'admin app.
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role as AuthRole,
    clientId: user.clientId,
    locale: user.locale as 'it' | 'en',
  };
}
