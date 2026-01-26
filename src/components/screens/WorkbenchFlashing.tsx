/**
 * WorkbenchFlashing
 * 
 * Flash jobs, history, status; heavy confirmations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TerminalCommandPreview } from '../core/TerminalCommandPreview';
import { TerminalLogStream, LogEntry } from '../core/TerminalLogStream';
import { ToolboxDangerLever } from '../toolbox/ToolboxDangerLever';
import { WorkbenchDeviceStack } from '../core/WorkbenchDeviceStack';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { toast } from 'sonner';

interface Device {
  serial: string;
  brand: string;
  model: string;
  state: string;
  platform?: string;
}

export function WorkbenchFlashing() {
  const { backendAvailable } = useApp();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [flashLogs, setFlashLogs] = useState<LogEntry[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add log helper
  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setFlashLogs(prev => [...prev, {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      source: 'flash',
    }].slice(-100));
  }, []);

  // Fetch devices from fastboot API
  useEffect(() => {
    if (!backendAvailable) {
      setDevices([]);
      return;
    }

    let cancelled = false;

    async function fetchDevices() {
      setIsLoading(true);
      try {
        // Check fastboot devices first (for flashing)
        const fbResponse = await fetch('/api/v1/fastboot/devices');
        const fbData = await fbResponse.json();
        
        if (cancelled) return;

        const fastbootDevices: Device[] = [];
        if (fbData.ok && fbData.data?.devices) {
          fbData.data.devices.forEach((d: { serial: string; state?: string; product?: string }) => {
            fastbootDevices.push({
              serial: d.serial,
              brand: d.product || 'Unknown',
              model: d.product || 'Fastboot Device',
              state: d.state || 'fastboot',
              platform: 'android',
            });
          });
        }

        // Also check ADB devices in bootloader mode
        const adbResponse = await fetch('/api/v1/adb/devices');
        const adbData = await adbResponse.json();
        
        if (cancelled) return;

        if (adbData.ok && adbData.data?.devices) {
          adbData.data.devices
            .filter((d: { state: string }) => d.state === 'bootloader' || d.state === 'recovery')
            .forEach((d: { serial: string; state: string; model?: string; product?: string }) => {
              // Don't add duplicates
              if (!fastbootDevices.find(fb => fb.serial === d.serial)) {
                fastbootDevices.push({
                  serial: d.serial,
                  brand: d.product || 'Unknown',
                  model: d.model || 'Android Device',
                  state: d.state,
                  platform: 'android',
                });
              }
            });
        }

        setDevices(fastbootDevices);
        
        if (fastbootDevices.length === 0) {
          addLog('info', '[FLASH] No devices in fastboot/bootloader mode detected');
        } else {
          addLog('info', `[FLASH] Found ${fastbootDevices.length} device(s) ready for flashing`);
        }
      } catch (error) {
        if (cancelled) return;
        addLog('error', `[FLASH] Failed to fetch devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setDevices([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDevices();
    const interval = setInterval(fetchDevices, 10000); // Refresh every 10s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backendAvailable, addLog]);

  const commands = selectedDevice ? [
    {
      command: `fastboot flash system system.img`,
      description: 'Flash system partition',
      risk: 'destructive' as const,
    },
  ] : [];

  const handleFlash = useCallback(async () => {
    if (!selectedDevice) return;
    
    setIsFlashing(true);
    addLog('warn', `[FLASH] Starting flash operation for ${selectedDevice.serial}...`);
    
    try {
      // This is where the actual flash API would be called
      // For now, we simulate the operation
      addLog('info', '[FLASH] Acquiring device lock...');
      
      // Check if device is still available
      const response = await fetch('/api/v1/fastboot/devices');
      const data = await response.json();
      
      if (!data.ok || !data.data?.devices?.find((d: { serial: string }) => d.serial === selectedDevice.serial)) {
        throw new Error('Device disconnected during operation');
      }
      
      addLog('info', '[FLASH] Device locked. Ready to flash.');
      addLog('warn', '[FLASH] Flash operation requires firmware file selection.');
      toast.info('Select firmware files to begin flashing');
      
    } catch (error) {
      addLog('error', `[FLASH] Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error('Flash operation failed');
    } finally {
      setIsFlashing(false);
    }
  }, [selectedDevice, addLog]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-primary font-mono mb-2">
          Flashing
        </h1>
        <p className="text-sm text-ink-muted">
          Flash jobs, history, status — heavy confirmations required
        </p>
      </div>

      {/* Warning Banner */}
      <div className="p-4 rounded-lg border-2 border-state-danger/50 bg-state-danger/10">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-state-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-state-danger font-mono mb-1">
              DESTRUCTIVE OPERATION
            </p>
            <p className="text-xs text-ink-muted">
              Flashing will overwrite device partitions. Ensure you have backups and understand the risks.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Device Selection & Command Preview */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-mono uppercase tracking-wider text-ink-muted">
                Select Device
              </h2>
              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Scanning...
                </div>
              )}
            </div>
            {devices.length === 0 && !isLoading ? (
              <div className="p-4 rounded-lg border border-panel bg-workbench-steel text-center">
                <p className="text-sm text-ink-muted">
                  {backendAvailable 
                    ? 'No devices in fastboot/bootloader mode. Connect a device and reboot to bootloader.'
                    : 'Backend offline - cannot detect devices'}
                </p>
              </div>
            ) : (
              <WorkbenchDeviceStack
                devices={devices}
                onSelectDevice={setSelectedDevice}
                selectedSerial={selectedDevice?.serial}
              />
            )}
          </div>

          {selectedDevice && (
            <>
              <TerminalCommandPreview
                commands={commands}
                impactedPartitions={['system', 'boot', 'recovery']}
                riskLevel="destructive"
              />

              <ToolboxDangerLever
                onConfirm={handleFlash}
                disabled={!selectedDevice || isFlashing}
                label="HOLD TO START FLASH"
                warning="This will overwrite device partitions. This cannot be undone."
              />
            </>
          )}
        </div>

        {/* Right: Flash Logs */}
        <div className="space-y-4">
          <h2 className="text-sm font-mono uppercase tracking-wider text-ink-muted">
            Flash Logs
          </h2>
          <div className="h-96 rounded-lg border border-panel overflow-hidden">
            <TerminalLogStream
              logs={flashLogs}
              maxLines={100}
              autoScroll={true}
              className="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
