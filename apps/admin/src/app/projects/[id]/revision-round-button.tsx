'use client';

import { useState, useTransition } from 'react';
import { markRevisionRoundCompletedAction } from './actions';

export function MarkRoundCompletedButton({ roundId }: { roundId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await markRevisionRoundCompletedAction(roundId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
      >
        {isPending ? '…' : 'Marca round come completato'}
      </button>
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
