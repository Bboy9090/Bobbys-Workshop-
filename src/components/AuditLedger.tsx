import { useEffect, useState } from 'react';
import { getAuditLogPath, getRecentAuditEvents, type AuditEvent } from '../lib/desktop';

function tone(risk: string): string {
  if (risk === 'destructive' || risk === 'restricted') return 'text-red-300';
  if (risk === 'elevated') return 'text-amber-300';
  if (risk === 'low') return 'text-cyan-300';
  return 'text-slate-400';
}

export default function AuditLedger() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [recent, logPath] = await Promise.all([
          getRecentAuditEvents(100),
          getAuditLogPath(),
        ]);
        if (cancelled) return;
        setEvents(recent);
        setPath(logPath);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-500">
            Persistent audit ledger
          </div>
          <h2 className="mt-1 text-sm font-semibold text-white">Repair evidence that survives the session</h2>
          <p className="mt-1 max-w-3xl text-xs text-slate-500">
            Structured JSONL evidence for observed device events and, as executors are qualified, preflight/approval/write/verification stages.
          </p>
        </div>
        <div className="max-w-xl truncate rounded border border-slate-800 bg-slate-950/70 px-3 py-2 font-mono text-[10px] text-slate-500" title={path}>
          {path || 'audit path unavailable'}
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-900 bg-red-950/20 p-3 text-xs text-red-300">{error}</div>
      )}

      {events.length === 0 ? (
        <div className="mt-4 rounded border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-600">
          No durable audit events recorded yet.
        </div>
      ) : (
        <div className="mt-4 max-h-80 overflow-y-auto rounded border border-slate-800">
          {events.map((event, index) => (
            <div key={event.timestampMs + ':' + event.action + ':' + index} className="border-b border-slate-800 bg-slate-950/50 px-3 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-900 px-2 py-1 text-[10px] text-slate-400">{event.category}</span>
                  <span className="font-mono text-xs text-white">{event.action}</span>
                  <span className={'text-[10px] font-medium ' + tone(event.risk)}>{event.risk}</span>
                  <span className="text-[10px] text-slate-500">{event.status}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-600">{event.timestampMs}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">{event.detail}</div>
              {event.deviceUid && (
                <div className="mt-1 truncate font-mono text-[10px] text-slate-600" title={event.deviceUid}>
                  {event.deviceUid}
                </div>
              )}
              {event.evidence.length > 0 && (
                <div className="mt-1 truncate text-[10px] text-slate-600" title={event.evidence.join(' · ')}>
                  {event.evidence.join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
