import React, { useState, useEffect } from 'react';

export interface TrapdoorDevice {
  serial: string;
  brand: string;
  model: string;
  state: string;
  platform?: string;
}

export interface TrapdoorRootVaultProps {
  passcode?: string;
  devices?: TrapdoorDevice[];
}

type RootMethod = 'magisk' | 'supersu' | 'xposed';

interface RootVaultLogEntry {
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: string;
}

export default function TrapdoorRootVault({
  passcode = '',
  devices: propDevices = [],
}: TrapdoorRootVaultProps) {
  const [devices, setDevices] = useState<TrapdoorDevice[]>(propDevices);
  const [selectedDevice, setSelectedDevice] = useState<TrapdoorDevice | null>(null);
  const [rootMethod, setRootMethod] = useState<RootMethod>('magisk');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<RootVaultLogEntry[]>([]);
  const [operationComplete, setOperationComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootStatus, setRootStatus] = useState<'unknown' | 'rooted' | 'not_rooted'>('unknown');
  const [rootDetails, setRootDetails] = useState<{
    hasMagisk?: boolean;
    hasSuperSU?: boolean;
    hasXposed?: boolean;
  }>({});
  const [devicesLoading, setDevicesLoading] = useState(false);

  useEffect(() => {
    if (propDevices.length === 0) {
      void scanDevices();
    } else {
      setDevices(propDevices);
    }
  }, [propDevices]);

  const scanDevices = async () => {
    setDevicesLoading(true);
    try {
      const adbResponse = await fetch('/api/v1/adb/devices');
      if (adbResponse.ok) {
        const adbData = await adbResponse.json();
        const rawList = adbData?.data?.devices || adbData?.devices || [];
        const adbDevices: TrapdoorDevice[] = rawList
          .filter((d: any) => d.serial && (d.connected !== false))
          .map((d: any) => ({
            serial: d.serial,
            brand: d.properties?.brand || d.properties?.manufacturer || 'Android',
            model: d.properties?.model || d.model || 'Device',
            state: d.status || d.state || 'device',
            platform: 'android',
          }));
        setDevices(adbDevices);
      }
    } catch (scanErr) {
      console.error('[RootVault] Device scan error:', scanErr);
    } finally {
      setDevicesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDevice && passcode) {
      void checkRootStatus();
    }
  }, [selectedDevice, passcode]);

  const checkRootStatus = async () => {
    if (!selectedDevice || !passcode) return;

    try {
      const response = await fetch('/api/v1/trapdoor/root/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          deviceSerial: selectedDevice.serial,
        }),
      });

      const payload = await response.json();
      const statusData = payload?.data || payload;
      if (response.ok && statusData) {
        setRootStatus(statusData.rooted ? 'rooted' : 'not_rooted');
        setRootDetails({
          hasMagisk: Boolean(statusData.hasMagisk),
          hasSuperSU: Boolean(statusData.hasSuperSU),
          hasXposed: Boolean(statusData.hasXposed),
        });
      }
    } catch (statusErr) {
      console.error('[RootVault] Failed to check root status:', statusErr);
    }
  };

  const addLog = (level: RootVaultLogEntry['level'], message: string) => {
    setLogs((prev) => [
      ...prev,
      { level, message, timestamp: new Date().toISOString() },
    ]);
  };

  const handleDeviceSelect = (device: TrapdoorDevice) => {
    setSelectedDevice(device);
    setError(null);
    setOperationComplete(false);
    setLogs([]);
    setRootStatus('unknown');
    setRootDetails({});
  };

  const handleInstall = async () => {
    if (!selectedDevice || !rootMethod || !passcode) return;
    if (confirmationInput.trim() !== 'ROOT') {
      setError('Type "ROOT" to confirm root installation.');
      return;
    }

    setIsExecuting(true);
    setError(null);
    setLogs([]);
    setOperationComplete(false);

    try {
      const response = await fetch('/api/v1/trapdoor/root/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          deviceSerial: selectedDevice.serial,
          method: rootMethod,
          confirmation: 'ROOT',
        }),
      });

      const payload = await response.json();
      const resultData = payload?.data || payload;

      if (response.ok && (payload.ok || resultData?.success)) {
        addLog('info', `Root installation initiated: ${rootMethod}`);
        if (Array.isArray(resultData?.logs)) {
          for (const item of resultData.logs) {
            addLog(item.level || 'info', item.message);
          }
        }
        addLog('success', resultData?.message || 'Root installation framework ready');
        setOperationComplete(true);
        void checkRootStatus();
      } else {
        const errMsg =
          payload?.error?.message ||
          payload?.error ||
          resultData?.error ||
          'Root installation failed';
        setError(String(errMsg));
        addLog('error', String(errMsg));
      }
    } catch (installErr: any) {
      const errorMsg = installErr?.message || 'Network error';
      setError(errorMsg);
      addLog('error', errorMsg);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-cyan-400">Root Vault (Secret Room #4)</h1>
          <p className="text-xs text-slate-400">
            Root verification &amp; framework preparation — Magisk, SuperSU, and Xposed Framework
          </p>
        </div>

        <div className="rounded border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
          <strong>WARRANTY &amp; SECURITY NOTICE:</strong> Rooting modifies system/boot partitions and may void hardware warranty. Only execute on owner-authorized devices.
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Connected ADB Targets</h2>
              <button
                type="button"
                onClick={() => void scanDevices()}
                disabled={devicesLoading}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                {devicesLoading ? 'Scanning…' : 'Refresh'}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {devices.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">No ADB devices detected</p>
              ) : (
                devices.map((device) => (
                  <button
                    key={device.serial}
                    type="button"
                    onClick={() => handleDeviceSelect(device)}
                    className={`w-full rounded border p-2.5 text-left text-xs transition ${
                      selectedDevice?.serial === device.serial
                        ? 'border-cyan-500 bg-cyan-950/30'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-slate-200">
                      {device.brand} {device.model}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">{device.serial}</div>
                  </button>
                ))
              )}
            </div>

            {selectedDevice && (
              <div className="mt-4 border-t border-slate-800 pt-3 text-xs">
                <div className="text-slate-400">Root Status:</div>
                <div className="mt-1 font-semibold">
                  {rootStatus === 'rooted' && <span className="text-emerald-400">Rooted</span>}
                  {rootStatus === 'not_rooted' && <span className="text-amber-400">Not Rooted</span>}
                  {rootStatus === 'unknown' && <span className="text-slate-500">Unverified</span>}
                </div>
                {(rootDetails.hasMagisk || rootDetails.hasSuperSU || rootDetails.hasXposed) && (
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-cyan-300">
                    {rootDetails.hasMagisk && <span>[Magisk]</span>}
                    {rootDetails.hasSuperSU && <span>[SuperSU]</span>}
                    {rootDetails.hasXposed && <span>[Xposed]</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 md:col-span-2">
            {!selectedDevice ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Select an authorized Android device to inspect or configure root access.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300">Root Method</label>
                  <select
                    value={rootMethod}
                    onChange={(e) => setRootMethod(e.target.value as RootMethod)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="magisk">Magisk (Systemless Boot Image Patch)</option>
                    <option value="supersu">SuperSU (Legacy Recovery Binary)</option>
                    <option value="xposed">Xposed / LSPosed Framework</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Confirmation Gate (Type <span className="font-mono text-amber-300">ROOT</span>)
                  </label>
                  <input
                    type="text"
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    placeholder="ROOT"
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isExecuting || confirmationInput.trim() !== 'ROOT' || !passcode}
                    onClick={() => void handleInstall()}
                    className="rounded bg-cyan-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-cyan-500"
                  >
                    {isExecuting ? 'Executing…' : 'Execute Root Preparation'}
                  </button>
                  <button
                    type="button"
                    disabled={!passcode}
                    onClick={() => void checkRootStatus()}
                    className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Verify Root Status
                  </button>
                </div>

                {error && (
                  <div className="rounded border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300">
                    {error}
                  </div>
                )}

                {operationComplete && (
                  <div className="rounded border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-300">
                    Root installation workflow prepared and logged to Shadow Archive.
                  </div>
                )}

                {logs.length > 0 && (
                  <div className="rounded border border-slate-800 bg-black/50 p-3 font-mono text-[11px] text-slate-300">
                    {logs.map((entry, idx) => (
                      <div key={idx} className="leading-5">
                        <span className="text-slate-500">[{entry.timestamp}]</span>{' '}
                        <span className="uppercase text-cyan-400">{entry.level}:</span> {entry.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
