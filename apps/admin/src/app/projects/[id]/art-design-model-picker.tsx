'use client';

// Pannello "Genera asset" per Art & Design.
//
// Per scelta architetturale, NON c'è più un picker di modelli: il workflow
// è fissato:
//   - asset_type = "image"  → openai-gpt-image-2 (1 chiamata)
//   - asset_type = "video"  → openai-gpt-image-2 per ogni keyframe + seedance-2 per la composizione
//
// Mostra info workflow + bottone unico "Genera" + progress feedback
// (timer trascorso + bar animata) durante l'attesa, perché la generazione
// può durare da 30s (image) a ~3 minuti (video con 4 keyframe + composizione).

import { useState, useTransition, useEffect, useRef } from 'react';
import { generateArtDesignAssetAction } from './actions';

const IMAGE_MODEL_ID = 'openai-gpt-image-2';
const VIDEO_MODEL_ID = 'seedance-2';

interface Props {
  projectId: string;
  assetType: 'image' | 'video';
  /** Numero di keyframe attesi per asset video (per UI hint sul tempo). */
  keyframeCount?: number;
  /** Indicazione se già stato generato (per cambiare label bottone). */
  alreadyGenerated?: boolean;
}

export function ArtDesignGenerateButton({
  projectId,
  assetType,
  keyframeCount,
  alreadyGenerated,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer trascorso durante la generazione.
  useEffect(() => {
    if (isPending) {
      const start = Date.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - start);
      }, 250);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPending]);

  function handleGenerate() {
    setError(null);
    const modelId = assetType === 'image' ? IMAGE_MODEL_ID : VIDEO_MODEL_ID;
    startTransition(async () => {
      const res = await generateArtDesignAssetAction(projectId, modelId);
      if (!res.ok) setError(res.error);
    });
  }

  // Stima ETA basata su asset_type per dare contesto al timer.
  const etaSeconds =
    assetType === 'image' ? 15 : 30 + (keyframeCount ?? 4) * 15;

  return (
    <div className="space-y-3">
      {/* Info workflow: chi fa cosa */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Workflow di generazione
        </p>
        {assetType === 'image' ? (
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="rounded-full bg-sky-100 px-2 py-0.5 font-mono text-[10px] uppercase text-sky-800 dark:bg-sky-900 dark:text-sky-100">
              IMAGE
            </span>{' '}
            <strong>OpenAI GPT-Image 2</strong> · 1 chiamata diretta, durata
            tipica ~10-20s
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="rounded-full bg-violet-100 px-2 py-0.5 font-mono text-[10px] uppercase text-violet-800 dark:bg-violet-900 dark:text-violet-100">
              VIDEO
            </span>{' '}
            <strong>OpenAI GPT-Image 2</strong> per ogni keyframe
            {keyframeCount ? ` (${keyframeCount} keyframe)` : ''} →{' '}
            <strong>Seedance 2.0</strong> per la composizione · durata tipica ~
            {Math.round(etaSeconds / 60)} minuti
          </p>
        )}
      </div>

      {/* Errore */}
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      {/* Stato in-progress con timer + bar animata */}
      {isPending ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/40">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
              Generazione in corso…
            </p>
            <p className="font-mono text-xs text-rose-700 dark:text-rose-300">
              {formatElapsed(elapsedMs)} / ~{formatSeconds(etaSeconds)}
            </p>
          </div>
          <ProgressBar elapsedMs={elapsedMs} etaMs={etaSeconds * 1000} />
          <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-300">
            {assetType === 'video'
              ? "Generazione keyframe in corso, poi composizione video con Seedance."
              : 'GPT-Image 2 sta generando.'}{' '}
            Non chiudere la pagina.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleGenerate}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
        >
          {alreadyGenerated ? 'Rigenera asset' : 'Genera asset'}
        </button>
      )}
    </div>
  );
}

/**
 * Barra animata: width proporzionale a elapsed/eta ma cap a 95% finché non
 * arriva la risposta server (così non sembra "finita" prematuramente).
 */
function ProgressBar({ elapsedMs, etaMs }: { elapsedMs: number; etaMs: number }) {
  const ratio = Math.min(0.95, elapsedMs / etaMs);
  const pct = Math.round(ratio * 100);
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-rose-200 dark:bg-rose-900">
      <div
        className="h-full bg-rose-600 transition-all duration-300 ease-linear dark:bg-rose-400"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m${String(s).padStart(2, '0')}s`;
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${s}s`;
  return `${m}m${r ? String(r).padStart(2, '0') + 's' : ''}`;
}
