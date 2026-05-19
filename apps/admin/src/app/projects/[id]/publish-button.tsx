'use client';

import { useState, useTransition } from 'react';
import { publishToClientAction } from './actions';

export function PublishButton({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<number | null>(null);

  function handleClick() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await publishToClientAction(projectId);
      if (result.ok) {
        setSuccess(result.count);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {isPending ? 'Pubblicazione…' : 'Pubblica al cliente'}
      </button>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
      {success !== null ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {success} deliverable pubblicati. Il progetto è ora in revisione cliente.
        </p>
      ) : null}
    </div>
  );
}
