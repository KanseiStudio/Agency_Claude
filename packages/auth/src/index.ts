// Entry point del pacchetto @kansei/auth.
// Espone helper trasversali per autenticazione delle due app (admin e client).
//
// Quello che vive QUI:
//   - hashing password (bcrypt)
//   - lookup utente con verifica ruolo
//   - schemi Zod delle credenziali
//   - tipi estesi della Session NextAuth
//
// Quello che vive in CIASCUNA app (admin / client):
//   - istanza NextAuth (`auth.ts`)
//   - middleware di protezione delle route
//   - route handler `/api/auth/[...nextauth]`
//   - pagina /login

export { hashPassword, verifyPassword } from './password';
export { authenticateByCredentials } from './authenticate';
export { credentialsSchema } from './schemas';
export type { AuthenticatedUser, AuthRole } from './types';
