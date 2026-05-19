'use client';

import { useState, useTransition } from 'react';
import { payProjectAction } from './payment-actions';

export function PayButton({
  projectId,
  importoEur,
  mockMode,
}: {
  projectId: string;
  importoEur: number;
  /** True se siamo in MOCK_PAYMENTS mode (mostra disclaimer). */
  mockMode: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await payProjectAction(projectId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Stripe path: il server ritorna un URL Checkout, ridirigiamo il browser
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
      // Mock path: niente redirect, la pagina si aggiorna via revalidatePath
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="w-full rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {isPending
          ? mockMode
            ? 'Pagamento simulato in corso…'
            : 'Reindirizzamento a Stripe…'
          : `Paga € ${importoEur.toLocaleString('it-IT')} e sblocca i download`}
      </button>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}
      <p className="text-[10px] text-zinc-500">
        {mockMode
          ? 'Pagamento simulato in dev (MOCK_PAYMENTS=true). Aggiungi STRIPE_SECRET_KEY in .env per Stripe reale.'
          : 'Verrai reindirizzato a Stripe per completare il pagamento in sicurezza.'}
      </p>
    </div>
  );
}
