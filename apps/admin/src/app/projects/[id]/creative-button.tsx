'use client';

import { useState, useTransition } from 'react';
import { runCreativeLeadAction } from './actions';

export function CreativeLeadButton({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await runCreativeLeadAction(projectId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-fuchsia-700 disabled:opacity-60"
      >
        {isPending ? 'Creative Lead al lavoro…' : 'Esegui Creative Lead'}
      </button>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
