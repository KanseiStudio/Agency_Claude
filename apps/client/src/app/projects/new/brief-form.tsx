'use client';

import { useState, useTransition } from 'react';
import { DELIVERABLE_TYPES, type DeliverableType } from '@kansei/shared';
import { createProjectAction } from './actions';

const DELIVERABLE_LABELS: Record<DeliverableType, string> = {
  logo: 'Logo / brand identity',
  image_pack: 'Pacchetto immagini',
  video_reel: 'Video / Reel',
  social_plan: 'Piano editoriale social',
  newsletter: 'Newsletter',
  landing_page: 'Landing page',
  press_release: 'Comunicato stampa',
  altro: 'Altro',
};

export function BriefForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function onSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await createProjectAction(formData);
      if (!result.ok) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      }
      // Caso ok: il server action fa già il redirect, non torniamo qui.
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <Field
        label="Titolo del progetto"
        name="titolo"
        type="text"
        required
        error={fieldErrors.titolo}
        placeholder="Es: Rebranding ristorante 'Il Tavolo'"
      />

      <div>
        <label
          htmlFor="descrizione"
          className="block text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Descrizione del lavoro <span className="text-red-500">*</span>
        </label>
        <textarea
          id="descrizione"
          name="descrizione"
          required
          rows={6}
          placeholder="Spiega obiettivi, tono, vincoli, riferimenti che ti piacciono…"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {fieldErrors.descrizione ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.descrizione}</p>
        ) : null}
      </div>

      <fieldset>
        <legend className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Deliverable richiesti <span className="text-red-500">*</span>
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DELIVERABLE_TYPES.map((d) => (
            <label
              key={d}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500"
            >
              <input
                type="checkbox"
                name="deliverableRichiesti"
                value={d}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              {DELIVERABLE_LABELS[d]}
            </label>
          ))}
        </div>
        {fieldErrors.deliverableRichiesti ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {fieldErrors.deliverableRichiesti}
          </p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Deadline (opzionale)"
          name="deadline"
          type="date"
          error={fieldErrors.deadline}
        />
        <Field
          label="Budget indicativo €"
          name="budgetIndicativoEur"
          type="number"
          error={fieldErrors.budgetIndicativoEur}
          placeholder="Es: 1500"
          min={0}
          step="50"
        />
      </div>

      <div>
        <label
          htmlFor="file"
          className="block text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          File di reference (opzionale, max 25 MB)
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.svg,.zip,.txt"
          className="mt-1 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white file:hover:bg-zinc-800 dark:text-zinc-300 dark:file:bg-zinc-50 dark:file:text-zinc-900"
        />
        <p className="mt-1 text-xs text-zinc-500">
          PDF, immagini, ZIP. Inserisci moodboard, foto del brand attuale, esempi di riferimento.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? 'Invio in corso…' : 'Invia brief'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  required,
  placeholder,
  error,
  min,
  step,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  min?: number;
  step?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-medium uppercase tracking-wide text-zinc-500"
      >
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        min={min}
        step={step}
        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
