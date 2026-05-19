'use client';

import { useState, useTransition } from 'react';
import { sendClarificationRequestAction } from './actions';

export function SendClarificationButton({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await sendClarificationRequestAction(projectId);
      if (!res.ok) setError(res.error);
      setConfirmOpen(false);
    });
  }

  if (confirmOpen) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Mandare le domande al cliente?
        </p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
          Il progetto va in stato &quot;attesa chiarimenti&quot;: non potrai
          generare il preventivo finché il cliente non risponde. Il cliente
          riceverà un&apos;email con la lista delle domande.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleConfirm}
            className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
          >
            {isPending ? 'Invio…' : 'Sì, manda al cliente'}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmOpen(false)}
            className="rounded-lg border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900"
          >
            Annulla
          </button>
        </div>
        {error ? (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
      >
        Manda le domande al cliente
      </button>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
