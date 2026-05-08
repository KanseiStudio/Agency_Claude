import type { AgentProvider, Locale } from '@kansei/shared';

export default function Home() {
  // Importazioni di prova dal pacchetto condiviso @kansei/shared.
  // Stesso esercizio dell'app admin: se i tipi sono visibili e la
  // pagina si carica, il link tra apps/client e packages/shared
  // funziona.
  const locale: Locale = 'it';
  const sampleProviders: AgentProvider[] = ['anthropic', 'openai', 'google', 'fal'];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-12 font-sans dark:bg-black">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Kansei-Studio Agency
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Portale Cliente
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Test di import dal pacchetto condiviso{' '}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            @kansei/shared
          </code>
          .
        </p>

        <div className="mt-8 space-y-4">
          <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Locale corrente
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {locale}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Provider AI configurati
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

        <p className="mt-8 text-sm text-zinc-500">
          Se vedi questa pagina senza errori in console, il monorepo è cablato correttamente.
        </p>
      </div>
    </main>
  );
}
