import Link from 'next/link';
import { BriefForm } from './brief-form';

export const metadata = {
  title: 'Nuovo progetto · Kansei-Studio',
};

export default function NewProjectPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 font-sans">
      <Link
        href="/projects"
        className="text-xs font-medium uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
      >
        ← I miei progetti
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Nuovo progetto
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Compila il brief. Sarà valutato dall&apos;agenzia che ti risponderà con un piano di lavoro e
        un preventivo entro pochi giorni lavorativi.
      </p>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <BriefForm />
      </div>
    </main>
  );
}
