'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

type Result = { ok: true; redirectTo: string } | { ok: false; error: string };

export async function signInAction(formData: FormData, callbackUrl: string): Promise<Result> {
  const email = formData.get('email');
  const password = formData.get('password');

  if (typeof email !== 'string' || typeof password !== 'string') {
    return { ok: false, error: 'Email e password sono obbligatorie.' };
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    return { ok: true, redirectTo: callbackUrl || '/' };
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.type === 'CredentialsSignin') {
        return { ok: false, error: 'Credenziali non valide.' };
      }
      return { ok: false, error: 'Errore durante l’accesso. Riprova.' };
    }
    throw e;
  }
}
