import { useEffect, useMemo, useState } from 'react';
import {
  backupCalibrationPartition,
  chooseCalibrationBackupDestination,
  chooseEdlProgrammer,
  enrollEdlProgrammer,
  getCalibrationPartitionAllowlist,
  inspectEdlProgrammer,
  listEdlProgrammers,
  scanAdbDevices,
  type AdbDeviceRecord,
  type CalibrationBackupResult,
  type EdlProgrammerRecord,
} from '../lib/desktop';

function shortHash(value: string): string {
  if (!value) return '';
  return value.length > 18 ? value.slice(0, 10) + '…' + value.slice(-8) : value;
}

export default function RecoverySafetyTools() {
  const [adbDevices, setAdbDevices] = useState<AdbDeviceRecord[]>([]);
  const [partitions, setPartitions] = useState<string[]>([]);
  const [selectedSerial, setSelectedSerial] = useState('');
  const [selectedPartition, setSelectedPartition] = useState('efs');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupResult, setBackupResult] = useState<CalibrationBackupResult | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [programmers, setProgrammers] = useState<EdlProgrammerRecord[]>([]);
  const [candidate, setCandidate] = useState<EdlProgrammerRecord | null>(null);
  const [deviceFamily, setDeviceFamily] = useState('');
  const [authorizationSource, setAuthorizationSource] = useState('');
  const [confirmAuthorization, setConfirmAuthorization] = useState(false);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  const authorizedAdb = useMemo(() => adbDevices.filter((device) => device.authorized), [adbDevices]);

  const refresh = async () => {
    try {
      const [adb, allowed, vault] = await Promise.all([
        scanAdbDevices(),
        getCalibrationPartitionAllowlist(),
        listEdlProgrammers(),
      ]);
      setAdbDevices(adb);
      setPartitions(allowed);
      setProgrammers(vault);
      if (!selectedSerial && adb.some((device) => device.authorized)) {
        setSelectedSerial(adb.find((device) => device.authorized)?.serial || '');
      }
      if (!allowed.includes(selectedPartition) && allowed.length) {
        setSelectedPartition(allowed[0]);
      }
    } catch {
      // Individual actions surface detailed errors.
    }
  };

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  });

  const runBackup = async () => {
    setBackupError(null);
    setBackupResult(null);
    if (!selectedSerial || !selectedPartition) {
      setBackupError('Select an authorized ADB device and an allowlisted calibration partition.');
      return;
    }
    const destination = await chooseCalibrationBackupDestination();
    if (!destination) return;

    setBackupBusy(true);
    try {
      const result = await backupCalibrationPartition(selectedSerial, selectedPartition, destination);
      setBackupResult(result);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : String(err));
    } finally {
      setBackupBusy(false);
    }
  };

  const inspectProgrammer = async () => {
    setVaultError(null);
    setCandidate(null);
    const path = await chooseEdlProgrammer();
    if (!path) return;

    setVaultBusy(true);
    try {
      setCandidate(await inspectEdlProgrammer(path, deviceFamily || null));
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : String(err));
    } finally {
      setVaultBusy(false);
    }
  };

  const enrollProgrammer = async () => {
    if (!candidate) return;
    setVaultError(null);
    if (!confirmAuthorization) {
      setVaultError('Confirm that this programmer comes from an OEM or authorized service source.');
      return;
    }
    if (authorizationSource.trim().length < 3) {
      setVaultError('Enter the OEM/service authorization source.');
      return;
    }

    setVaultBusy(true);
    try {
      const enrolled = await enrollEdlProgrammer(candidate, authorizationSource.trim());
      setCandidate(enrolled);
      setProgrammers(await listEdlProgrammers());
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : String(err));
    } finally {
      setVaultBusy(false);
    }
  };

  return (
    <section className="mb-4 grid gap-4 xl:grid-cols-2">
      <div className="rounded-xl border border-cyan-900/70 bg-cyan-950/10 p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-500">
          Calibration Shield
        </div>
        <h2 className="mt-1 text-sm font-semibold text-white">Verified EFS / modem calibration backup</h2>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Read-only backup only. BobFWTools resolves the allowlisted block path, reads the exact partition size,
          streams the partition directly to the workstation, verifies the byte count, and writes a SHA-256 manifest.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-500">
            Authorized ADB device
            <select
              value={selectedSerial}
              onChange={(event) => setSelectedSerial(event.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="">Select device</option>
              {authorizedAdb.map((device) => (
                <option key={device.serial} value={device.serial}>{device.serial}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-500">
            Calibration partition
            <select
              value={selectedPartition}
              onChange={(event) => setSelectedPartition(event.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              {partitions.map((partition) => (
                <option key={partition} value={partition}>{partition}</option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() => void runBackup()}
          disabled={backupBusy || !selectedSerial || !selectedPartition}
          className="mt-3 rounded bg-cyan-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-cyan-600"
        >
          {backupBusy ? 'Backing up and verifying…' : 'Create verified backup'}
        </button>

        {backupError && (
          <div className="mt-3 rounded border border-red-900 bg-red-950/20 p-3 text-xs text-red-300">{backupError}</div>
        )}

        {backupResult && (
          <div className="mt-3 rounded border border-emerald-900 bg-emerald-950/20 p-3">
            <div className="text-xs font-semibold text-emerald-300">Verified backup complete</div>
            <div className="mt-2 space-y-1 font-mono text-[10px] text-slate-400">
              <div>partition: {backupResult.partition}</div>
              <div>bytes: {backupResult.actualBytes}</div>
              <div>sha256: {backupResult.sha256}</div>
              <div className="break-all">image: {backupResult.backupPath}</div>
              <div className="break-all">manifest: {backupResult.manifestPath}</div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-violet-900/70 bg-violet-950/10 p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-400">
          EDL Programmer Vault
        </div>
        <h2 className="mt-1 text-sm font-semibold text-white">Hash-enrolled OEM/service programmers</h2>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Inspect .elf/.mbn programmers, record their SHA-256 and size, and explicitly enroll only files from
          an authorized OEM/service source. A changed or missing file automatically loses authorization.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-500">
            Device family
            <input
              value={deviceFamily}
              onChange={(event) => setDeviceFamily(event.target.value)}
              placeholder="e.g. SM6115 / vendor family"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void inspectProgrammer()}
              disabled={vaultBusy}
              className="w-full rounded bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-violet-600"
            >
              {vaultBusy ? 'Inspecting…' : 'Inspect programmer'}
            </button>
          </div>
        </div>

        {candidate && (
          <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-3">
            <div className="font-mono text-xs text-white">{candidate.path.split(/[\\/]/).pop()}</div>
            <div className="mt-1 text-[10px] text-slate-500">{candidate.bytes} bytes · {shortHash(candidate.sha256)}</div>

            {!candidate.authorized && (
              <>
                <input
                  value={authorizationSource}
                  onChange={(event) => setAuthorizationSource(event.target.value)}
                  placeholder="OEM/service authorization source"
                  className="mt-3 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
                <label className="mt-3 flex items-start gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={confirmAuthorization}
                    onChange={(event) => setConfirmAuthorization(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>I confirm this loader was obtained through an OEM or authorized service source.</span>
                </label>
                <button
                  type="button"
                  onClick={() => void enrollProgrammer()}
                  disabled={vaultBusy || !confirmAuthorization}
                  className="mt-3 rounded border border-violet-700 px-3 py-2 text-xs font-semibold text-violet-200 disabled:opacity-40 hover:bg-violet-950/40"
                >
                  Enroll authorized hash
                </button>
              </>
            )}

            {candidate.authorized && (
              <div className="mt-3 rounded bg-emerald-950/30 p-2 text-xs text-emerald-300">
                Authorized programmer hash enrolled.
              </div>
            )}
          </div>
        )}

        {vaultError && (
          <div className="mt-3 rounded border border-red-900 bg-red-950/20 p-3 text-xs text-red-300">{vaultError}</div>
        )}

        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Enrolled programmers</div>
          <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
            {programmers.length === 0 ? (
              <div className="text-xs text-slate-600">No authorized programmer hashes enrolled.</div>
            ) : programmers.map((record) => (
              <div key={record.sha256} className="rounded border border-slate-800 bg-slate-950/60 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px] text-slate-300" title={record.path}>
                    {record.path.split(/[\\/]/).pop()}
                  </span>
                  <span className={record.authorized ? 'text-[10px] text-emerald-400' : 'text-[10px] text-red-400'}>
                    {record.authorized ? 'authorized' : 'suspended'}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-slate-600">{shortHash(record.sha256)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
