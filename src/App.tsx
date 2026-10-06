import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  chooseDownloadDestination,
  chooseUploadSource,
  diagnosePhone,
  getAdbBatteryInfo,
  getAdbDeviceInfo,
  getAdbLogcatSnapshot,
  installApkOnDevice,
  prepareAdb,
  getMtpStatus,
  getNativeUsbDevices,
  getWorkflowCapabilities,
  isTauriRuntime,
  saveAdbScreenshot,
  scanAdbDevices,
  listMtpDirectory,
  downloadMtpPath,
  uploadMtpPath,
  listAdbUserPackages,
  runUsbCableDoctor,
  listWorkflowJobs,
  retryWorkflowJob,
  runAdbPackageAction,
  startWorkflowJob,
  type AdbDeviceRecord,
  type MtpBrowserObject,
  type MtpStatus,
  type MtpTransferResult,
  type UsbDeviceRecord,
  type DeviceCapabilityMatrix,
  type PhoneDiagnosticReport,
  type WorkflowJobRecord,
  type AdbPackageRecord,
  type CableDoctorReport,
} from './lib/desktop';

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function hex(value: number): string {
  return value.toString(16).padStart(4, '0').toUpperCase();
}

export default function App() {
  const [usbDevices, setUsbDevices] = useState<UsbDeviceRecord[]>([]);
  const [mtp, setMtp] = useState<MtpStatus | null>(null);
  const [adbDevices, setAdbDevices] = useState<AdbDeviceRecord[]>([]);
  const [capabilities, setCapabilities] = useState<DeviceCapabilityMatrix | null>(null);
  const [adbSelectedSerial, setAdbSelectedSerial] = useState<string | null>(null);
  const [adbOutput, setAdbOutput] = useState<string | null>(null);
  const [storageIndex, setStorageIndex] = useState(0);
  const [mtpPath, setMtpPath] = useState<string[]>([]);
  const [mtpObjects, setMtpObjects] = useState<MtpBrowserObject[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [lastTransfer, setLastTransfer] = useState<MtpTransferResult | null>(null);
  const [diagnostic, setDiagnostic] = useState<PhoneDiagnosticReport | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [workflowJobs, setWorkflowJobs] = useState<WorkflowJobRecord[]>([]);
  const [adbPackages, setAdbPackages] = useState<AdbPackageRecord[]>([]);
  const [packageQuery, setPackageQuery] = useState('');
  const [packageBusy, setPackageBusy] = useState<string | null>(null);
  const [cableDoctor, setCableDoctor] = useState<CableDoctorReport | null>(null);
  const [cableDoctorBusy, setCableDoctorBusy] = useState(false);
  const nativeRuntime = useMemo(() => isTauriRuntime(), []);
  const filteredPackages = useMemo(() => {
    const q = packageQuery.trim().toLowerCase();
    return q ? adbPackages.filter((pkg) => pkg.packageName.toLowerCase().includes(q)) : adbPackages;
  }, [adbPackages, packageQuery]);

  const refreshJobs = useCallback(async () => {
    if (!nativeRuntime) return;
    try {
      setWorkflowJobs(await listWorkflowJobs());
    } catch {
      // The job ledger should never make core transport refresh fail.
    }
  }, [nativeRuntime]);

  const refresh = useCallback(async () => {
    if (transferBusy) return;
    setRefreshing(true);
    setNativeError(null);

    try {
      const devices = await getNativeUsbDevices();
      setUsbDevices(devices);

      const adb = await scanAdbDevices();
      setAdbDevices(adb);
      if (!adbSelectedSerial && adb.length) {
        setAdbSelectedSerial(adb[0].serial);
      } else if (adbSelectedSerial && !adb.some((device) => device.serial === adbSelectedSerial)) {
        setAdbSelectedSerial(adb[0]?.serial ?? null);
      }

      const mtpStatus = await getMtpStatus();
      setMtp(mtpStatus);

      const matrix = await getWorkflowCapabilities();
      setCapabilities(matrix);
      await refreshJobs();

      if (mtpStatus?.storages.length) {
        const safeIndex = Math.min(storageIndex, mtpStatus.storages.length - 1);
        setStorageIndex(safeIndex);
        try {
          setMtpObjects(await listMtpDirectory(safeIndex, mtpPath));
        } catch {
          setMtpPath([]);
          setMtpObjects(await listMtpDirectory(safeIndex, []));
        }
      } else {
        setMtpObjects([]);
        setMtpPath([]);
      }
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshing(false);
    }
  }, [storageIndex, mtpPath, transferBusy, adbSelectedSerial, refreshJobs]);

  const retryJob = async (id: string) => {
    if (transferBusy) return;
    setTransferBusy(true);
    setNativeError(null);
    try {
      const job = await retryWorkflowJob(id);
      setAdbOutput(`Retry job ${job.id}\n${job.summary}\nState: ${job.state}${job.verified ? ' · verified' : ''}`);
      await refreshJobs();
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferBusy(false);
    }
  };

  const runDiagnosis = async () => {
    if (transferBusy || diagnosing) return;
    setDiagnosing(true);
    setNativeError(null);
    try {
      const report = await diagnosePhone();
      setDiagnostic(report);
      if (report.selectedAdbSerial) setAdbSelectedSerial(report.selectedAdbSerial);
      await refresh();
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setDiagnosing(false);
    }
  };

  const runCableDoctor = async () => {
    if (transferBusy || diagnosing || cableDoctorBusy) return;
    setCableDoctorBusy(true);
    setNativeError(null);
    try {
      setCableDoctor(await runUsbCableDoctor());
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setCableDoctorBusy(false);
    }
  };

  const openStorage = async (index: number) => {
    if (transferBusy) return;
    setStorageIndex(index);
    setMtpPath([]);
    setNativeError(null);
    try {
      setMtpObjects(await listMtpDirectory(index, []));
    } catch (error) {
      setMtpObjects([]);
      setNativeError(error instanceof Error ? error.message : String(error));
    }
  };

  const openMtpFolder = async (path: string[]) => {
    if (transferBusy) return;
    setNativeError(null);
    try {
      setMtpObjects(await listMtpDirectory(storageIndex, path));
      setMtpPath(path);
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    }
  };

  const uploadFile = async () => {
    if (!mtp || transferBusy) return;
    const source = await chooseUploadSource();
    if (!source) return;

    setTransferBusy(true);
    setNativeError(null);
    setLastTransfer(null);
    try {
      const result = await uploadMtpPath(storageIndex, mtpPath, source);
      setLastTransfer(result);
      setMtpObjects(await listMtpDirectory(storageIndex, mtpPath));
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferBusy(false);
    }
  };

  const downloadFile = async (object: MtpBrowserObject) => {
    if (object.isFolder || transferBusy) return;
    const destination = await chooseDownloadDestination(object.filename || 'android-file');
    if (!destination) return;

    setTransferBusy(true);
    setNativeError(null);
    setLastTransfer(null);
    try {
      const result = await downloadMtpPath(storageIndex, object.path, destination);
      setLastTransfer(result);
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferBusy(false);
    }
  };

  const runOneClickAdb = async () => {
    if (transferBusy) return;
    setTransferBusy(true);
    setNativeError(null);
    try {
      const devices = await prepareAdb();
      setAdbDevices(devices);
      setAdbOutput(devices.length ? `ADB ready: ${devices.length} device(s) detected.` : 'ADB server ready; no device detected.');
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferBusy(false);
    }
  };

  const runAdbBattery = async () => {
    if (!adbSelectedSerial || transferBusy) return;
    setTransferBusy(true);
    setNativeError(null);
    try {
      const result = await getAdbBatteryInfo(adbSelectedSerial);
      setAdbOutput(`Verified battery info (${result.evidenceSource})\n${result.output}`);
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferBusy(false);
    }
  };

  const runSimpleAdbAction = async (
    action: 'network' | 'factory-reset-settings' | 'install-apk' | 'reboot-normal' | 'reboot-recovery' | 'reboot-bootloader' | 'reboot-download',
  ) => {
    if (!adbSelectedSerial || transferBusy) return;
    setTransferBusy(true);
    setNativeError(null);
    try {
      if (action === 'install-apk') {
        const result = await installApkOnDevice(adbSelectedSerial);
        if (result) {
          setAdbOutput(`${result.message}\n${result.evidenceSource}\nVerified`);
        }
        return;
      }

      const workflowMap = {
        network: 'adb-network-settings',
        'factory-reset-settings': 'adb-factory-reset-settings',
        'reboot-normal': 'adb-reboot-normal',
        'reboot-recovery': 'adb-reboot-recovery',
        'reboot-bootloader': 'adb-reboot-bootloader',
        'reboot-download': 'adb-reboot-download',
      } as const;
      const job = await startWorkflowJob(workflowMap[action], adbSelectedSerial);
      setAdbOutput(
        `Job ${job.id}\n${job.summary}\n${job.evidence.join('\n') || 'No evidence returned'}\nState: ${job.state}${job.verified ? ' · verified' : ''}`,
      );
      await refreshJobs();
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferBusy(false);
    }
  };

  const refreshPackages = async () => {
    if (!adbSelectedSerial || transferBusy) return;
    setTransferBusy(true);
    setNativeError(null);
    try {
      setAdbPackages(await listAdbUserPackages(adbSelectedSerial));
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
      setAdbPackages([]);
    } finally {
      setTransferBusy(false);
    }
  };

  const packageAction = async (
    packageName: string,
    action: 'enable' | 'disable-user' | 'clear-data' | 'uninstall-user',
  ) => {
    if (!adbSelectedSerial || transferBusy || packageBusy) return;
    if (
      (action === 'clear-data' || action === 'uninstall-user') &&
      !window.confirm(
        action === 'clear-data'
          ? `Clear all app data for ${packageName}? This cannot be undone.`
          : `Uninstall ${packageName} for the current Android user?`,
      )
    ) {
      return;
    }
    setPackageBusy(packageName);
    setNativeError(null);
    try {
      const result = await runAdbPackageAction(adbSelectedSerial, packageName, action);
      setAdbOutput(`${result.message}\n${result.evidenceSource}\nVerified`);
      setAdbPackages(await listAdbUserPackages(adbSelectedSerial));
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setPackageBusy(null);
    }
  };

  const runAdbDeviceInfo = async () => {
    if (!adbSelectedSerial || transferBusy) return;
    setTransferBusy(true);
    setNativeError(null);
    setAdbOutput(null);
    try {
      const result = await getAdbDeviceInfo(adbSelectedSerial);
      const lines = Object.entries(result.properties)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      setAdbOutput(`Verified device info (${result.evidenceSource})\n${lines}`);
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferBusy(false);
    }
  };

  const runAdbLogcat = async () => {
    if (!adbSelectedSerial || transferBusy) return;
    setTransferBusy(true);
    setNativeError(null);
    setAdbOutput(null);
    try {
      const result = await getAdbLogcatSnapshot(adbSelectedSerial, 250);
      setAdbOutput(`Verified logcat snapshot (${result.evidenceSource})\n${result.output}`);
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferBusy(false);
    }
  };

  const runAdbScreenshot = async () => {
    if (!adbSelectedSerial || transferBusy) return;
    setTransferBusy(true);
    setNativeError(null);
    try {
      const result = await saveAdbScreenshot(adbSelectedSerial);
      if (result) {
        setAdbOutput(
          `Verified screenshot saved\n${result.destination}\n${formatBytes(result.bytes)} · ${result.evidenceSource}`,
        );
      }
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (!transferBusy) void refresh();
    }, 5000);
    return () => window.clearInterval(id);
  }, [refresh, transferBusy]);

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-200">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">BobFWTools</h1>
          <p className="text-xs text-slate-500">
            Android connectivity for macOS · native USB + MTP
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${nativeRuntime ? 'text-emerald-400' : 'text-amber-300'}`}>
            {nativeRuntime ? 'Native desktop core' : 'Browser preview'}
          </span>
          {transferBusy && <span className="text-xs text-cyan-300">Transfer running…</span>}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing || transferBusy}
            className="rounded bg-orange-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-orange-500"
          >
            {refreshing ? 'Scanning…' : 'Scan now'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-900/80 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Physical USB
          </h2>

          {usbDevices.length === 0 ? (
            <div className="rounded border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-500">
              No USB device observed. Connect the phone directly or through a data-capable USB hub.
            </div>
          ) : (
            <ul className="space-y-2">
              {usbDevices.map((device) => (
                <li key={device.deviceUid} className="rounded border border-slate-700 bg-slate-950/60 p-3">
                  <div className="font-medium text-white">
                    {device.productName || device.manufacturer || 'USB device'}
                  </div>
                  <div className="mt-1 text-xs text-cyan-300">{device.platformHint}</div>
                  <div className="text-xs text-slate-400">{device.mode} · {device.speed}</div>
                  <div className="mt-2 font-mono text-[11px] text-slate-600">
                    {hex(device.vendorId)}:{hex(device.productId)}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600">{device.evidenceSource}</div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-5">
          {nativeError && (
            <div className="mb-4 rounded border border-red-900 bg-red-950/30 p-3 text-sm text-red-200">
              {nativeError}
            </div>
          )}

          {lastTransfer && (
            <div className="mb-4 rounded border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-200">
              Verified {lastTransfer.operation}: {lastTransfer.filename} · {formatBytes(lastTransfer.bytes)}
              <div className="mt-1 break-all text-xs text-emerald-400/80">
                {lastTransfer.destination} · {lastTransfer.evidenceSource}
              </div>
            </div>
          )}

          <section className="mb-4 rounded-lg border border-cyan-900/70 bg-cyan-950/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">Diagnose This Phone</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                  One scan checks physical USB, MTP, ADB authorization, Fastboot, verified device properties,
                  battery state, and the workflows BobFWTools can actually run right now.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void runDiagnosis()}
                disabled={diagnosing || transferBusy || !nativeRuntime}
                className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-cyan-500"
              >
                {diagnosing ? 'Diagnosing…' : 'Diagnose This Phone'}
              </button>
            </div>

            {diagnostic && (
              <>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[10px] uppercase text-slate-600">USB</div>
                    <div className="mt-1 text-sm text-white">{diagnostic.usbDevicesSeen} observed</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[10px] uppercase text-slate-600">MTP</div>
                    <div className="mt-1 text-sm text-white">{diagnostic.mtpConnected ? 'Ready' : 'Unavailable'}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[10px] uppercase text-slate-600">ADB</div>
                    <div className="mt-1 text-sm text-white">
                      {diagnostic.authorizedAdbDevices}/{diagnostic.adbDevicesSeen} authorized
                    </div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[10px] uppercase text-slate-600">Fastboot</div>
                    <div className="mt-1 text-sm text-white">{diagnostic.fastbootPresent ? 'Detected' : 'Not detected'}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[10px] uppercase text-slate-600">Workflows</div>
                    <div className="mt-1 text-sm text-white">{diagnostic.availableWorkflows.length} ready</div>
                  </div>
                </div>

                <div className="mt-4 rounded border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">USB / Cable Doctor</h3>
                      <div className="mt-1 text-sm text-slate-300">{diagnostic.connectionSummary}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={cableDoctorBusy || transferBusy || !nativeRuntime}
                        onClick={() => void runCableDoctor()}
                        className="rounded border border-cyan-800 px-3 py-1.5 text-xs font-medium text-cyan-300 disabled:opacity-40 hover:bg-cyan-950/50"
                      >
                        {cableDoctorBusy ? 'Testing…' : 'Run stability test'}
                      </button>
                      <span className={
                      diagnostic.connectionGrade === 'excellent'
                        ? 'rounded bg-emerald-950 px-2 py-1 text-xs text-emerald-300'
                        : diagnostic.connectionGrade === 'usable'
                          ? 'rounded bg-cyan-950 px-2 py-1 text-xs text-cyan-300'
                          : diagnostic.connectionGrade === 'limited'
                            ? 'rounded bg-amber-950 px-2 py-1 text-xs text-amber-300'
                            : 'rounded bg-red-950 px-2 py-1 text-xs text-red-300'
                    }>
                      {diagnostic.connectionGrade}
                      </span>
                    </div>
                  </div>

                  {cableDoctor && (
                    <div className="mt-3 rounded border border-slate-800 bg-slate-950/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-white">{cableDoctor.summary}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {cableDoctor.androidPresentSamples}/{cableDoctor.samples} Android USB samples present · {cableDoctor.reconnectEvents} identity changes
                          </div>
                        </div>
                        <span className={
                          cableDoctor.grade === 'healthy'
                            ? 'rounded bg-emerald-950 px-2 py-1 text-xs text-emerald-300'
                            : cableDoctor.grade === 'limited'
                              ? 'rounded bg-amber-950 px-2 py-1 text-xs text-amber-300'
                              : 'rounded bg-red-950 px-2 py-1 text-xs text-red-300'
                        }>
                          {cableDoctor.grade}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded border border-slate-800 p-2 text-xs">
                          <span className="text-slate-500">Speed</span>
                          <div className="mt-1 text-white">{cableDoctor.observedSpeeds.join(', ') || 'Unavailable'}</div>
                        </div>
                        <div className="rounded border border-slate-800 p-2 text-xs">
                          <span className="text-slate-500">Mode</span>
                          <div className="mt-1 text-white">{cableDoctor.observedModes.join(', ') || 'Unavailable'}</div>
                        </div>
                        <div className="rounded border border-slate-800 p-2 text-xs">
                          <span className="text-slate-500">Transports</span>
                          <div className="mt-1 text-white">ADB {cableDoctor.adbState} · MTP {cableDoctor.mtpConnected ? 'yes' : 'no'} · Fastboot {cableDoctor.fastbootPresent ? 'yes' : 'no'}</div>
                        </div>
                      </div>
                      {cableDoctor.recommendations.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {cableDoctor.recommendations.map((item) => (
                            <div key={item} className="text-xs text-cyan-300">• {item}</div>
                          ))}
                        </div>
                      )}
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-slate-400">Cable test evidence</summary>
                        <div className="mt-2 space-y-1 font-mono text-[10px] text-slate-600">
                          {cableDoctor.evidence.map((item, index) => (
                            <div key={`${item.source}-${index}`}>{item.source}: {item.detail}</div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {diagnostic.usbConnections.length ? diagnostic.usbConnections.map((usb, index) => (
                      <div key={`${usb.vendorId}-${usb.productId}-${usb.busNumber}-${usb.deviceAddress}-${index}`} className="rounded border border-slate-800 bg-slate-950/70 p-3">
                        <div className="text-sm font-medium text-white">{usb.productName || usb.manufacturer || usb.platformHint}</div>
                        <div className="mt-1 text-xs text-cyan-300">{usb.platformHint} · {usb.mode}</div>
                        <div className="mt-1 font-mono text-[11px] text-slate-500">
                          {hex(usb.vendorId)}:{hex(usb.productId)} · {usb.speed} · bus {usb.busNumber} · addr {usb.deviceAddress}
                        </div>
                        <div className="mt-1 break-all text-[10px] text-slate-600">
                          {usb.serialNumber || 'no descriptor serial'} · {usb.evidenceSource}
                        </div>
                      </div>
                    )) : (
                      <div className="text-sm text-slate-500">No Android-class USB descriptor is visible.</div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="rounded border border-slate-800 bg-slate-950/50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verified device profile</h3>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <span className="text-slate-500">Device</span>
                      <span className="text-white">{[diagnostic.device.manufacturer, diagnostic.device.model].filter(Boolean).join(' ') || 'Unavailable'}</span>
                      <span className="text-slate-500">Serial</span>
                      <span className="break-all font-mono text-xs text-white">{diagnostic.device.serial || 'Unavailable'}</span>
                      <span className="text-slate-500">Android</span>
                      <span className="text-white">{diagnostic.device.androidVersion || 'Unavailable'}{diagnostic.device.sdk ? ` · SDK ${diagnostic.device.sdk}` : ''}</span>
                      <span className="text-slate-500">Security patch</span>
                      <span className="text-white">{diagnostic.device.securityPatch || 'Unavailable'}</span>
                      <span className="text-slate-500">Bootloader</span>
                      <span className="break-all text-white">{diagnostic.device.bootloader || 'Unavailable'}</span>
                      <span className="text-slate-500">Verified boot</span>
                      <span className="text-white">{diagnostic.device.verifiedBootState || 'Unavailable'}</span>
                      <span className="text-slate-500">Battery</span>
                      <span className="text-white">{diagnostic.device.batterySummary || 'Unavailable'}</span>
                    </div>
                  </div>

                  <div className="rounded border border-slate-800 bg-slate-950/50 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Findings</h3>
                    <div className="mt-3 space-y-2">
                      {diagnostic.findings.length === 0 ? (
                        <div className="text-sm text-slate-500">No diagnostic findings were produced.</div>
                      ) : diagnostic.findings.map((finding) => (
                        <div key={finding.id} className="rounded border border-slate-800 p-3">
                          <div className={
                            finding.severity === 'ok'
                              ? 'text-sm font-medium text-emerald-300'
                              : finding.severity === 'warning'
                                ? 'text-sm font-medium text-amber-300'
                                : 'text-sm font-medium text-red-300'
                          }>
                            {finding.title}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">{finding.detail}</div>
                          {finding.recommendation && (
                            <div className="mt-2 text-xs text-cyan-300">{finding.recommendation}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ready now</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {diagnostic.availableWorkflows.length ? diagnostic.availableWorkflows.map((workflow) => (
                      <span key={workflow} className="rounded bg-emerald-950 px-2 py-1 text-xs text-emerald-300">
                        {workflow}
                      </span>
                    )) : <span className="text-xs text-slate-500">No executable workflows currently available.</span>}
                  </div>
                </div>

                <details className="mt-4 rounded border border-slate-800 bg-slate-950/40 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-slate-300">Evidence and blocked workflows</summary>
                  <div className="mt-3 space-y-1 font-mono text-[11px] text-slate-500">
                    {diagnostic.evidence.map((item, index) => (
                      <div key={`${item.source}-${index}`}>{item.source}: {item.detail}</div>
                    ))}
                    {diagnostic.blockedWorkflows.map((item) => (
                      <div key={item}>blocked: {item}</div>
                    ))}
                  </div>
                </details>
              </>
            )}
          </section>

          <section className="mb-4 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">ADB App Manager</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Manage third-party packages on the selected authorized device. Package actions are validated and allowlisted.
                </p>
              </div>
              <button
                type="button"
                disabled={transferBusy || !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized}
                onClick={() => void refreshPackages()}
                className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-600"
              >
                Load apps
              </button>
            </div>

            {adbPackages.length > 0 && (
              <>
                <div className="mt-3">
                  <input
                    value={packageQuery}
                    onChange={(event) => setPackageQuery(event.target.value)}
                    placeholder="Search package names…"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-600"
                  />
                </div>
                <div className="mt-3 max-h-80 overflow-y-auto rounded border border-slate-800">
                  {filteredPackages.map((pkg) => (
                    <div key={pkg.packageName} className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950/50 px-3 py-2 last:border-b-0">
                      <div className="min-w-0 flex-1 break-all font-mono text-xs text-slate-200">{pkg.packageName}</div>
                      <button
                        type="button"
                        disabled={!!packageBusy}
                        onClick={() => void packageAction(pkg.packageName, 'enable')}
                        className="rounded border border-slate-700 px-2 py-1 text-[11px] text-emerald-300 disabled:opacity-40 hover:bg-slate-800"
                      >
                        Enable
                      </button>
                      <button
                        type="button"
                        disabled={!!packageBusy}
                        onClick={() => void packageAction(pkg.packageName, 'disable-user')}
                        className="rounded border border-slate-700 px-2 py-1 text-[11px] text-amber-300 disabled:opacity-40 hover:bg-slate-800"
                      >
                        Disable
                      </button>
                      <button
                        type="button"
                        disabled={!!packageBusy}
                        onClick={() => void packageAction(pkg.packageName, 'clear-data')}
                        className="rounded border border-slate-700 px-2 py-1 text-[11px] text-orange-300 disabled:opacity-40 hover:bg-slate-800"
                      >
                        Clear data
                      </button>
                      <button
                        type="button"
                        disabled={!!packageBusy}
                        onClick={() => void packageAction(pkg.packageName, 'uninstall-user')}
                        className="rounded border border-red-900 px-2 py-1 text-[11px] text-red-300 disabled:opacity-40 hover:bg-red-950/40"
                      >
                        Uninstall user
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  {filteredPackages.length} of {adbPackages.length} user-installed packages shown.
                </div>
              </>
            )}
          </section>

          <section className="mb-4 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Recent one-click jobs</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Audited workflow runs with truthful completion state and evidence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshJobs()}
                className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Refresh jobs
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {workflowJobs.length === 0 ? (
                <div className="rounded border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-500">
                  No audited one-click jobs have run in this app session yet.
                </div>
              ) : workflowJobs.slice(0, 8).map((job) => (
                <div key={job.id} className="rounded border border-slate-800 bg-slate-950/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs text-white">{job.workflowId}</span>
                      <span className="ml-2 font-mono text-[10px] text-slate-600">{job.id}</span>
                    </div>
                    <span className={
                      job.state === 'completed'
                        ? 'text-xs text-emerald-300'
                        : job.state === 'accepted'
                          ? 'text-xs text-cyan-300'
                          : job.state === 'failed'
                            ? 'text-xs text-red-300'
                            : 'text-xs text-amber-300'
                    }>
                      {job.state}{job.verified ? ' · verified' : ''}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{job.summary}</div>
                  {job.retryOf && (
                    <div className="mt-1 font-mono text-[10px] text-slate-600">retry of {job.retryOf}</div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    {job.state === 'failed' && (
                      <button
                        type="button"
                        disabled={transferBusy}
                        onClick={() => void retryJob(job.id)}
                        className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 disabled:opacity-40 hover:bg-slate-800"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                  {job.evidence.length > 0 && (
                    <div className="mt-2 break-all font-mono text-[10px] text-slate-600">{job.evidence.join(' · ')}</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">Media Transfer Protocol</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                  Real Android file access. USB debugging is not required. Unlock the phone and choose File transfer
                  or Android Auto when Android asks what the USB connection should do.
                </p>
              </div>
              <span className={`rounded px-2 py-1 text-xs font-medium ${
                mtp ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
              }`}>
                {mtp ? 'MTP connected' : 'No MTP session'}
              </span>
            </div>

            {!mtp ? (
              <div className="mt-5 rounded border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                BobFWTools sees MTP independently from ADB. If the phone is physically visible at left but no
                MTP session appears, unlock the phone and switch its USB preference to File transfer.
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[11px] uppercase text-slate-600">Manufacturer</div>
                    <div className="mt-1 text-sm text-white">{mtp.manufacturer || 'Unavailable'}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[11px] uppercase text-slate-600">Model</div>
                    <div className="mt-1 text-sm text-white">{mtp.model || 'Unavailable'}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[11px] uppercase text-slate-600">Family</div>
                    <div className="mt-1 text-sm text-white">{mtp.deviceFamily}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[11px] uppercase text-slate-600">Evidence</div>
                    <div className="mt-1 break-all text-xs text-cyan-300">{mtp.evidenceSource}</div>
                  </div>
                </div>

                <div className="mt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Storage</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mtp.storages.map((storage, index) => (
                      <button
                        type="button"
                        key={`${storage.description}-${index}`}
                        onClick={() => void openStorage(index)}
                        disabled={transferBusy}
                        className={`rounded border px-3 py-2 text-left text-sm disabled:opacity-50 ${
                          index === storageIndex
                            ? 'border-orange-500 bg-orange-950/20'
                            : 'border-slate-700 bg-slate-950 hover:border-slate-600'
                        }`}
                      >
                        <div className="font-medium text-white">{storage.description || `Storage ${index + 1}`}</div>
                        <div className="text-xs text-slate-500">{formatBytes(storage.freeSpaceBytes)} free</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-white">Current Android folder</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                        <button
                          type="button"
                          disabled={transferBusy}
                          onClick={() => void openMtpFolder([])}
                          className="rounded px-1.5 py-0.5 text-cyan-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                          root
                        </button>
                        {mtpPath.map((segment, index) => (
                          <span key={`${segment}-${index}`} className="flex items-center gap-1">
                            <span className="text-slate-600">/</span>
                            <button
                              type="button"
                              disabled={transferBusy}
                              onClick={() => void openMtpFolder(mtpPath.slice(0, index + 1))}
                              className="rounded px-1.5 py-0.5 text-cyan-300 hover:bg-slate-800 disabled:opacity-50"
                            >
                              {segment}
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void uploadFile()}
                      disabled={transferBusy}
                      className="rounded bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-cyan-600"
                    >
                      Upload Mac file here
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Folder contents
                    </h3>
                    <span className="text-xs text-slate-600">{mtpObjects.length} objects</span>
                  </div>
                  <div className="mt-2 overflow-hidden rounded border border-slate-800">
                    {mtpObjects.length === 0 ? (
                      <div className="bg-slate-950/60 p-4 text-sm text-slate-500">
                        This folder is empty or returned no visible objects.
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-800 bg-slate-950/60">
                        {mtpObjects.map((object) => (
                          <li key={object.path.join('/')} className="flex items-center gap-3 px-3 py-2">
                            <span className="w-12 text-[11px] uppercase text-slate-600">
                              {object.isFolder ? 'Folder' : 'File'}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                              {object.filename || 'Unnamed object'}
                            </span>
                            {!object.isFolder && (
                              <span className="text-[11px] text-slate-600">{formatBytes(object.sizeBytes)}</span>
                            )}
                            {object.isFolder ? (
                              <button
                                type="button"
                                disabled={transferBusy}
                                onClick={() => void openMtpFolder(object.path)}
                                className="rounded border border-slate-700 px-2 py-1 text-xs text-cyan-300 disabled:opacity-50 hover:bg-slate-800"
                              >
                                Open
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={transferBusy}
                                onClick={() => void downloadFile(object)}
                                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 disabled:opacity-50 hover:bg-slate-800"
                              >
                                Download to Mac
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Negotiated MTP capabilities
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mtp.capabilities.map((capability) => (
                      <span key={capability} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Live workflow capability matrix</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Every workflow is enabled from current transport evidence, not device-brand assumptions.
                </p>
              </div>
              {capabilities && (
                <span className="text-xs text-slate-500">
                  USB {capabilities.usbDevicesSeen} · ADB {capabilities.adbDevicesSeen} · MTP {capabilities.mtpConnected ? 'yes' : 'no'}
                </span>
              )}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {(capabilities?.workflows ?? []).map((workflow) => (
                <div
                  key={workflow.id}
                  className={`rounded border p-3 ${
                    workflow.enabled
                      ? 'border-emerald-900 bg-emerald-950/20'
                      : 'border-slate-800 bg-slate-950/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs text-white">{workflow.id}</div>
                    <span className={workflow.enabled ? 'text-xs text-emerald-400' : 'text-xs text-slate-600'}>
                      {workflow.enabled ? 'enabled' : 'unavailable'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{workflow.reason}</div>
                  {workflow.evidence.length > 0 && (
                    <div className="mt-2 break-all text-[10px] text-slate-600">
                      {workflow.evidence.join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Authorized ADB workflows</h2>
                <p className="mt-1 text-sm text-slate-400">
                  These actions run against the selected real ADB device. Unauthorized and offline devices remain
                  visible but cannot execute workflows.
                </p>
              </div>
              <span className="text-xs text-slate-500">{adbDevices.length} ADB device(s)</span>
            </div>

            {adbDevices.length === 0 ? (
              <div className="mt-4 rounded border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-500">
                No ADB interface detected. File transfer can still work over MTP without USB debugging.
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {adbDevices.map((device) => (
                    <button
                      key={device.serial}
                      type="button"
                      onClick={() => setAdbSelectedSerial(device.serial)}
                      className={`rounded border px-3 py-2 text-left text-xs ${
                        adbSelectedSerial === device.serial
                          ? 'border-cyan-500 bg-cyan-950/20'
                          : 'border-slate-700 bg-slate-950'
                      }`}
                    >
                      <div className="font-mono text-slate-200">{device.serial}</div>
                      <div className={device.authorized ? 'text-emerald-400' : 'text-amber-300'}>
                        {device.state}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <button
                    type="button"
                    disabled={transferBusy}
                    onClick={() => void runOneClickAdb()}
                    className="rounded bg-cyan-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-cyan-600"
                  >
                    Prepare ADB
                  </button>
                  <button
                    type="button"
                    disabled={transferBusy || !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized}
                    onClick={() => void runAdbBattery()}
                    className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-600"
                  >
                    Battery info
                  </button>
                  <button
                    type="button"
                    disabled={transferBusy || !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized}
                    onClick={() => void runAdbDeviceInfo()}
                    className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-600"
                  >
                    Read live device info
                  </button>
                  <button
                    type="button"
                    disabled={
                      transferBusy ||
                      !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized
                    }
                    onClick={() => void runAdbLogcat()}
                    className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-600"
                  >
                    Capture logcat
                  </button>
                  <button
                    type="button"
                    disabled={transferBusy || !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized}
                    onClick={() => void runAdbScreenshot()}
                    className="rounded bg-violet-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-violet-600"
                  >
                    Save screenshot
                  </button>
                  <button
                    type="button"
                    disabled={transferBusy || !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized}
                    onClick={() => void runSimpleAdbAction('network')}
                    className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-600"
                  >
                    Network settings
                  </button>
                  <button
                    type="button"
                    disabled={transferBusy || !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized}
                    onClick={() => void runSimpleAdbAction('factory-reset-settings')}
                    className="rounded bg-amber-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-amber-600"
                  >
                    Factory reset settings
                  </button>
                  <button
                    type="button"
                    disabled={transferBusy || !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized}
                    onClick={() => void runSimpleAdbAction('install-apk')}
                    className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-600"
                  >
                    Install APK
                  </button>
                  <button
                    type="button"
                    disabled={transferBusy || !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized}
                    onClick={() => void runSimpleAdbAction('reboot-normal')}
                    className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-600"
                  >
                    Reboot
                  </button>
                  <button
                    type="button"
                    disabled={transferBusy || !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized}
                    onClick={() => void runSimpleAdbAction('reboot-recovery')}
                    className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-600"
                  >
                    Reboot recovery
                  </button>
                  <button
                    type="button"
                    disabled={transferBusy || !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized}
                    onClick={() => void runSimpleAdbAction('reboot-bootloader')}
                    className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-600"
                  >
                    Reboot bootloader
                  </button>
                  <button
                    type="button"
                    disabled={transferBusy || !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized}
                    onClick={() => void runSimpleAdbAction('reboot-download')}
                    className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-600"
                  >
                    Samsung download mode
                  </button>
                </div>

                {adbOutput && (
                  <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-black p-3 text-xs text-slate-300">
                    {adbOutput}
                  </pre>
                )}
              </>
            )}
          </section>

          <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-sm font-semibold text-white">Workflow execution policy</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              BobFWTools only enables a workflow when the required transport is actually present. USB descriptor data
              comes from the native Rust scanner. File operations execute through a real MTP session. Completed uploads
              are re-listed for verification; downloads are verified after the Mac file is written. Missing transports
              remain unavailable instead of returning simulated success.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
