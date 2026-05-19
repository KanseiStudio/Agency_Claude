'use client';

// Pannello "Invia email cliente": dropdown coi tipi disponibili + campo
// note opzionali per kind=custom + bottone Invia.

import { useState, useTransition } from 'react';
import { composeAndSendEmailAction } from './actions';

const EMAIL_KINDS: Array<{ value: string; label: string }> = [
  { value: 'quote_sent', label: 'Preventivo inviato' },
  { value: 'quote_reminder', label: 'Reminder preventivo' },
  { value: 'production_started', label: 'Produzione avviata' },
  { value: 'deliverables_ready', label: 'Deliverable pronti' },
  { value: 'revision_completed', label: 'Round revisione chiuso' },
  { value: 'invoice_issued', label: 'Fattura emessa' },
  { value: 'payment_confirmed', label: 'Pagamento ricevuto' },
  { value: 'payment_reminder', label: 'Reminder pagamento' },
  { value: 'project_completed', label: 'Progetto chiuso' },
  { value: 'custom', label: 'Email custom (con note libere)' },
];

export function ComposeEmailButton({ projectId }: { projectId: string }) {
  const [kind, setKind] = useState<string>('deliverables_ready');
  const [notes, setNotes] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSend() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await composeAndSendEmailAction(
        projectId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kind as any,
        kind === 'custom' && notes ? notes : undefined,
      );
      if (res.ok) {
        setSuccess(true);
        setNotes('');
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Invia email cliente
        </h3>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Tipo email
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {EMAIL_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      {kind === 'custom' ? (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Note specifiche (verranno usate come corpo della mail)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Scrivi cosa vuoi che l'agente includa nel corpo della mail..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          ✓ Email inviata (o accodata in mock mode). Controlla il log sotto.
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSend}
        disabled={isPending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? 'Invio in corso…' : 'Genera e invia email'}
      </button>
    </div>
  );
}
