import { useEffect, useMemo, useState } from 'react';
import {
  getCalibrationPartitionAllowlist,
  getEdl9008Devices,
  getWorkflowPolicyCatalog,
  scanAdbDevices,
  scanTransportDevices,
  chooseSamsungFirmwarePackages,
  inspectSamsungFirmwarePackages,
  buildSamsungFirmwarePlan,
  chooseCalibrationBackupDirectory,
  backupCalibrationPartition,
  chooseEdlProgrammer,
  inspectEdlProgrammer,
  enrollEdlProgrammer,
  listEdlProgrammers,
  getWorkstationReadiness,
  initializeWorkstation,
  getFirmwareChipsetCatalog,
  lookupFirmwareChipset,
  scanFirmwareLibrary,
  type FirmwareChipsetProfile,
  type FirmwareLibraryReport,
  type WorkstationReadiness,
  type AdbDeviceRecord,
  type CalibrationBackupResult,
  type EdlProgrammerRecord,
  type UsbDeviceRecord,
  type TransportDevice,
  type SamsungFirmwareArchiveReport,
  type SamsungFlashPlan,
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
  const [workstation, setWorkstation] = useState<WorkstationReadiness | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [adbDevices, setAdbDevices] = useState<AdbDeviceRecord[]>([]);
  const [transportDevices, setTransportDevices] = useState<TransportDevice[]>([]);
  const [selectedTargetKey, setSelectedTargetKey] = useState('');
  const [backupPartition, setBackupPartition] = useState('efs');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupResult, setBackupResult] = useState<CalibrationBackupResult | null>(null);
  const [edlProgrammers, setEdlProgrammers] = useState<EdlProgrammerRecord[]>([]);
  const [inspectedProgrammer, setInspectedProgrammer] = useState<EdlProgrammerRecord | null>(null);
  const [edlDeviceFamily, setEdlDeviceFamily] = useState('');
  const [edlAuthSource, setEdlAuthSource] = useState('');
  const [edlConfirm, setEdlConfirm] = useState('');
  const [edlBusy, setEdlBusy] = useState(false);
  const [samsungFirmwareReports, setSamsungFirmwareReports] = useState<SamsungFirmwareArchiveReport[]>([]);
  const [samsungFlashPlan, setSamsungFlashPlan] = useState<SamsungFlashPlan | null>(null);
  const [samsungFirmwareBusy, setSamsungFirmwareBusy] = useState(false);
  const [firmwareCatalog, setFirmwareCatalog] = useState<FirmwareChipsetProfile[]>([]);
  const [firmwareQuery, setFirmwareQuery] = useState('');
  const [firmwareMatches, setFirmwareMatches] = useState<FirmwareChipsetProfile[]>([]);
  const [firmwareReport, setFirmwareReport] = useState<FirmwareLibraryReport | null>(null);
  const [firmwareBusy, setFirmwareBusy] = useState(false);

  const targets = useMemo(() => {
    const adbTargets = adbDevices.map((device) => ({
      key: `adb:${device.serial}`,
      kind: 'adb',
      label: `ADB · ${device.serial}${device.authorized ? ' · authorized' : ' · unauthorized'}`,
    }));
    const recoveryTargets = transportDevices
      .filter((device) => ['qualcomm-edl', 'mediatek-brom', 'mediatek-preloader', 'samsung-download'].includes(device.mode))
      .map((device) => ({
        key: `usb:${device.deviceUid}`,
        kind: device.mode,
        label: `${device.productName || device.manufacturer || 'USB device'} · ${device.mode}`,
      }));
    return [...adbTargets, ...recoveryTargets];
  }, [adbDevices, transportDevices]);

  const selectedTarget = useMemo(
    () => targets.find((target) => target.key === selectedTargetKey) || null,
    [targets, selectedTargetKey],
  );

  const selectedAdbDevice = useMemo(() => {
    if (selectedTarget?.kind !== 'adb') return null;
    const serial = selectedTarget.key.slice('adb:'.length);
    return adbDevices.find((device) => device.serial === serial) || null;
  }, [selectedTarget, adbDevices]);

  const applicableWorkflowIds = useMemo(() => {
    const ids = new Set<string>(['diagnostics.usb-scan']);
    switch (selectedTarget?.kind) {
      case 'adb':
        ids.add('android.adb-authorized');
        ids.add('calibration.backup');
        ids.add('calibration.restore');
        break;
      case 'qualcomm-edl':
        ids.add('qualcomm.edl-plan');
        break;
      case 'mediatek-brom':
      case 'mediatek-preloader':
        ids.add('mediatek.brom-plan');
        break;
      case 'samsung-download':
        ids.add('samsung.odin-plan');
        break;
      default:
        break;
    }
    return ids;
  }, [selectedTarget]);

  const active = useMemo(
    () => catalog.filter((item) => item.activeInBobfwtools && applicableWorkflowIds.has(item.id)),
    [catalog, applicableWorkflowIds],
  );
  const manualActive = useMemo(
    () => catalog.filter((item) => item.activeInBobfwtools && ['hardware-service', 'cross-platform'].includes(item.platform) && item.id !== 'diagnostics.usb-scan'),
    [catalog],
  );
  const reserved = useMemo(() => catalog.filter((item) => !item.activeInBobfwtools), [catalog]);

  const workflowLiveStatus = (workflow: WorkflowPolicy): { label: string; detail: string; ready: boolean } => {
    if (workflow.id === 'diagnostics.usb-scan') {
      return { label: 'READY NOW', detail: 'Read-only USB evidence can run without a destructive gate.', ready: true };
    }
    if (workflow.platform === 'android' && selectedAdbDevice && !selectedAdbDevice.authorized) {
      return {
        label: 'AUTHORIZE DEVICE',
        detail: 'Approve USB debugging on this exact selected phone before Android service actions.',
        ready: false,
      };
    }
    if (workflow.id === 'qualcomm.edl-plan') {
      return {
        label: 'PLANNING READY',
        detail: 'Selected 9008 hardware can be inspected and prepared; write execution remains qualification-locked.',
        ready: true,
      };
    }
    if (workflow.id === 'mediatek.brom-plan') {
      return {
        label: 'PLANNING READY',
        detail: 'Selected MediaTek recovery hardware can be inspected with legitimate DA/auth artifacts; writes remain locked.',
        ready: true,
      };
    }
    if (workflow.id === 'samsung.odin-plan') {
      return {
        label: 'PLANNING READY',
        detail: 'Selected Samsung Download Mode target can use stock firmware inspection and guarded planning.',
        ready: true,
      };
    }
    if (workflow.id === 'calibration.backup') {
      return selectedAdbDevice?.authorized
        ? { label: 'READY TO VERIFY', detail: 'Selected ADB target is authorized; block-read access is still verified before backup.', ready: true }
        : { label: 'BLOCKED', detail: 'Select and authorize the exact ADB target first.', ready: false };
    }
    if (!workflow.physicallyQualified) {
      return {
        label: 'EVIDENCE ONLY',
        detail: 'Planning/evidence is available, but execution remains locked pending physical qualification.',
        ready: false,
      };
    }
    return { label: 'READY', detail: 'Required live target is selected; normal workflow gates still apply.', ready: true };
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [policies, partitions, edl, adb, transport, programmers, readiness, chipsets] = await Promise.all([
          getWorkflowPolicyCatalog(),
          getCalibrationPartitionAllowlist(),
          getEdl9008Devices(),
          scanAdbDevices(),
          scanTransportDevices(),
          listEdlProgrammers(),
          getWorkstationReadiness(),
          getFirmwareChipsetCatalog(),
        ]);
        if (cancelled) return;
        setCatalog(policies);
        setAllowlist(partitions);
        setEdlDevices(edl);
        setWorkstation(readiness);
        setAdbDevices(adb);
        setTransportDevices(transport);
        setEdlProgrammers(programmers);
        setFirmwareCatalog(chipsets);
        const availableTargetKeys = [
          ...adb.map((device) => `adb:${device.serial}`),
          ...transport
            .filter((device) => ['qualcomm-edl', 'mediatek-brom', 'mediatek-preloader', 'samsung-download'].includes(device.mode))
            .map((device) => `usb:${device.deviceUid}`),
        ];
        setSelectedTargetKey((current) =>
          current && availableTargetKeys.includes(current) ? current : (availableTargetKeys[0] || '')
        );
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

  const inspectProgrammer = async () => {
    if (edlBusy) return;
    const path = await chooseEdlProgrammer();
    if (!path) return;
    setEdlBusy(true);
    setError(null);
    try {
      const record = await inspectEdlProgrammer(path, edlDeviceFamily.trim() || null);
      setInspectedProgrammer(record);
      setEdlConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEdlBusy(false);
    }
  };

  const enrollProgrammer = async () => {
    if (edlBusy || !inspectedProgrammer) return;
    setEdlBusy(true);
    setError(null);
    try {
      const enrolled = await enrollEdlProgrammer(
        inspectedProgrammer,
        edlAuthSource,
        edlConfirm,
      );
      setInspectedProgrammer(enrolled);
      setEdlProgrammers(await listEdlProgrammers());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEdlBusy(false);
    }
  };

  const inspectSamsungFirmware = async () => {
    if (samsungFirmwareBusy || selectedTarget?.kind !== 'samsung-download') return;
    const paths = await chooseSamsungFirmwarePackages();
    if (!paths.length) return;
    setSamsungFirmwareBusy(true);
    setSamsungFirmwareReports([]);
    setSamsungFlashPlan(null);
    setError(null);
    try {
      const [reports, plan] = await Promise.all([
        inspectSamsungFirmwarePackages(paths),
        buildSamsungFirmwarePlan(paths),
      ]);
      setSamsungFirmwareReports(reports);
      setSamsungFlashPlan(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSamsungFirmwareBusy(false);
    }
  };

  const runFirmwareLookup = async () => {
    const query = firmwareQuery.trim();
    if (!query) {
      setFirmwareMatches([]);
      return;
    }
    setFirmwareBusy(true);
    setError(null);
    try {
      setFirmwareMatches(await lookupFirmwareChipset(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFirmwareBusy(false);
    }
  };

  const rescanFirmwareLibrary = async () => {
    setFirmwareBusy(true);
    setError(null);
    try {
      setFirmwareReport(await scanFirmwareLibrary());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFirmwareBusy(false);
    }
  };

  const runCalibrationBackup = async () => {
    if (backupBusy) return;
    if (!selectedAdbDevice) {
      setError('Select the ADB target you intend to service before calibration backup.');
      return;
    }
    if (!selectedAdbDevice.authorized) {
      setError('The selected ADB target is not authorized. Approve USB debugging on that exact device first.');
      return;
    }
    const destination = await chooseCalibrationBackupDirectory();
    if (!destination) return;

    setBackupBusy(true);
    setBackupResult(null);
    setError(null);
    try {
      const result = await backupCalibrationPartition(
        selectedAdbDevice.serial,
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
    <section id="repair-command-center" className="mb-4 rounded-xl border border-orange-900/70 bg-gradient-to-br from-slate-950 via-slate-950 to-orange-950/20 p-5 shadow-2xl shadow-black/20">
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

      <div className="mt-4 rounded-lg border border-cyan-900/60 bg-cyan-950/10 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="text-xs text-slate-400">
            Detected target
            <select
              value={selectedTargetKey}
              onChange={(event) => {
                setSelectedTargetKey(event.target.value);
                setSamsungFirmwareReports([]);
                setSamsungFlashPlan(null);
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="">No supported phone/recovery target selected</option>
              {targets.map((target) => (
                <option key={target.key} value={target.key}>{target.label}</option>
              ))}
            </select>
          </label>
          <div className="rounded border border-slate-800 bg-black/20 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-600">Applicable workflows</div>
            <div className="mt-1 text-sm font-semibold text-cyan-300">{active.length}</div>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          The primary workflow grid is filtered to the selected target. Manual bench and removable-media tools stay separate.
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-800 bg-black/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Workstation readiness</div>
            <div className="mt-1 text-sm font-medium text-white">
              {workstation ? workstation.os + ' / ' + workstation.architecture : 'Checking host...'}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {workstation?.workspaceRoot || 'BobFWTools workspace not resolved yet'}
            </div>
          </div>
          <button
            type="button"
            disabled={initializing}
            onClick={() => {
              setInitializing(true);
              void initializeWorkstation()
                .then(setWorkstation)
                .catch((err) => setError(err instanceof Error ? err.message : String(err)))
                .finally(() => setInitializing(false));
            }}
            className="rounded border border-orange-800 bg-orange-950/30 px-3 py-2 text-xs font-medium text-orange-200 disabled:opacity-40 hover:bg-orange-950/50"
          >
            {initializing ? 'Initializing…' : 'Initialize workspace'}
          </button>
        </div>

        {workstation && (
          <>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {workstation.tools.map((tool) => (
                <div key={tool.id} className="rounded border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-200">{tool.id}</span>
                    <span className={
                      tool.present
                        ? 'text-[10px] text-emerald-400'
                        : tool.requiredForCoreAndroidService
                          ? 'text-[10px] text-amber-300'
                          : 'text-[10px] text-slate-500'
                    }>
                      {tool.present ? 'ready' : tool.requiredForCoreAndroidService ? 'missing' : 'optional'}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-600">{tool.detail}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {workstation.drivers.map((driver) => (
                <div key={driver.id} className="rounded border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-200">{driver.id}</span>
                    <span className={
                      !driver.applicable
                        ? 'text-[10px] text-slate-500'
                        : !driver.evidenceAvailable
                          ? 'text-[10px] text-rose-300'
                          : driver.detected
                            ? 'text-[10px] text-emerald-400'
                            : 'text-[10px] text-amber-300'
                    }>
                      {!driver.applicable
                        ? 'native USB'
                        : !driver.evidenceAvailable
                          ? 'probe unavailable'
                          : driver.detected
                            ? 'driver ready'
                            : 'driver missing'}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-600">{driver.detail}</div>
                  {driver.adminRequiredForInstall && (
                    <div className="mt-1 text-[10px] text-orange-300">Administrator approval required to install.</div>
                  )}
                </div>
              ))}
            </div>

            {workstation.blockers.length > 0 && (
              <div className="mt-3 rounded border border-amber-900/70 bg-amber-950/20 p-3 text-xs text-amber-200">
                {workstation.blockers.join(' · ')}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-5 rounded-lg border border-violet-900/60 bg-violet-950/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-400">Qualcomm + MediaTek firmware intelligence</div>
            <div className="mt-1 text-sm font-medium text-white">Chipset-aware local firmware library</div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
              BobFWTools catalogs chipset families and hashes local service packages. A chipset match is advisory only:
              exact model/variant, secure-boot state, storage layout, OEM signing and authorized loader/DA evidence still gate every plan.
            </p>
          </div>
          <div className="rounded border border-slate-800 bg-black/20 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-600">Catalog coverage</div>
            <div className="mt-1 text-sm font-semibold text-violet-200">{firmwareCatalog.length} chipset families</div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto_auto]">
          <input
            value={firmwareQuery}
            onChange={(event) => setFirmwareQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void runFirmwareLookup();
            }}
            placeholder="Search SM8550, MSM8998, MT6989, Dimensity 9300…"
            className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-violet-700"
          />
          <button
            type="button"
            disabled={firmwareBusy || !firmwareQuery.trim()}
            onClick={() => void runFirmwareLookup()}
            className="rounded border border-violet-800 bg-violet-950/30 px-3 py-2 text-xs font-semibold text-violet-200 disabled:opacity-40 hover:bg-violet-950/50"
          >
            Match chipset
          </button>
          <button
            type="button"
            disabled={firmwareBusy}
            onClick={() => void rescanFirmwareLibrary()}
            className="rounded bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-violet-600"
          >
            {firmwareBusy ? 'Working…' : 'Scan managed firmware'}
          </button>
        </div>

        {!!firmwareMatches.length && (
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {firmwareMatches.slice(0, 6).map((profile) => (
              <div key={profile.vendor + ':' + profile.family} className="rounded border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-600">{profile.vendor}</div>
                    <div className="font-mono text-sm text-white">{profile.family}</div>
                  </div>
                  <span className="rounded bg-violet-950 px-2 py-1 text-[10px] text-violet-300">
                    {profile.commonStorage.join(' / ')}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  {profile.marketedAs.join(' · ') || 'platform family'}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {profile.serviceModes.map((mode) => (
                    <span key={mode} className="rounded border border-slate-800 px-1.5 py-0.5 text-[9px] text-slate-500">{mode}</span>
                  ))}
                </div>
                <div className="mt-2 text-[10px] leading-4 text-amber-300/80">{profile.securityNote}</div>
              </div>
            ))}
          </div>
        )}

        {firmwareReport && (
          <div className="mt-4 rounded border border-slate-800 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-200">Managed firmware inventory</div>
                <div className="mt-1 break-all font-mono text-[10px] text-slate-600">{firmwareReport.root}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="rounded bg-slate-900 px-2 py-1 text-slate-300">{firmwareReport.entries.length} files</span>
                <span className="rounded bg-blue-950 px-2 py-1 text-blue-300">{firmwareReport.vendorCounts.qualcomm || 0} Qualcomm</span>
                <span className="rounded bg-purple-950 px-2 py-1 text-purple-300">{firmwareReport.vendorCounts.mediatek || 0} MediaTek</span>
                <span className={firmwareReport.blockedCount ? 'rounded bg-red-950 px-2 py-1 text-red-300' : 'rounded bg-emerald-950 px-2 py-1 text-emerald-300'}>
                  {firmwareReport.blockedCount} blocked
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-2 xl:grid-cols-2">
              {firmwareReport.entries.slice(0, 12).map((entry) => (
                <div key={entry.path} className={entry.blocked
                  ? 'rounded border border-red-900/60 bg-red-950/10 p-3'
                  : 'rounded border border-slate-800 bg-slate-950/60 p-3'}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[11px] text-slate-200" title={entry.relativePath}>{entry.relativePath}</span>
                    <span className="shrink-0 text-[9px] uppercase tracking-wide text-slate-500">{entry.artifactKind}</span>
                  </div>
                  <div className="mt-1 break-all font-mono text-[9px] text-slate-600">sha256 {entry.sha256}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[9px] text-slate-400">{entry.vendorHint}</span>
                    {entry.chipsetMatches.slice(0, 3).map((match) => (
                      <span key={match} className="rounded bg-violet-950 px-1.5 py-0.5 text-[9px] text-violet-300">{match}</span>
                    ))}
                    {entry.blocked && <span className="rounded bg-red-950 px-1.5 py-0.5 text-[9px] text-red-300">quarantine / do not plan</span>}
                  </div>
                </div>
              ))}
            </div>

            {firmwareReport.entries.length > 12 && (
              <div className="mt-2 text-[10px] text-slate-600">
                Showing 12 of {firmwareReport.entries.length}. Full inventory remains available to the backend planner.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-500">Selected-device workflows</div>
            <div className="mt-1 text-xs text-slate-500">
              {selectedTarget ? selectedTarget.label : 'Connect/select a supported device to reveal its repair lanes.'}
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
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

            {(() => {
              const status = workflowLiveStatus(workflow);
              return (
                <div className={status.ready
                  ? 'mt-3 rounded border border-emerald-900/60 bg-emerald-950/20 p-3'
                  : 'mt-3 rounded border border-amber-900/60 bg-amber-950/20 p-3'}>
                  <div className={status.ready ? 'text-[10px] font-semibold text-emerald-300' : 'text-[10px] font-semibold text-amber-300'}>
                    {status.label}
                  </div>
                  <div className="mt-1 text-[11px] leading-4 text-slate-500">{status.detail}</div>
                </div>
              );
            })()}

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
      </div>

      {selectedTarget?.kind === 'samsung-download' && (
        <div className="mt-4 rounded-lg border border-blue-900/60 bg-blue-950/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-400">Samsung stock firmware inspector</div>
              <div className="mt-1 text-sm font-medium text-white">Verify the package before considering a flash plan.</div>
              <div className="mt-2 rounded border border-amber-900/70 bg-amber-950/20 p-2 text-[11px] text-amber-200">
                MODEL MATCH NOT CERTIFIED — Download Mode detection does not prove the exact Samsung model. Package inspection remains evidence-only until exact model identity is independently verified.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void inspectSamsungFirmware()}
              disabled={samsungFirmwareBusy}
              className="rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-blue-600"
            >
              {samsungFirmwareBusy ? 'Inspecting…' : 'Choose & inspect stock packages'}
            </button>
          </div>

          {!!samsungFirmwareReports.length && (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {samsungFirmwareReports.map((report) => (
                <div key={report.path} className="rounded border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-white">{report.role}</span>
                    <span className={report.md5Verified === true ? 'text-[10px] text-emerald-300' : 'text-[10px] text-slate-500'}>
                      {report.md5Verified === true ? 'MD5 verified' : 'TAR inspected'}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-slate-500" title={report.path}>
                    {report.path.split(/[\\/]/).pop() || report.path}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                    <span>{report.entries.length} entries</span>
                    {report.containsPit && <span className="text-rose-300">contains PIT</span>}
                    {report.containsUserdata && <span className="text-amber-300">contains userdata</span>}
                    {report.containsMetadata && <span>contains metadata</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {samsungFlashPlan && (
            <div className="mt-3 rounded border border-slate-800 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-300">Guarded Samsung plan</div>
                <span className="rounded bg-amber-950 px-2 py-1 text-[10px] text-amber-300">execution disabled</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Roles: {samsungFlashPlan.roles.join(', ') || 'none'} · payloads: {samsungFlashPlan.plannedPayloads.length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {samsungFlashPlan.destructive
                  ? 'Destructive package characteristics detected; explicit approval would be required after model/layout qualification.'
                  : samsungFlashPlan.preservesUserdataByDesign
                    ? 'Preservation-first HOME_CSC characteristics detected; model/layout qualification is still required.'
                    : 'Package inspected; model/layout qualification is still required.'}
              </div>
              {!!samsungFlashPlan.warnings.length && (
                <div className="mt-2 space-y-1 text-[10px] text-amber-300">
                  {samsungFlashPlan.warnings.map((warning) => <div key={warning}>{warning}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!!manualActive.length && (
        <details className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <summary className="cursor-pointer text-xs font-semibold text-slate-300">
            Advanced/manual tools · {manualActive.length}
          </summary>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {manualActive.map((workflow) => (
              <div key={workflow.id} className="rounded border border-slate-800 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-300">{workflow.id}</span>
                  <span className="text-[10px] text-slate-600">{workflow.platform}</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{workflow.notes}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      {selectedTarget?.kind === 'qualcomm-edl' && (
      <div className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">Qualcomm EDL loader vault</div>
            <div className="mt-1 text-sm font-medium text-white">Inspect first. Enroll authorization second. Execute later.</div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
              Firehose programmers are hashed and rechecked on every load. Selection does not make a loader executable;
              only an enrolled OEM/service-authorized record can ever become eligible for a future qualified executor.
            </p>
          </div>
          <span className={edlDevices.length ? 'rounded bg-emerald-950 px-2 py-1 text-[10px] text-emerald-300' : 'rounded bg-slate-900 px-2 py-1 text-[10px] text-slate-500'}>
            {edlDevices.length ? '9008 hardware live' : 'no 9008 hardware'}
          </span>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto]">
          <input
            value={edlDeviceFamily}
            onChange={(event) => setEdlDeviceFamily(event.target.value)}
            placeholder="Device family / platform target (optional)"
            className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-700"
          />
          <button
            type="button"
            onClick={() => void inspectProgrammer()}
            disabled={edlBusy}
            className="rounded bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-amber-600"
          >
            {edlBusy ? 'Inspecting…' : 'Inspect programmer'}
          </button>
        </div>

        {inspectedProgrammer && (
          <div className="mt-3 rounded border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-white">
                {inspectedProgrammer.path.split(/[\\/]/).pop() || inspectedProgrammer.path}
              </span>
              <span className={inspectedProgrammer.authorized ? 'rounded bg-emerald-950 px-2 py-1 text-[10px] text-emerald-300' : 'rounded bg-amber-950 px-2 py-1 text-[10px] text-amber-300'}>
                {inspectedProgrammer.authorized ? 'authorized enrollment' : 'inspection only'}
              </span>
            </div>
            <div className="mt-2 break-all font-mono text-[10px] text-slate-500">
              sha256: {inspectedProgrammer.sha256}
            </div>
            <div className="mt-1 text-[10px] text-slate-600">
              bytes: {inspectedProgrammer.bytes} · family: {inspectedProgrammer.deviceFamily || 'unbound'}
            </div>

            {!inspectedProgrammer.authorized && (
              <div className="mt-3 grid gap-2 xl:grid-cols-2">
                <input
                  value={edlAuthSource}
                  onChange={(event) => setEdlAuthSource(event.target.value)}
                  placeholder="OEM/service authorization source"
                  className="rounded border border-slate-800 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-amber-700"
                />
                <input
                  value={edlConfirm}
                  onChange={(event) => setEdlConfirm(event.target.value)}
                  placeholder="Type: I CONFIRM OEM OR SERVICE AUTHORIZATION"
                  className="rounded border border-slate-800 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-amber-700"
                />
                <button
                  type="button"
                  onClick={() => void enrollProgrammer()}
                  disabled={edlBusy || edlConfirm !== 'I CONFIRM OEM OR SERVICE AUTHORIZATION'}
                  className="rounded border border-amber-700 px-3 py-2 text-xs font-semibold text-amber-200 disabled:opacity-30 hover:bg-amber-950/40 xl:col-span-2"
                >
                  Enroll authorized programmer
                </button>
              </div>
            )}
          </div>
        )}

        {edlProgrammers.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-600">Enrolled vault</div>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {edlProgrammers.map((record) => (
                <div key={record.sha256} className="rounded border border-slate-800 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[11px] text-slate-300">
                      {record.path.split(/[\\/]/).pop() || record.path}
                    </span>
                    <span className={record.authorized ? 'text-[10px] text-emerald-300' : 'text-[10px] text-red-300'}>
                      {record.authorized ? 'active' : 'suspended'}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-[9px] text-slate-600">{record.sha256}</div>
                  <div className="mt-1 text-[10px] text-slate-600">{record.deviceFamily || 'unbound family'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {selectedTarget?.kind === 'adb' && (
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
              disabled={backupBusy || !selectedAdbDevice?.authorized}
              className="rounded bg-cyan-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-cyan-600"
            >
              {backupBusy ? 'Backing up…' : 'Backup ' + backupPartition.toUpperCase()}
            </button>
            <span className="text-[10px] text-slate-600">
              {selectedAdbDevice
                ? selectedAdbDevice.authorized
                  ? `selected target ${selectedAdbDevice.serial} is authorized`
                  : `selected target ${selectedAdbDevice.serial} needs USB-debugging authorization`
                : 'Select an ADB target to use Calibration Shield'}
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
        )}

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
