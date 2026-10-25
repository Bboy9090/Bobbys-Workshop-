import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  launchTargetDeviceAction,
  scanAdbDevices,
  type TargetActionToken,
} from '../lib/desktop';

type TargetBinding = {
  serial: string;
};

const ACTIONS: { token: TargetActionToken; label: string }[] = [
  { token: 'samsung_internet', label: 'Open Samsung Internet' },
  { token: 'youtube', label: 'Open YouTube' },
  { token: 'google_maps', label: 'Open Google Maps' },
  { token: 'galaxy_store', label: 'Open Galaxy Store' },
];

export default function AdvancedDeviceActionsWindow() {
  const [serial, setSerial] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState<TargetActionToken | null>(null);
  const [status, setStatus] = useState('Waiting for an authorized target.');

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<TargetBinding>('advanced-device-target', async (event) => {
      if (disposed) return;
      const nextSerial = event.payload.serial?.trim() || '';
      setSerial(nextSerial);
      setAuthorized(false);
      setStatus('Revalidating target authorization…');

      try {
        const devices = await scanAdbDevices();
        const ok = devices.some((device) => device.serial === nextSerial && device.authorized);
        if (!disposed) {
          setAuthorized(ok);
          setStatus(ok ? 'Target authorized. Choose an explicit action.' : 'Target is no longer ADB-authorized.');
        }
      } catch (error) {
        if (!disposed) {
          setAuthorized(false);
          setStatus(error instanceof Error ? error.message : String(error));
        }
      }
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const run = async (action: TargetActionToken) => {
    if (!serial || !authorized || busy) return;
    setBusy(action);
    setStatus('Dispatching allowlisted intent to the selected device…');
    try {
      const result = await launchTargetDeviceAction(serial, action);
      setStatus(result.message);
    } catch (error) {
      setAuthorized(false);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold">Advanced Device Actions</h1>
            <div className="mt-2 text-xs text-slate-400">
              Target: <span className="font-mono text-amber-300">{serial || 'None bound'}</span>
            </div>
            <div className="mt-1 text-xs">
              ADB: <span className={authorized ? 'font-semibold text-emerald-400' : 'font-semibold text-rose-400'}>
                {authorized ? 'Authorized' : 'Unavailable'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void getCurrentWindow().hide()}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Hide
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          {ACTIONS.map(({ token, label }) => (
            <button
              key={token}
              type="button"
              disabled={!authorized || !!busy}
              onClick={() => void run(token)}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-white disabled:opacity-40 hover:bg-slate-700"
            >
              {busy === token ? 'Opening…' : label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded border border-slate-800 bg-black/30 p-3 text-xs leading-5 text-slate-400">
          {status}
        </div>
        <p className="mt-3 text-[10px] leading-4 text-slate-600">
          Actions are fixed allowlisted Android intents. BobFWTools revalidates the exact ADB serial before every launch.
        </p>
      </div>
    </div>
  );
}
