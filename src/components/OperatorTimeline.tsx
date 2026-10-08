import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

type DeviceHotplugEvent = {
  type: string;
  device_uid: string;
  platform_hint: string;
  mode: string;
  confidence: number;
  timestamp: string;
  display_name: string;
  matched_tool_ids: string[];
  evidence_source: string;
};

type DeviceEventEnvelope = {
  type: string;
  event: DeviceHotplugEvent;
};

type TimelineEntry = {
  key: string;
  event: DeviceHotplugEvent;
};

function eventTone(type: string): string {
  if (type === 'connected') return 'border-emerald-900 bg-emerald-950/20 text-emerald-300';
  if (type === 'disconnected') return 'border-red-950 bg-red-950/20 text-red-300';
  return 'border-slate-800 bg-slate-950/60 text-slate-300';
}

export default function OperatorTimeline() {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    let alive = true;
    let unlisten: (() => void) | undefined;

    void listen<DeviceEventEnvelope>('device-events', (message) => {
      if (!alive || !message.payload?.event) return;
      const event = message.payload.event;
      setEntries((current) => {
        const next = [
          {
            key: event.timestamp + ':' + event.type + ':' + event.device_uid,
            event,
          },
          ...current,
        ];
        return next.slice(0, 40);
      });
    }).then((fn) => {
      if (alive) unlisten = fn;
      else fn();
    });

    return () => {
      alive = false;
      unlisten?.();
    };
  }, []);

  return (
    <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-500">
            Live operator timeline
          </div>
          <h2 className="mt-1 text-sm font-semibold text-white">USB connection and recovery-mode events</h2>
          <p className="mt-1 text-xs text-slate-500">
            Native event stream from BobFWTools&apos; USB monitor. No simulated device events.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEntries([])}
          className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
        >
          Clear timeline
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="mt-4 rounded border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-600">
          Waiting for a USB connection or disconnect event…
        </div>
      ) : (
        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
          {entries.map(({ key, event }) => (
            <div key={key} className={'rounded border p-3 ' + eventTone(event.type)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide">{event.type}</span>
                  <span className="text-sm font-medium text-white">{event.display_name}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-600">{event.timestamp}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span>mode: <b className="font-mono text-slate-300">{event.mode}</b></span>
                <span>platform: <b className="font-mono text-slate-300">{event.platform_hint}</b></span>
                <span>confidence: {Math.round(event.confidence * 100)}%</span>
              </div>
              <div className="mt-1 truncate font-mono text-[10px] text-slate-600" title={event.device_uid}>
                {event.device_uid} · {event.evidence_source}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
