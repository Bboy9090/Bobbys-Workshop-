import { useState } from 'react';
import { buildFirehoseWritePlan, type FirehoseWritePlan } from '../lib/desktop';

function toNumber(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const parsed = text.toLowerCase().startsWith('0x')
    ? Number.parseInt(text.slice(2), 16)
    : Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function FirehoseDryRun() {
  const [imageBytes, setImageBytes] = useState('0');
  const [startSector, setStartSector] = useState('0');
  const [physicalPartition, setPhysicalPartition] = useState('0');
  const [sectorSize, setSectorSize] = useState('512');
  const [chunkSize, setChunkSize] = useState(String(1024 * 1024));
  const [boundStart, setBoundStart] = useState('');
  const [boundCount, setBoundCount] = useState('');
  const [plan, setPlan] = useState<FirehoseWritePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runPlan = async () => {
    setError(null);
    setPlan(null);
    const image = toNumber(imageBytes);
    const start = toNumber(startSector);
    const physical = toNumber(physicalPartition);
    const sector = toNumber(sectorSize);
    const chunk = toNumber(chunkSize);
    const pStart = toNumber(boundStart);
    const pCount = toNumber(boundCount);

    if ([image, start, physical, sector, chunk].some((v) => v == null)) {
      setError('Enter valid numeric values. Hex with 0x prefix is supported.');
      return;
    }

    setBusy(true);
    try {
      setPlan(await buildFirehoseWritePlan({
        imageBytes: image as number,
        startSector: start as number,
        physicalPartition: physical as number,
        sectorSize: sector as number,
        chunkSize: chunk as number,
        partitionStartSector: pStart,
        partitionSectorCount: pCount,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-4 rounded-xl border border-amber-900/70 bg-amber-950/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-400">
            Firehose Dry Run
          </div>
          <h2 className="mt-1 text-sm font-semibold text-white">Validate sector math before transport opens</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
            Pure planning only. This calculates sector count, padding, target range, chunk boundaries, and partition-bound compliance.
            It cannot upload a programmer or write flash.
          </p>
        </div>
        <span className="rounded border border-amber-900 bg-amber-950/30 px-2 py-1 text-[10px] font-semibold text-amber-300">
          executor disabled
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Image bytes', imageBytes, setImageBytes],
          ['Start sector', startSector, setStartSector],
          ['Physical partition', physicalPartition, setPhysicalPartition],
          ['Sector size', sectorSize, setSectorSize],
          ['Chunk size', chunkSize, setChunkSize],
          ['Verified bound start', boundStart, setBoundStart],
          ['Verified bound sectors', boundCount, setBoundCount],
        ].map(([label, value, setter]) => (
          <label key={label as string} className="text-xs text-slate-500">
            {label as string}
            <input
              value={value as string}
              onChange={(event) => (setter as (value: string) => void)(event.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
            />
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void runPlan()}
        disabled={busy}
        className="mt-3 rounded bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-amber-600"
      >
        {busy ? 'Calculating…' : 'Build dry-run plan'}
      </button>

      {error && (
        <div className="mt-3 rounded border border-red-900 bg-red-950/20 p-3 text-xs text-red-300">{error}</div>
      )}

      {plan && (
        <div className="mt-4 rounded border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-xs text-white">
              sectors {plan.startSector}..{plan.endSectorExclusive} · {plan.chunks.length} chunk(s)
            </div>
            <span className={plan.allowed ? 'text-xs text-emerald-300' : 'text-xs text-red-300'}>
              {plan.allowed ? 'plan valid' : 'plan blocked'}
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-slate-800 p-2 text-xs">
              <div className="text-slate-600">Partition sectors</div>
              <div className="mt-1 font-mono text-slate-300">{plan.numPartitionSectors}</div>
            </div>
            <div className="rounded border border-slate-800 p-2 text-xs">
              <div className="text-slate-600">Padded bytes</div>
              <div className="mt-1 font-mono text-slate-300">{plan.paddedBytes}</div>
            </div>
            <div className="rounded border border-slate-800 p-2 text-xs">
              <div className="text-slate-600">Chunk size</div>
              <div className="mt-1 font-mono text-slate-300">{plan.chunkSize}</div>
            </div>
            <div className="rounded border border-slate-800 p-2 text-xs">
              <div className="text-slate-600">Executor</div>
              <div className="mt-1 font-mono text-amber-300">{plan.executorQualified ? 'qualified' : 'disabled'}</div>
            </div>
          </div>

          {plan.reasons.length > 0 && (
            <div className="mt-3 rounded border border-red-900 bg-red-950/20 p-3 text-xs text-red-300">
              {plan.reasons.join(' · ')}
            </div>
          )}
          {plan.warnings.length > 0 && (
            <div className="mt-3 rounded border border-amber-900 bg-amber-950/20 p-3 text-xs text-amber-300">
              {plan.warnings.join(' · ')}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
