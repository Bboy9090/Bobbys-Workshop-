import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  API_BASE,
  createCase,
  getCaseAudit,
  getDeviceScan,
  postCaseIntake,
  postOwnershipVerification,
  triggerBackupAuth,
  type ScanDevice,
} from './lib/api';

type LogLine = { ts: string; level: 'info' | 'warn' | 'error'; message: string };

function pushLog(set: Dispatch<SetStateAction<LogLine[]>>, level: LogLine['level'], message: string) {
  set((prev) => [...prev.slice(-200), { ts: new Date().toISOString(), level, message }]);
}

function badgeForDevice(d: ScanDevice): string {
  const m = (d.mode || '').toLowerCase();
  if (m.includes('unauthorized')) return 'Fix USB debugging authorization on the device';
  if (m === 'offline') return 'Device offline — check cable and ADB';
  if (m === 'bootloader') return 'Bootloader mode — avoid OS-level actions until you confirm intent';
  return '';
}

export default function App() {
  const [devices, setDevices] = useState<ScanDevice[]>([]);
  const [toolsHint, setToolsHint] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [pollEnabled, setPollEnabled] = useState(true);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [caseTitle, setCaseTitle] = useState('');
  const [caseNotes, setCaseNotes] = useState('');
  const [ownershipChecked, setOwnershipChecked] = useState(false);
  const [ownershipPhrase, setOwnershipPhrase] = useState('');
  const [auditSummary, setAuditSummary] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([
    { ts: new Date().toISOString(), level: 'info', message: "Bobby's Workshop UI ready. Waiting for backend…" },
  ]);

  const selected = useMemo(
    () => devices.find((d) => d.device_uid === selectedUid) ?? null,
    [devices, selectedUid]
  );

  const refreshDevices = useCallback(async () => {
    const env = await getDeviceScan();
    if (!env.ok || !env.data) {
      setBackendOk(false);
      pushLog(
        setLogs,
        'error',
        env.error?.message || 'Device scan failed — is the workshop API running on port 3001?'
      );
      setDevices([]);
      return;
    }
    setBackendOk(true);
    setDevices(env.data.devices || []);
    const adb = env.data.tools?.adb;
    const fb = env.data.tools?.fastboot;
    if (adb && !adb.installed) {
      setToolsHint('ADB not found on PATH. Install platform-tools and restart the app.');
    } else if (fb && !fb.installed) {
      setToolsHint('Fastboot not found on PATH. Install platform-tools for bootloader workflows.');
    } else {
      setToolsHint(null);
    }
    if (!selectedUid && env.data.devices?.length) {
      setSelectedUid(env.data.devices[0].device_uid);
    }
  }, [selectedUid]);

  useEffect(() => {
    const boot = window.setTimeout(() => {
      void refreshDevices();
    }, 0);
    if (!pollEnabled) {
      return () => window.clearTimeout(boot);
    }
    const id = window.setInterval(() => {
      void refreshDevices();
    }, 2500);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(id);
    };
  }, [pollEnabled, refreshDevices]);

  const openCase = async () => {
    const env = await createCase({
      title: caseTitle.trim() || undefined,
      notes: caseNotes.trim() || undefined,
      userId: 'workshop-station',
    });
    if (!env.ok || !env.data?.case) {
      pushLog(setLogs, 'error', env.error?.message || 'Could not create case');
      return;
    }
    setActiveCaseId(env.data.case.id);
    pushLog(setLogs, 'info', `Case opened: ${env.data.case.id}`);
  };

  const runIntake = async () => {
    if (!activeCaseId || !selected) {
      pushLog(setLogs, 'warn', 'Select a device and open a case before intake');
      return;
    }
    const env = await postCaseIntake(activeCaseId, {
      platform: selected.platform_hint,
      connectionState: selected.mode,
      deviceInfo: {
        device_uid: selected.device_uid,
        display_name: selected.display_name,
        evidence: selected.evidence,
        correlation_badge: selected.correlation_badge,
      },
    });
    if (!env.ok) {
      pushLog(setLogs, 'error', env.error?.message || 'Intake failed');
      return;
    }
    pushLog(setLogs, 'info', 'Read-only intake recorded for active case');
  };

  const runOwnership = async () => {
    if (!activeCaseId) {
      pushLog(setLogs, 'warn', 'Open a case first');
      return;
    }
    const env = await postOwnershipVerification(activeCaseId, {
      checkboxConfirmed: ownershipChecked,
      typedPhrase: ownershipPhrase.trim(),
    });
    if (!env.ok) {
      pushLog(setLogs, 'error', env.error?.message || 'Ownership attestation failed');
      return;
    }
    pushLog(setLogs, 'info', 'Ownership / authorization to service attestation recorded');
  };

  const loadAudit = async () => {
    if (!activeCaseId) return;
    const env = await getCaseAudit(activeCaseId);
    if (!env.ok || !env.data) {
      pushLog(setLogs, 'error', env.error?.message || 'Could not load audit');
      return;
    }
    const stats = env.data.statistics as { totalEvents?: number } | undefined;
    setAuditSummary(
      `Events: ${stats?.totalEvents ?? (env.data.events?.length || 0)} (see server audit logs for full chain)`
    );
    pushLog(setLogs, 'info', 'Audit summary refreshed');
  };

  const requestBackupPrompt = async () => {
    if (!selected?.evidence || (selected.evidence as { source?: string }).source !== 'adb') {
      pushLog(setLogs, 'warn', 'Select an ADB-connected device (normal Android OS) for backup authorization');
      return;
    }
    const serial = (selected.evidence as { serial?: string }).serial;
    if (!serial) {
      pushLog(setLogs, 'error', 'No serial on selected device');
      return;
    }
    const env = await triggerBackupAuth(serial);
    if (!env.ok) {
      pushLog(setLogs, 'error', env.error?.message || 'Backup authorization request failed');
      return;
    }
    pushLog(setLogs, 'info', 'Backup authorization flow triggered — watch the device for prompts');
  };

  const selectedTip = selected ? badgeForDevice(selected) : '';

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-200">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">Bobby&apos;s Workshop</h1>
          <p className="text-xs text-slate-500">
            API: {API_BASE}{' '}
            {backendOk === null ? '· checking…' : backendOk ? '· connected' : '· offline'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={pollEnabled}
              onChange={(e) => setPollEnabled(e.target.checked)}
              className="rounded border-slate-600"
            />
            Auto-refresh devices
          </label>
          <button
            type="button"
            onClick={() => refreshDevices()}
            className="rounded bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-500"
          >
            Scan now
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-900/80 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Device queue</h2>
          {toolsHint && (
            <div className="mb-3 rounded border border-amber-800 bg-amber-950/40 p-2 text-xs text-amber-200">
              {toolsHint}
            </div>
          )}
          {devices.length === 0 ? (
            <p className="text-sm text-slate-500">No devices detected. Connect USB and enable debugging.</p>
          ) : (
            <ul className="space-y-2">
              {devices.map((d) => (
                <li key={d.device_uid}>
                  <button
                    type="button"
                    onClick={() => setSelectedUid(d.device_uid)}
                    className={`w-full rounded border p-3 text-left text-sm transition-colors ${
                      d.device_uid === selectedUid
                        ? 'border-orange-500 bg-slate-800'
                        : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-medium text-white">{d.display_name || d.device_uid}</div>
                    <div className="mt-1 font-mono text-xs text-cyan-400/90">{d.mode}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{d.platform_hint}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-slate-800 bg-slate-900/50 p-4">
            <h2 className="text-sm font-semibold text-white">Repair case</h2>
            <p className="mt-1 text-xs text-slate-500">
              Intake and ownership attestation are logged for compliance. Destructive work belongs in guided
              workflows after attestation.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Ticket / customer label (optional)"
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                value={caseNotes}
                onChange={(e) => setCaseNotes(e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openCase}
                className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600"
              >
                New case
              </button>
              <span className="self-center text-xs text-slate-500">
                Active: {activeCaseId || 'none'}
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {selectedTip && (
              <div className="mb-4 rounded border border-cyan-900/60 bg-cyan-950/30 p-3 text-sm text-cyan-100">
                {selectedTip}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="text-sm font-semibold text-white">1. Read-only intake</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Captures current connection state and identifiers without flashing or unlocking.
                </p>
                <button
                  type="button"
                  onClick={runIntake}
                  disabled={!activeCaseId || !selected}
                  className="mt-4 w-full rounded bg-cyan-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-cyan-600"
                >
                  Record intake for selected device
                </button>
              </section>

              <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="text-sm font-semibold text-white">2. Service authorization</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Required before sensitive operations. Typed phrase must match exactly.
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ownershipChecked}
                    onChange={(e) => setOwnershipChecked(e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  I own this device or have written permission to service it.
                </label>
                <input
                  type="text"
                  placeholder='Type: I CONFIRM AUTHORIZED SERVICE'
                  value={ownershipPhrase}
                  onChange={(e) => setOwnershipPhrase(e.target.value)}
                  className="mt-3 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={runOwnership}
                  disabled={!activeCaseId}
                  className="mt-3 w-full rounded bg-violet-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-violet-600"
                  >
                  Record attestation
                </button>
              </section>

              <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="text-sm font-semibold text-white">3. Safe Android prompts</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Triggers ADB backup authorization so the customer can approve on-device (no exploit payloads).
                </p>
                <button
                  type="button"
                  onClick={requestBackupPrompt}
                  className="mt-4 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Request backup authorization (ADB)
                </button>
              </section>

              <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="text-sm font-semibold text-white">Audit visibility</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Case-scoped events are written under the server audit log directory.
                </p>
                <button
                  type="button"
                  onClick={loadAudit}
                  disabled={!activeCaseId}
                  className="mt-4 w-full rounded bg-slate-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-slate-600"
                >
                  Refresh audit summary
                </button>
                {auditSummary && <p className="mt-3 text-xs text-slate-400">{auditSummary}</p>}
              </section>
            </div>
          </div>

          <div className="h-44 shrink-0 overflow-y-auto border-t border-slate-800 bg-black px-3 py-2 font-mono text-xs">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">Activity</div>
            {logs.map((l, i) => (
              <div
                key={`${l.ts}-${i}`}
                className={
                  l.level === 'error'
                    ? 'text-red-400'
                    : l.level === 'warn'
                      ? 'text-amber-300'
                      : 'text-slate-400'
                }
              >
                <span className="text-slate-600">{l.ts.slice(11, 23)}</span> {l.message}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
