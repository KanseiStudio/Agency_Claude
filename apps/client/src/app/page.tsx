import Link from 'next/link';
import { auth, signOut } from '@/auth';
import type { AgentProvider, Locale } from '@kansei/shared';
import { prisma } from '@kansei/database';

export default async function Home() {
  const session = await auth();

  const locale: Locale = 'it';
  const sampleProviders: AgentProvider[] = ['anthropic', 'openai', 'google', 'fal'];

  // Conta i progetti del cliente loggato.
  // session.user.clientId è null finché non c'è un Client collegato.
  const myProjectsCount = session?.user.clientId
    ? await prisma.project.count({ where: { clientId: session.user.clientId } })
    : 0;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-12 font-sans dark:bg-black">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Kansei-Studio Agency
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Area Cliente
            </h1>
          </div>

          {session?.user ? (
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Esci
              </button>
            </form>
          ) : null}
        </div>

        {session?.user ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Loggato come{' '}
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-50">
              {session.user.email}
            </span>{' '}
            · ruolo{' '}
            <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
              {session.user.role}
            </span>
          </p>
        ) : null}

        <div className="mt-8 space-y-4">
          <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Locale corrente
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {locale}
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              I tuoi progetti
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
              {myProjectsCount}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/projects"
                className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100 dark:bg-zinc-900 dark:text-emerald-100 dark:hover:bg-zinc-800"
              >
                Vedi tutti →
              </Link>
              <Link
                href="/projects/new"
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                + Nuovo brief
              </Link>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Provider AI configurati per la produzione
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {sampleProviders.map((p) => (
                <li
                  key={p}
                  className="rounded-full bg-zinc-200 px-3 py-1 font-mono text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
