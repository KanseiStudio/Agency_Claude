import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata = {
  title: 'Login · Kansei-Studio · Area Cliente',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 font-sans dark:bg-black">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Kansei-Studio Agency
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Area Cliente · Accedi
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Inserisci le credenziali fornite dall&apos;agenzia per accedere ai tuoi progetti.
        </p>

        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
