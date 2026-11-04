import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  executePitDryRun,
  type PitProgressEvent,
  type SamsungDownloadProbeReport,
} from '../lib/desktop';

type Props = {
  deviceUid: string;
  disabled?: boolean;
  onResult?: (report: SamsungDownloadProbeReport) => void;
  onError?: (message: string) => void;
};

export default function PitDiagnosticPanel({
  deviceUid,
  disabled = false,
  onResult,
  onError,
}: Props) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('Idle');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SamsungDownloadProbeReport | null>(null);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<PitProgressEvent>('pit-progress', (event) => {
      if (disposed) return;
      setProgress(event.payload.progress);
      setPhase(event.payload.phase);
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
      } else {
        unlisten = cleanup;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const run = async () => {
    if (running || disabled || !deviceUid) return;

    setRunning(true);
    setProgress(0);
    setPhase('Starting PIT diagnostic');
    setResult(null);

    try {
      const report = await executePitDryRun(deviceUid);
      setResult(report);
      onResult?.(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProgress(0);
      setPhase('PIT diagnostic halted');
      onError?.(message);
    } finally {
      setRunning(false);
    }
  };

  const qualified = result?.protocolQualified === true;

  return (
    <div className="mt-3 rounded border border-slate-800 bg-black/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            macOS PIT diagnostic
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{phase}</div>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={disabled || running || !deviceUid}
          className="rounded bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
        >
          {running ? 'Reading PIT…' : 'Run PIT dry run'}
        </button>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded bg-slate-900" aria-label="PIT diagnostic progress">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
      <div className="mt-1 text-right font-mono text-[10px] text-slate-500">{progress}%</div>

      {result && (
        <div
          className={
            qualified
              ? 'mt-3 rounded border border-emerald-900/60 bg-emerald-950/20 p-2'
              : 'mt-3 rounded border border-amber-900/60 bg-amber-950/10 p-2'
          }
        >
          <div className={qualified ? 'text-[11px] font-semibold text-emerald-300' : 'text-[11px] font-semibold text-amber-300'}>
            {qualified ? 'PIT READ QUALIFIED' : 'PIT READ NOT QUALIFIED'}
          </div>
          <div className="mt-1 text-[10px] leading-4 text-slate-400">{result.detail}</div>
        </div>
      )}
    </div>
  );
}
