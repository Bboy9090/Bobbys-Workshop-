/**
 * Pandora Codex Chain-Breaker Dashboard
 * 
 * Main UI for hardware manipulation and jailbreak operations.
 * Night-Ops theme: jet black #050505, neon amber #FFB000, matrix green #00FF41
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/app-context';
import { DevicePulse } from './DevicePulse';
import { ConsoleLog } from './ConsoleLog';
import { ExploitSelector } from './ExploitSelector';
import { SafetyInterlock } from './SafetyInterlock';
import { RigHealthDashboard } from '../RigHealthDashboard';

interface ChainBreakerDashboardProps {
  passcode?: string;
  className?: string;
}

export function ChainBreakerDashboard({
  passcode,
  className,
}: ChainBreakerDashboardProps) {
  const { backendAvailable } = useApp();
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [logs, setLogs] = useState<Array<{ id: string; timestamp: string; level: string; message: string }>>([]);
  const [wsConnected, setWsConnected] = useState(false);

  const FASTAPI_URL =
    (import.meta as any).env?.VITE_FASTAPI_URL ||
    (globalThis as any).process?.env?.VITE_FASTAPI_URL ||
    'http://127.0.0.1:8000';
  const WS_URL = FASTAPI_URL.replace('http', 'ws');

  const addLog = useCallback((level: string, message: string) => {
    setLogs(prev => [...prev, {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      level,
      message
    }]);
  }, []);

  const scanDevices = useCallback(async () => {
    if (!passcode) return;

    try {
      const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/pandora/hardware/status`, {
        headers: {
          'X-Secret-Room-Passcode': passcode,
        },
      });

      const data = await response.json();
      if (data.ok && data.data) {
        setDevices([
          ...(data.data.usb_devices || []),
          ...(data.data.dfu_devices || []),
        ]);
      }
    } catch (error) {
      toast.error('Device scan failed', {
        description: error instanceof Error ? error.message : 'Failed to scan for devices'
      });
    }
  }, [FASTAPI_URL, passcode]);

  useEffect(() => {
    if (!passcode || !backendAvailable) return;

    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(`${WS_URL}/api/v1/trapdoor/pandora/hardware/stream`);

      ws.onopen = () => {
        setWsConnected(true);
        addLog('info', 'Connected to hardware stream');
        ws?.send(JSON.stringify({ type: 'auth', passcode }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'devices' || data.type === 'update') {
            setDevices(data.data || []);
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
        addLog('error', 'WebSocket connection error');
      };

      ws.onclose = () => {
        setWsConnected(false);
        addLog('warn', 'WebSocket disconnected');
        if (!closed) setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      closed = true;
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [passcode, backendAvailable, WS_URL, scanDevices, addLog]);

  const handleEnterDFU = async () => {
    if (!selectedDevice || !passcode) return;

    addLog('info', `DFU mode entry is manual. Pulling instructions for ${selectedDevice.id}...`);

    try {
      const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/pandora/enter-dfu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          device_id: selectedDevice.id,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        addLog('success', 'DFU instructions ready. Follow steps, then re-scan to confirm DFU mode.');
        const instructions: string[] = data.data?.instructions || [];
        if (instructions.length) {
          addLog('info', '--- DFU Instructions ---');
          for (const step of instructions) addLog('info', step);
          addLog('info', '--- End Instructions ---');
        }
        scanDevices();
      } else {
        addLog('error', `DFU entry failed: ${data.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      addLog('error', `DFU entry error: ${(error as Error).message}`);
    }
  };

  const handleJailbreak = async (exploit: string) => {
    addLog('warn', `Operation disabled in this build: ${exploit}`);
    toast.error('Operation disabled', {
      description: 'This build focuses on DFU detection + safety telemetry.'
    });
  };

  return (
    <div className={cn("flex h-full bg-[#050505] text-[#00FF41] pb-16", className)}>
      {/* Left Sidebar - Device Info */}
      <div className="w-80 border-r border-[#FFB000]/30 bg-[#0a0a0a]">
        <div className="p-4 border-b border-[#FFB000]/30">
          <div className="flex items-center gap-2 mb-2">
            <Box className="w-5 h-5 text-[#00FF41]" />
            <h2 className="text-lg font-bold text-[#00FF41]">Chain-Breaker</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              wsConnected ? "bg-[#00FF41]" : "bg-[#FFB000]"
            )} />
            <span className="text-xs text-[#FFB000]">
              {wsConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>

        <DevicePulse
          devices={devices}
          selectedDevice={selectedDevice}
          onSelectDevice={setSelectedDevice}
        />
      </div>

      {/* Center - Console Log */}
      <div className="flex-1 flex flex-col">
        <ConsoleLog logs={logs} />
      </div>

      {/* Right Sidebar - Exploit Menu */}
      <div className="w-80 border-l border-[#FFB000]/30 bg-[#0a0a0a]">
        <div className="p-4 border-b border-[#FFB000]/30">
          <h2 className="text-lg font-bold text-[#00FF41]">DFU Tools</h2>
        </div>

        <div className="p-4 space-y-4">
          <ExploitSelector
            selectedDevice={selectedDevice}
            onSelectExploit={handleJailbreak}
          />

          {selectedDevice && (
            <div className="space-y-2">
              <SafetyInterlock
                onConfirm={handleEnterDFU}
                label="Show DFU Instructions"
                warning="DFU entry is manual (hardware buttons). Hold to reveal steps, then re-scan to confirm DFU mode."
              />
            </div>
          )}
        </div>
      </div>

      {/* Rig health cockpit */}
      <div className="fixed bottom-0 left-0 right-0">
        <RigHealthDashboard passcode={passcode} className="border-t border-[#FFB000]/30" />
      </div>
    </div>
  );
}
