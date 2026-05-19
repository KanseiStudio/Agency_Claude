'use client';

import { useState, useTransition } from 'react';
import { requestRevisionAction } from './revision-actions';

export function RevisionForm({
  projectId,
  deliverableId,
  deliverableTitle,
}: {
  projectId: string;
  deliverableId: string;
  deliverableTitle: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ roundNumber: number; isPaid: boolean } | null>(null);

  function handleSubmit() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await requestRevisionAction(projectId, deliverableId, text);
      if (result.ok) {
        setSuccess({ roundNumber: result.roundNumber, isPaid: result.isPaid });
        setText('');
        setIsOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (success && !isOpen) {
    return (
      <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        Revisione richiesta · round {success.roundNumber}
        {success.isPaid ? ' (a pagamento)' : ' (gratuito)'}.
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setSuccess(null);
        }}
        className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
      >
        Richiedi revisione →
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
      <label className="block text-xs font-medium text-amber-900 dark:text-amber-100">
        Modifica richiesta per &ldquo;{deliverableTitle}&rdquo;
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Es: la palette è troppo desaturata, vorremmo accenti più caldi. Il claim dovrebbe essere più assertivo."
        className="w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-amber-900 dark:bg-zinc-900 dark:text-zinc-50"
      />
      {error ? (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {isPending ? 'Invio…' : 'Invia richiesta'}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setText('');
            setError(null);
          }}
          className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-900 dark:bg-zinc-900 dark:text-amber-100"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
