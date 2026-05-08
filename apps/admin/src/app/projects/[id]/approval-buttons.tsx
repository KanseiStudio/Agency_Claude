'use client';

import { useState, useTransition } from 'react';
import { approveBriefAction, rejectBriefAction } from './actions';

export function ApprovalButtons({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await approveBriefAction(projectId);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      try {
        await rejectBriefAction(projectId, note);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleApprove}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {isPending ? '…' : 'Approva brief'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setShowRejectForm((v) => !v)}
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950"
        >
          Rifiuta
        </button>
      </div>

      {showRejectForm ? (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
          <label
            htmlFor="reject-note"
            className="block text-xs font-medium text-red-900 dark:text-red-100"
          >
            Motivo del rifiuto (opzionale, visibile al cliente in futuro)
          </label>
          <textarea
            id="reject-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-red-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-red-900 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={handleReject}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isPending ? '…' : 'Conferma rifiuto'}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
