import React, { useEffect, useMemo, useState } from 'react';
import { Thermometer, Cpu, Zap, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

type RigTelemetry = {
  cpu_load: number | null;
  cpu_temp: number | null;
  ram_usage: number | null;
  usb_pressure: number;
  status: 'STABLE' | 'WARN' | 'CRITICAL' | string;
};

function getFastApiUrl(): string {
  // Vite way
  const vite = (import.meta as any)?.env?.VITE_FASTAPI_URL;
  if (vite) return vite;

  // Some files in this repo still use process.env; keep compatibility.
  const proc = (globalThis as any)?.process?.env?.VITE_FASTAPI_URL;
  if (proc) return proc;

  return 'http://127.0.0.1:8000';
}

export function RigHealthDashboard({ passcode, className }: { passcode?: string; className?: string }) {
  const [connected, setConnected] = useState(false);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [stats, setStats] = useState<RigTelemetry>({
    cpu_load: null,
    cpu_temp: null,
    ram_usage: null,
    usb_pressure: 0,
    status: 'STABLE',
  });

  const wsUrl = useMemo(() => {
    const base = getFastApiUrl().replace('http', 'ws');
    return `${base}/api/v1/trapdoor/pandora/hardware/stream`;
  }, []);

  useEffect(() => {
    if (!passcode) return;

    let ws: WebSocket | null = new WebSocket(wsUrl);
    let closed = false;

    ws.onopen = () => {
      setConnected(true);
      ws?.send(JSON.stringify({ type: 'auth', passcode }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === 'rig_telemetry' && msg?.data) {
          setStats(msg.data);
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => setConnected(false);
    ws.onclose = () => {
      setConnected(false);
      ws = null;
      if (closed) return;
      // reconnect
      window.setTimeout(() => {
        if (!closed) {
          setReconnectNonce((n) => n + 1);
        }
      }, 3000);
    };

    return () => {
      closed = true;
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [passcode, wsUrl, reconnectNonce]);

  const getStatusColor = (val: number | null, limit: number) =>
    val !== null && val > limit ? 'text-state-danger animate-pulse' : 'text-spray-cyan';

  return (
    <div className={cn("p-3 bg-workbench-steel border-t border-panel flex items-center gap-8 text-[10px] font-mono uppercase", className)}>
      <div className="flex items-center gap-2">
        <Cpu className="w-3.5 h-3.5 text-ink-muted" />
        <span className="text-ink-muted">CPU:</span>
        <span className={getStatusColor(stats.cpu_load, 80)}>{stats.cpu_load ?? '--'}{stats.cpu_load !== null ? '%' : ''}</span>
      </div>

      <div className="flex items-center gap-2">
        <Thermometer className="w-3.5 h-3.5 text-ink-muted" />
        <span className="text-ink-muted">TEMP:</span>
        <span className={getStatusColor(stats.cpu_temp, 75)}>{stats.cpu_temp ?? '--'}{stats.cpu_temp !== null ? '°C' : ''}</span>
      </div>

      <div className="flex items-center gap-2">
        <HardDrive className="w-3.5 h-3.5 text-ink-muted" />
        <span className="text-ink-muted">RAM:</span>
        <span>{stats.ram_usage ?? '--'}{stats.ram_usage !== null ? '%' : ''}</span>
      </div>

      <div className="flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-ink-muted" />
        <span className="text-ink-muted">USB LOAD:</span>
        <span className={getStatusColor(stats.usb_pressure, 90)}>{stats.usb_pressure}%</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            connected ? "bg-state-ready glow-cyan" : "bg-state-danger"
          )}
        />
        <span className={stats.status === 'STABLE' ? 'text-state-ready' : stats.status === 'WARN' ? 'text-tape-yellow' : 'text-state-danger'}>
          {connected ? `SYSTEM_${stats.status}` : 'TELEMETRY_OFFLINE'}
        </span>
      </div>
    </div>
  );
}

