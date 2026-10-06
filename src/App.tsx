import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  chooseDownloadDestination,
  chooseUploadSource,
  downloadMtpFile,
  getAdbDeviceInfo,
  getAdbLogcatSnapshot,
  getMtpStatus,
  getNativeUsbDevices,
  isTauriRuntime,
  saveAdbScreenshot,
  scanAdbDevices,
  listMtpRoot,
  uploadMtpFile,
  type AdbDeviceRecord,
  type MtpRootObject,
  type MtpStatus,
  type MtpTransferResult,
  type UsbDeviceRecord,
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
  const [adbSelectedSerial, setAdbSelectedSerial] = useState<string | null>(null);
  const [adbOutput, setAdbOutput] = useState<string | null>(null);
  const [storageIndex, setStorageIndex] = useState(0);
  const [rootObjects, setRootObjects] = useState<MtpRootObject[]>([]);
  const [selectedFolderHandle, setSelectedFolderHandle] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string>('Storage root');
  const [refreshing, setRefreshing] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [lastTransfer, setLastTransfer] = useState<MtpTransferResult | null>(null);
  const nativeRuntime = useMemo(() => isTauriRuntime(), []);

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

      if (mtpStatus?.storages.length) {
        const safeIndex = Math.min(storageIndex, mtpStatus.storages.length - 1);
        setStorageIndex(safeIndex);
        setRootObjects(await listMtpRoot(safeIndex));
      } else {
        setRootObjects([]);
        setSelectedFolderHandle(null);
        setSelectedFolderName('Storage root');
      }
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshing(false);
    }
  }, [storageIndex, transferBusy, adbSelectedSerial]);

  const openStorage = async (index: number) => {
    if (transferBusy) return;
    setStorageIndex(index);
    setSelectedFolderHandle(null);
    setSelectedFolderName('Storage root');
    setNativeError(null);
    try {
      setRootObjects(await listMtpRoot(index));
    } catch (error) {
      setRootObjects([]);
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
      const result = await uploadMtpFile(storageIndex, source, selectedFolderHandle);
      setLastTransfer(result);
      setRootObjects(await listMtpRoot(storageIndex));
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferBusy(false);
    }
  };

  const downloadFile = async (object: MtpRootObject) => {
    if (object.isFolder || transferBusy) return;
    const destination = await chooseDownloadDestination(object.filename || 'android-file');
    if (!destination) return;

    setTransferBusy(true);
    setNativeError(null);
    setLastTransfer(null);
    try {
      const result = await downloadMtpFile(storageIndex, object.handle, destination);
      setLastTransfer(result);
    } catch (error) {
      setNativeError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferBusy(false);
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
                  <div className="text-xs text-slate-400">{device.mode}</div>
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

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/40 p-3">
                  <div>
                    <div className="text-xs font-medium text-white">Upload destination</div>
                    <div className="mt-0.5 text-xs text-slate-500">{selectedFolderName}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFolderHandle(null);
                        setSelectedFolderName('Storage root');
                      }}
                      disabled={transferBusy}
                      className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-50 hover:bg-slate-800"
                    >
                      Use root
                    </button>
                    <button
                      type="button"
                      onClick={() => void uploadFile()}
                      disabled={transferBusy}
                      className="rounded bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-cyan-600"
                    >
                      Choose Mac file and upload
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Root folders and files
                    </h3>
                    <span className="text-xs text-slate-600">{rootObjects.length} objects</span>
                  </div>
                  <div className="mt-2 overflow-hidden rounded border border-slate-800">
                    {rootObjects.length === 0 ? (
                      <div className="bg-slate-950/60 p-4 text-sm text-slate-500">
                        This storage returned no root objects.
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-800 bg-slate-950/60">
                        {rootObjects.map((object) => (
                          <li key={object.handle} className="flex items-center gap-3 px-3 py-2">
                            <span className="w-12 text-[11px] uppercase text-slate-600">
                              {object.isFolder ? 'Folder' : 'File'}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                              {object.filename || 'Unnamed object'}
                            </span>
                            {object.isFolder ? (
                              <button
                                type="button"
                                disabled={transferBusy}
                                onClick={() => {
                                  setSelectedFolderHandle(object.handle);
                                  setSelectedFolderName(object.filename || 'Selected folder');
                                }}
                                className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                                  selectedFolderHandle === object.handle
                                    ? 'border-orange-500 text-orange-300'
                                    : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                                }`}
                              >
                                Upload here
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

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      transferBusy ||
                      !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized
                    }
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
                    disabled={
                      transferBusy ||
                      !adbDevices.find((device) => device.serial === adbSelectedSerial)?.authorized
                    }
                    onClick={() => void runAdbScreenshot()}
                    className="rounded bg-violet-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-40 hover:bg-violet-600"
                  >
                    Save screenshot to Mac
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
