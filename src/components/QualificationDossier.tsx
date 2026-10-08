import { useEffect, useMemo, useState } from 'react';
import {
  exportQualificationDossier,
  getWorkstationReadiness,
  listEdlProgrammers,
  scanTransportDevices,
  type EdlProgrammerRecord,
  type TransportDevice,
  type WorkstationReadiness,
} from '../lib/desktop';

export default function QualificationDossier() {
  const [devices, setDevices] = useState<TransportDevice[]>([]);
  const [workstation, setWorkstation] = useState<WorkstationReadiness | null>(null);
  const [programmers, setProgrammers] = useState<EdlProgrammerRecord[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => devices.find((device) => device.deviceUid === selectedUid) || null,
    [devices, selectedUid],
  );
  const authorizedProgrammers = useMemo(
    () => programmers.filter((programmer) => programmer.authorized),
    [programmers],
  );

  const refresh = async () => {
    try {
      const [transport, host, vault] = await Promise.all([
        scanTransportDevices(),
        getWorkstationReadiness(),
        listEdlProgrammers(),
      ]);
      const recovery = transport.filter((device) =>
        ['qualcomm-edl', 'mediatek-brom', 'mediatek-preloader', 'samsung-download'].includes(device.mode),
      );
      setDevices(recovery);
      setWorkstation(host);
      setProgrammers(vault);
      if (!selectedUid && recovery.length) setSelectedUid(recovery[0].deviceUid);
      if (selectedUid && !recovery.some((device) => device.deviceUid === selectedUid)) {
        setSelectedUid(recovery[0]?.deviceUid || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [selectedUid]);

  const exportDossier = async () => {
    if (!selected || !workstation) return;
    setBusy(true);
    setError(null);
    setSavedPath(null);
    try {
      const path = await exportQualificationDossier({
        device: selected,
        workstation,
        authorizedProgrammers,
        operatorNotes: notes.trim(),
      });
      if (path) setSavedPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-4 rounded-xl border border-amber-900/70 bg-amber-950/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-400">
            Designated-Device Qualification Dossier
          </div>
          <h2 className="mt-1 text-sm font-semibold text-white">Bench evidence before executor qualification</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
            Captures live USB identity, endpoint evidence, workstation readiness, and authorized programmer records.
            Exporting this dossier never enables a writer and never marks an executor physically qualified.
          </p>
        </div>
        <span className="rounded border border-amber-900 bg-amber-950/40 px-2 py-1 text-xs text-amber-300">
          qualification pending
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-950/60 p-4">
          <label className="text-xs text-slate-500">
            Recovery-mode device
            <select
              value={selectedUid}
              onChange={(event) => setSelectedUid(event.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="">Select device</option>
              {devices.map((device) => (
                <option key={device.deviceUid} value={device.deviceUid}>
                  {device.productName || device.mode} · {device.mode}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <div className="mt-3 space-y-1 font-mono text-[10px] text-slate-400">
              <div>uid: {selected.deviceUid}</div>
              <div>vid:pid: {selected.vendorId.toString(16).padStart(4, '0')}:{selected.productId.toString(16).padStart(4, '0')}</div>
              <div>bus/address: {selected.busNumber}/{selected.deviceAddress}</div>
              <div>bulk-in: {selected.bulkIn.length ? selected.bulkIn.join(', ') : 'none'}</div>
              <div>bulk-out: {selected.bulkOut.length ? selected.bulkOut.join(', ') : 'none'}</div>
              <div>endpoints: {selected.endpoints.length}</div>
            </div>
          ) : (
            <div className="mt-3 text-xs text-slate-500">No supported recovery-mode USB transport is currently visible.</div>
          )}
        </div>

        <div className="rounded border border-slate-800 bg-slate-950/60 p-4">
          <div className="text-[10px] uppercase tracking-wide text-slate-600">Bench readiness</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-slate-800 p-3">
              <div className="text-[10px] text-slate-600">Android service</div>
              <div className={workstation?.readyForAndroidService ? 'mt-1 text-xs text-emerald-300' : 'mt-1 text-xs text-amber-300'}>
                {workstation?.readyForAndroidService ? 'READY' : 'BLOCKED'}
              </div>
            </div>
            <div className="rounded border border-slate-800 p-3">
              <div className="text-[10px] text-slate-600">Authorized programmers</div>
              <div className={authorizedProgrammers.length ? 'mt-1 text-xs text-emerald-300' : 'mt-1 text-xs text-amber-300'}>
                {authorizedProgrammers.length}
              </div>
            </div>
          </div>
          {workstation?.blockers.length ? (
            <div className="mt-3 space-y-1 text-[11px] text-amber-300">
              {workstation.blockers.map((blocker) => <div key={blocker}>{blocker}</div>)}
            </div>
          ) : null}
        </div>
      </div>

      <label className="mt-3 block text-xs text-slate-500">
        Operator notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Cable, hub, bench PSU, device condition, repeated enumeration notes, or other qualification observations."
          className="mt-1 min-h-24 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void exportDossier()}
          disabled={busy || !selected || !workstation}
          className="rounded bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-amber-600"
        >
          {busy ? 'Exporting…' : 'Export qualification dossier'}
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-40 hover:bg-slate-900"
        >
          Refresh evidence
        </button>
      </div>

      {savedPath && (
        <div className="mt-3 rounded border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-300">
          Dossier saved: <span className="font-mono">{savedPath}</span>
        </div>
      )}
      {error && (
        <div className="mt-3 rounded border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-300">{error}</div>
      )}
    </section>
  );
}
