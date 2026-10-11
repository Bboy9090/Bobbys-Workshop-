import { useMemo, useState } from 'react';
import {
  writeFirmwareProvenance,
  type FirmwareBundleSummary,
  type FirmwareProvenanceWriteResult,
} from '../lib/desktop';

type Props = {
  bundles: FirmwareBundleSummary[];
  onWritten: () => Promise<void> | void;
};

export default function FirmwareProvenanceBuilder({ bundles, onWritten }: Props) {
  const candidates = useMemo(
    () => bundles.filter((bundle) => !bundle.blocked && ['qualcomm', 'mediatek'].includes(bundle.vendorHint)),
    [bundles],
  );
  const [directory, setDirectory] = useState('');
  const [oem, setOem] = useState('');
  const [model, setModel] = useState('');
  const [board, setBoard] = useState('');
  const [sku, setSku] = useState('');
  const [region, setRegion] = useState('');
  const [carrier, setCarrier] = useState('');
  const [buildVersion, setBuildVersion] = useState('');
  const [bootloaderRevision, setBootloaderRevision] = useState('');
  const [storage, setStorage] = useState('');
  const [sourceCategory, setSourceCategory] = useState<'official-oem' | 'authorized-service'>('official-oem');
  const [sourceReference, setSourceReference] = useState('');
  const [chipsetFamily, setChipsetFamily] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FirmwareProvenanceWriteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => candidates.find((bundle) => bundle.directory === directory) || null,
    [candidates, directory],
  );

  const chooseBundle = (nextDirectory: string) => {
    setDirectory(nextDirectory);
    setResult(null);
    setError(null);
    const bundle = candidates.find((candidate) => candidate.directory === nextDirectory);
    if (!bundle) return;
    const firstChipset = bundle.chipsetMatches.find((value) => value.startsWith(bundle.vendorHint + ':'));
    setChipsetFamily(firstChipset?.split(':')[1] || '');
    setStorage('');
  };

  const canWrite = Boolean(
    selected &&
    chipsetFamily.trim() &&
    oem.trim() &&
    model.trim() &&
    board.trim() &&
    sku.trim() &&
    buildVersion.trim() &&
    sourceReference.trim(),
  );

  const writeManifest = async () => {
    if (!selected || !canWrite || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const written = await writeFirmwareProvenance({
        directory: selected.directory,
        vendor: selected.vendorHint,
        chipsetFamily: chipsetFamily.trim(),
        oem: oem.trim(),
        model: model.trim(),
        board: board.trim(),
        sku: sku.trim(),
        region: region.trim() || null,
        carrier: carrier.trim() || null,
        buildVersion: buildVersion.trim(),
        bootloaderRevision: bootloaderRevision.trim() || null,
        storage: storage.trim() || null,
        sourceCategory,
        sourceReference: sourceReference.trim(),
      });
      setResult(written);
      await onWritten();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded border border-fuchsia-900/50 bg-fuchsia-950/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-400">Package provenance builder</div>
          <div className="mt-1 text-sm font-semibold text-white">Bind an exact firmware package without hand-writing JSON</div>
          <div className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
            You provide the identity and source facts. BobFWTools hashes every planning-relevant file in the selected package directory and writes the local provenance manifest for you.
          </div>
        </div>
        <div className="rounded border border-slate-800 bg-black/20 px-3 py-2 text-[10px] text-slate-500">
          {candidates.length} package director{candidates.length === 1 ? 'y' : 'ies'} available
        </div>
      </div>

      <div className="mt-3 rounded border border-fuchsia-900/40 bg-fuchsia-950/20 p-3 text-[11px] leading-5 text-fuchsia-100">
        <div className="font-semibold">Walkthrough</div>
        <div className="mt-1 text-fuchsia-200/80">
          1. Select one package directory. 2. Confirm the chipset. 3. Enter OEM, exact model, board, and SKU from authoritative device/package records.
          4. Enter the build and package source. 5. Create the manifest. 6. BobFWTools rescans automatically. 7. Continue only when the package card shows provenance present, hashes verified, and model/board/SKU bound.
        </div>
      </div>

      <label className="mt-3 block text-xs text-slate-500">
        Package directory
        <select
          value={directory}
          onChange={(event) => chooseBundle(event.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
        >
          <option value="">Select a scanned package</option>
          {candidates.map((bundle) => (
            <option key={bundle.directory} value={bundle.directory}>
              {bundle.directory} · {bundle.vendorHint} · {bundle.planningReady ? 'ready' : 'needs provenance/verification'}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-slate-500">
              Chipset family
              <input value={chipsetFamily} onChange={(e) => setChipsetFamily(e.target.value)} placeholder="SM8550 / MT6989" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
            <label className="text-xs text-slate-500">
              OEM
              <input value={oem} onChange={(e) => setOem(e.target.value)} placeholder="Manufacturer" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
            <label className="text-xs text-slate-500">
              Exact model
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Commercial/model code" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
            <label className="text-xs text-slate-500">
              Board
              <input value={board} onChange={(e) => setBoard(e.target.value)} placeholder="Board ID / hardware family" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
            <label className="text-xs text-slate-500">
              SKU / variant
              <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Region/carrier SKU" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
            <label className="text-xs text-slate-500">
              Build version
              <input value={buildVersion} onChange={(e) => setBuildVersion(e.target.value)} placeholder="Exact firmware build" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
            <label className="text-xs text-slate-500">
              Region
              <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
            <label className="text-xs text-slate-500">
              Carrier
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Optional / unlocked" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
            <label className="text-xs text-slate-500">
              Bootloader revision
              <input value={bootloaderRevision} onChange={(e) => setBootloaderRevision(e.target.value)} placeholder="Optional but recommended" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
            <label className="text-xs text-slate-500">
              Storage
              <input value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="eMMC / UFS generation" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
            <label className="text-xs text-slate-500">
              Source category
              <select value={sourceCategory} onChange={(e) => setSourceCategory(e.target.value as 'official-oem' | 'authorized-service')} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
                <option value="official-oem">Official OEM</option>
                <option value="authorized-service">Authorized service</option>
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Source reference
              <input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="Package ID, portal record, service reference" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            </label>
          </div>

          <div className="mt-3 rounded border border-amber-900/50 bg-amber-950/20 p-3 text-[11px] leading-5 text-amber-200">
            Stop if you cannot prove the exact model/board/SKU or package source. Do not guess these fields from chipset alone and do not copy identity from another phone variant.
          </div>

          <button
            type="button"
            onClick={() => void writeManifest()}
            disabled={busy || !canWrite}
            className="mt-3 rounded bg-fuchsia-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-fuchsia-600"
          >
            {busy ? 'Hashing package + writing manifest…' : 'Create exact provenance manifest'}
          </button>
        </>
      )}

      {result && (
        <div className="mt-3 rounded border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-300">
          <div className="font-semibold">Provenance manifest created and package rescanned</div>
          <div className="mt-1">{result.artifactsBound} planning-relevant artifact(s) hash-bound.</div>
          <div className="mt-1 break-all font-mono text-[10px] text-emerald-300/80">{result.path}</div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-300">
          <div className="font-semibold">Manifest creation blocked</div>
          <div className="mt-1">{error}</div>
          <div className="mt-2 text-[11px] leading-5 text-red-200/80">
            Correct the package identity/source conflict or package contents and retry. Do not edit hashes or switch to unrelated firmware to make the manifest pass.
          </div>
        </div>
      )}
    </div>
  );
}
