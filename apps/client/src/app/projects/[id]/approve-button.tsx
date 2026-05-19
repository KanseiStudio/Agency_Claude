'use client';

// Bottone "Approva tutto e procedi al pagamento".
// Mostrato sopra la lista dei deliverable quando il cliente non vuole
// chiedere revisioni. Genera l'Invoice e fa apparire il bottone "Paga".

import { useState, useTransition } from 'react';
import { approveAndProceedAction } from './approve-actions';

export function ApproveAndProceedButton({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await approveAndProceedAction(projectId);
      if (!res.ok) setError(res.error);
      setConfirmOpen(false);
    });
  }

  if (confirmOpen) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-950/40">
        <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
          Confermi l&apos;approvazione?
        </p>
        <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
          Accetti i deliverable così come sono, senza richiedere revisioni.
          Verrà emessa subito la fattura e potrai procedere al pagamento.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleConfirm}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {isPending ? 'Conferma in corso…' : 'Sì, approva e procedi'}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmOpen(false)}
            className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900"
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
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
      >
        Approva tutto e procedi al pagamento
      </button>
      <p className="text-[11px] text-zinc-500">
        Click se i deliverable vanno bene così — niente revisioni necessarie.
      </p>
      {error ? (
        <p className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
