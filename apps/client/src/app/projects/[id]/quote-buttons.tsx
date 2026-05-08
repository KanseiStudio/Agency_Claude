'use client';

import { useState, useTransition } from 'react';
import { acceptQuoteAction, rejectQuoteAction } from './quote-actions';

export function QuoteDecisionButtons({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptQuoteAction(projectId);
      if (!result.ok) setError(result.error);
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectQuoteAction(projectId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleAccept}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {isPending ? '…' : 'Accetta preventivo'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleReject}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950"
        >
          Rifiuta
        </button>
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
