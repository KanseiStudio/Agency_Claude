// Schemi Zod condivisi per validazione delle credenziali.
// Usati sia lato server (in NextAuth `authorize`) che client (form login).

import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(8, 'La password deve avere almeno 8 caratteri'),
});

export type Credentials = z.infer<typeof credentialsSchema>;
