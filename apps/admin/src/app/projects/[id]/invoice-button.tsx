'use client';

import { useState, useTransition } from 'react';
import { createInvoiceAction } from './actions';

export function CreateInvoiceButton({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await createInvoiceAction(projectId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? 'Creazione…' : 'Crea fattura per il cliente'}
      </button>
      {error ? (
        <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
