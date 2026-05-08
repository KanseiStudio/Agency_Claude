import type { Locale, ProjectStatus, ProjectType } from '@kansei/shared';

export default function Home() {
  // Importazioni di prova dal pacchetto condiviso @kansei/shared.
  // Se la pagina si carica e i tipi non danno errori in build,
  // significa che il cablaggio del monorepo (pnpm workspaces +
  // Turborepo + path TypeScript) è corretto end-to-end.
  const locale: Locale = 'it';
  const status: ProjectStatus = 'in_attesa_approvazione_admin';
  const type: ProjectType = 'one_shot';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-12 font-sans dark:bg-black">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Kansei-Studio Agency
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dashboard Admin
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Test di import dal pacchetto condiviso{' '}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            @kansei/shared
          </code>
          .
        </p>

        <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Locale</dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {locale}
            </dd>
          </div>
          <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Project status
            </dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {status}
            </dd>
          </div>
          <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Project type
            </dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {type}
            </dd>
          </div>
        </dl>

        <p className="mt-8 text-sm text-zinc-500">
          Se vedi questa pagina senza errori in console, il monorepo è cablato correttamente.
        </p>
      </div>
    </main>
  );
}
