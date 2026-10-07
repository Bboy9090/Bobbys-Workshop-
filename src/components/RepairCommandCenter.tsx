import { useEffect, useMemo, useState } from 'react';
import {
  getCalibrationPartitionAllowlist,
  getEdl9008Devices,
  getWorkflowPolicyCatalog,
  scanAdbDevices,
  chooseCalibrationBackupDirectory,
  backupCalibrationPartition,
  type AdbDeviceRecord,
  type CalibrationBackupResult,
  type UsbDeviceRecord,
  type WorkflowPolicy,
  type WorkflowRiskLevel,
} from '../lib/desktop';

function riskClasses(risk: WorkflowRiskLevel): string {
  switch (risk) {
    case 'read-only':
      return 'border-slate-700 bg-slate-950/70 text-slate-300';
    case 'low':
      return 'border-cyan-900 bg-cyan-950/20 text-cyan-300';
    case 'elevated':
      return 'border-amber-900 bg-amber-950/20 text-amber-300';
    case 'destructive':
      return 'border-orange-900 bg-orange-950/20 text-orange-300';
    case 'restricted':
      return 'border-red-900 bg-red-950/20 text-red-300';
  }
}

function Badge({ children, on }: { children: string; on: boolean }) {
  return (
    <span
      className={
        on
          ? 'rounded border border-emerald-900 bg-emerald-950/30 px-2 py-1 text-[10px] text-emerald-300'
          : 'rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] text-slate-600'
      }
    >
      {children}
    </span>
  );
}

export default function RepairCommandCenter() {
  const [catalog, setCatalog] = useState<WorkflowPolicy[]>([]);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [edlDevices, setEdlDevices] = useState<UsbDeviceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adbDevices, setAdbDevices] = useState<AdbDeviceRecord[]>([]);
  const [backupPartition, setBackupPartition] = useState('efs');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupResult, setBackupResult] = useState<CalibrationBackupResult | null>(null);

  const active = useMemo(() => catalog.filter((item) => item.activeInBobfwtools), [catalog]);
  const reserved = useMemo(() => catalog.filter((item) => !item.activeInBobfwtools), [catalog]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [policies, partitions, edl, adb] = await Promise.all([
          getWorkflowPolicyCatalog(),
          getCalibrationPartitionAllowlist(),
          getEdl9008Devices(),
          scanAdbDevices(),
        ]);
        if (cancelled) return;
        setCatalog(policies);
        setAllowlist(partitions);
        setEdlDevices(edl);
        setAdbDevices(adb);
        if (partitions.length && !partitions.includes(backupPartition)) {
          setBackupPartition(partitions[0]);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const runCalibrationBackup = async () => {
    if (backupBusy) return;
    const authorized = adbDevices.filter((device) => device.authorized);
    if (authorized.length !== 1) {
      setError(
        authorized.length === 0
          ? 'Connect exactly one authorized ADB device with existing root/service block-read access before calibration backup.'
          : 'Multiple authorized ADB devices are connected. Disconnect all but the unit being serviced.'
      );
      return;
    }
    const destination = await chooseCalibrationBackupDirectory();
    if (!destination) return;

    setBackupBusy(true);
    setBackupResult(null);
    setError(null);
    try {
      const result = await backupCalibrationPartition(
        authorized[0].serial,
        backupPartition,
        destination,
      );
      setBackupResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <section className="mb-4 rounded-xl border border-orange-900/70 bg-gradient-to-br from-slate-950 via-slate-950 to-orange-950/20 p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-orange-400">
            Bobby&apos;s Repair Command Center
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">
            One control plane. Every repair lane tells the truth.
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            BobFWTools groups workflows by platform and risk, then exposes the exact gates still required before execution:
            authorization, device identity, dry-run, backup/rollback, audit logging, confirmation, and physical qualification.
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-black/30 px-3 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wide text-slate-600">EDL 9008</div>
          <div className={edlDevices.length ? 'mt-1 text-sm font-semibold text-emerald-300' : 'mt-1 text-sm font-semibold text-slate-500'}>
            {edlDevices.length ? edlDevices.length + ' device(s) live' : 'not detected'}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-900 bg-red-950/20 p-3 text-xs text-red-300">
          Command Center backend error: {error}
        </div>
      )}

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {active.map((workflow) => (
          <article key={workflow.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-600">{workflow.category}</div>
                <div className="mt-1 font-mono text-sm text-white">{workflow.id}</div>
                <div className="mt-1 text-xs text-slate-500">{workflow.platform}</div>
              </div>
              <span className={'rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ' + riskClasses(workflow.risk)}>
                {workflow.risk}
              </span>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-400">{workflow.notes}</p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge on={workflow.authorizationRequired}>authorization</Badge>
              <Badge on={workflow.deviceIdentityVerification}>identity verify</Badge>
              <Badge on={workflow.dryRunSupported}>dry run</Badge>
              <Badge on={workflow.backupOrRollbackRequired}>backup / rollback</Badge>
              <Badge on={workflow.auditLoggingRequired}>audit log</Badge>
              <Badge on={workflow.explicitConfirmationRequired}>explicit confirm</Badge>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
              <div className="text-[11px] text-slate-600">executor qualification</div>
              <span
                className={
                  workflow.physicallyQualified
                    ? 'rounded bg-emerald-950 px-2 py-1 text-[10px] font-medium text-emerald-300'
                    : 'rounded bg-amber-950 px-2 py-1 text-[10px] font-medium text-amber-300'
                }
              >
                {workflow.physicallyQualified ? 'physically qualified' : 'qualification pending'}
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-cyan-900/60 bg-cyan-950/10 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-500">Calibration data shield</div>
          <div className="mt-1 text-sm font-medium text-white">Backup before the dangerous stuff.</div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Calibration restore is same-device only and hash/size bound. BobFWTools does not expose IMEI editing,
            serial rewriting, fabricated calibration data, or identity manipulation.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {allowlist.map((partition) => (
              <button
                key={partition}
                type="button"
                onClick={() => setBackupPartition(partition)}
                className={
                  backupPartition === partition
                    ? 'rounded border border-cyan-500 bg-cyan-950/50 px-2 py-1 font-mono text-[10px] text-cyan-200'
                    : 'rounded border border-cyan-900 bg-black/30 px-2 py-1 font-mono text-[10px] text-cyan-400 hover:border-cyan-700'
                }
              >
                {partition}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runCalibrationBackup()}
              disabled={backupBusy || adbDevices.filter((device) => device.authorized).length !== 1}
              className="rounded bg-cyan-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-cyan-600"
            >
              {backupBusy ? 'Backing up…' : 'Backup ' + backupPartition.toUpperCase()}
            </button>
            <span className="text-[10px] text-slate-600">
              {adbDevices.filter((device) => device.authorized).length === 1
                ? '1 authorized ADB unit ready for access verification'
                : 'Requires exactly 1 authorized ADB unit'}
            </span>
          </div>

          {backupResult && (
            <div className="mt-3 rounded border border-emerald-900 bg-emerald-950/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-emerald-300">Verified calibration backup</span>
                <span className="font-mono text-[10px] text-emerald-400">{backupResult.partition}</span>
              </div>
              <div className="mt-2 space-y-1 font-mono text-[10px] text-slate-500">
                <div>bytes: {backupResult.actualBytes} / {backupResult.expectedBytes}</div>
                <div className="break-all">sha256: {backupResult.sha256}</div>
                <div className="break-all">image: {backupResult.backupPath}</div>
                <div className="break-all">manifest: {backupResult.manifestPath}</div>
                <div>access: {backupResult.accessMode}</div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-violet-900/60 bg-violet-950/10 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-400">Future flagship lane</div>
          <div className="mt-1 text-sm font-medium text-white">B.U.Tools reserved platform work</div>
          <div className="mt-3 space-y-2">
            {reserved.map((workflow) => (
              <div key={workflow.id} className="rounded border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-violet-200">{workflow.id}</span>
                  <span className="rounded bg-violet-950 px-2 py-1 text-[10px] text-violet-300">reserved</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{workflow.notes}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-red-950 bg-red-950/10 p-3 text-xs leading-5 text-slate-500">
        Restricted by design: authentication bypasses, BootROM exploit execution, arbitrary unsigned loaders,
        FRP/activation-lock circumvention, and identity rewriting do not become executable paths in BobFWTools.
      </div>
    </section>
  );
}
