'use client';

// Form risposta alle domande di chiarimento del Direttore Operativo.
// Mostrato in cima alla project page quando esiste una ClarificationRequest
// in stato "pending" per il progetto.

import { useState, useTransition } from 'react';
import { respondToClarificationAction } from './clarification-actions';

interface Props {
  clarificationRequestId: string;
  questions: string[];
}

export function ClarificationForm({ clarificationRequestId, questions }: Props) {
  const [responses, setResponses] = useState<string[]>(() => questions.map(() => ''));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateResponse(index: number, value: string) {
    setResponses((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await respondToClarificationAction(
        clarificationRequestId,
        responses,
      );
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <section className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950/40">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Richiesta chiarimenti · {questions.length} domand
          {questions.length === 1 ? 'a' : 'e'}
        </h2>
      </div>
      <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
        Per preparare il preventivo ci servono alcune informazioni che non abbiamo
        trovato nel brief. Rispondi qui sotto — appena ricevute, partiamo con la
        lavorazione.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        {questions.map((q, i) => (
          <div key={i} className="space-y-2">
            <label className="block text-sm font-semibold text-amber-900 dark:text-amber-100">
              {i + 1}. {q}
            </label>
            <textarea
              required={i === 0}
              value={responses[i]}
              onChange={(e) => updateResponse(i, e.target.value)}
              rows={3}
              placeholder="Scrivi qui la tua risposta…"
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-amber-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
        ))}

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3 border-t border-amber-300 pt-4 dark:border-amber-700">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
          >
            {isPending ? 'Invio in corso…' : 'Invia risposte'}
          </button>
          <span className="text-xs text-amber-800 dark:text-amber-200">
            Tutte le risposte sono ottime, anche brevi. Almeno una serve compilata.
          </span>
        </div>
      </form>
    </section>
  );
}
