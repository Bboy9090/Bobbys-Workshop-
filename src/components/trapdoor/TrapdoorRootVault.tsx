/**
 * TrapdoorRootVault
 * 
 * Root installation and management interface
 */

import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TerminalLogStream, LogEntry } from '../core/TerminalLogStream';
import { ToolboxDangerLever } from '../toolbox/ToolboxDangerLever';
import { DeviceIcon } from '../core/DeviceIcon';
import { TrapdoorInstructionsPanel } from './TrapdoorInstructionsPanel';
import { useApp } from '@/lib/app-context';

interface Device {
  serial: string;
  brand: string;
  model: string;
  state: string;
  platform?: string;
}

interface TrapdoorRootVaultProps {
  passcode?: string;
  devices?: Device[];
  className?: string;
}

export function TrapdoorRootVault({
  passcode,
  devices = [],
  className,
}: TrapdoorRootVaultProps) {
  const { backendAvailable } = useApp();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [method, setMethod] = useState<'magisk' | 'supersu' | 'custom'>('magisk');
  const [rootConfirmation, setRootConfirmation] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [operationComplete, setOperationComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredRootText = 'ROOT';
  const canProceed = 
    selectedDevice &&
    rootConfirmation === requiredRootText &&
    !isExecuting &&
    backendAvailable &&
    passcode;

  const handleExecute = async () => {
    if (!selectedDevice || !passcode || !canProceed) return;

    setIsExecuting(true);
    setError(null);
    setLogs([]);
    setOperationComplete(false);

    setLogs([{
      id: '1',
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `[ROOT] Starting ${method} root installation for device: ${selectedDevice.serial}`,
      source: 'root-vault',
    }]);

    try {
      const response = await fetch('/api/v1/trapdoor/root/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          deviceSerial: selectedDevice.serial,
          method,
          confirmation: rootConfirmation,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const envelope = await response.json();

      if (!envelope.ok) {
        throw new Error(envelope.error?.message || 'Root installation failed');
      }

      if (envelope.data?.logs) {
        const streamLogs: LogEntry[] = envelope.data.logs.map((log: any, idx: number) => ({
          id: `log-${idx}`,
          timestamp: log.timestamp || new Date().toISOString(),
          level: log.level || 'info',
          message: log.message || log.text || JSON.stringify(log),
          source: 'root-vault',
        }));
        setLogs(streamLogs);
      }

      setOperationComplete(true);
      setLogs(prev => [...prev, {
        id: 'success',
        timestamp: new Date().toISOString(),
        level: 'success',
        message: '[ROOT] Root installation completed successfully',
        source: 'root-vault',
      }]);
    } catch (err) {
      console.error('[TrapdoorRootVault] Execution error:', err);
      setError(err instanceof Error ? err.message : 'Operation failed');
      setLogs(prev => [...prev, {
        id: 'error',
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `[ROOT] Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        source: 'root-vault',
      }]);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className={cn("h-full flex flex-col bg-basement-concrete", className)}>
      <div className="p-4 border-b border-panel bg-basement-concrete">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg border border-state-danger/50 bg-state-danger/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-state-danger" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-primary font-mono">
              Root Vault
            </h1>
            <p className="text-xs text-ink-muted">
              Root installation & management
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg border-2 border-state-danger/50 bg-state-danger/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-state-danger" />
            <span className="text-lg font-bold text-state-danger font-mono uppercase tracking-wider">
              DANGEROUS OPERATION
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-2">
            Rooting may void warranty and can cause security issues.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-mono uppercase tracking-wider text-ink-muted">
            Select Device
          </h3>
          {devices.length === 0 ? (
            <div className="p-4 rounded-lg border border-panel bg-workbench-steel text-center text-ink-muted">
              <p className="text-sm">No devices available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {devices.map((device) => (
                <button
                  key={device.serial}
                  onClick={() => setSelectedDevice(device)}
                  className={cn(
                    "p-3 rounded-lg border transition-all motion-snap text-left",
                    "flex items-center gap-3",
                    selectedDevice?.serial === device.serial
                      ? "bg-workbench-steel border-spray-cyan glow-cyan"
                      : "bg-basement-concrete border-panel hover:border-spray-cyan/50"
                  )}
                >
                  <DeviceIcon platform={device.platform} className="w-6 h-6" size={24} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-ink-primary truncate">
                      {device.serial}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {device.brand} {device.model}
                    </p>
                  </div>
                  {selectedDevice?.serial === device.serial && (
                    <CheckCircle2 className="w-5 h-5 text-spray-cyan shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedDevice && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-ink-muted">
                Root Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full px-4 py-3 rounded-lg bg-workbench-steel border border-panel text-ink-primary font-mono text-sm focus:outline-none focus:border-spray-cyan focus:glow-cyan transition-all motion-snap"
              >
                <option value="magisk">Magisk</option>
                <option value="supersu">SuperSU</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <TrapdoorInstructionsPanel
              title="Root Installation Instructions & Requirements"
              description={`Complete guide for ${method} root installation`}
              prerequisites={[
                'Bootloader must be unlocked (use Unlock Chamber first)',
                'Custom recovery installed (TWRP recommended)',
                'Backup all important data',
                'Device must be charged (50%+ recommended)'
              ]}
              requiredFiles={method === 'magisk' ? [
                {
                  name: 'Magisk ZIP',
                  description: 'Latest Magisk ZIP file for installation',
                  downloadUrl: 'https://github.com/topjohnwu/Magisk/releases',
                  required: true
                },
                {
                  name: 'TWRP Recovery',
                  description: 'TWRP recovery image for your device model',
                  downloadUrl: 'https://twrp.me/Devices/',
                  required: true
                },
                {
                  name: 'ADB & Fastboot',
                  description: 'Android SDK Platform Tools',
                  downloadUrl: 'https://developer.android.com/tools/releases/platform-tools',
                  required: true
                }
              ] : method === 'supersu' ? [
                {
                  name: 'SuperSU ZIP',
                  description: 'SuperSU ZIP file (legacy - use Magisk for newer devices)',
                  downloadUrl: 'https://supersu.com/',
                  required: true
                },
                {
                  name: 'TWRP Recovery',
                  description: 'TWRP recovery image for your device model',
                  downloadUrl: 'https://twrp.me/Devices/',
                  required: true
                },
                {
                  name: 'ADB & Fastboot',
                  description: 'Android SDK Platform Tools',
                  downloadUrl: 'https://developer.android.com/tools/releases/platform-tools',
                  required: true
                }
              ] : [
                {
                  name: 'Custom Root Package',
                  description: 'Device-specific root package (ZIP format)',
                  downloadUrl: 'https://forum.xda-developers.com/',
                  required: true
                },
                {
                  name: 'Custom Recovery',
                  description: 'Recovery image compatible with your device',
                  downloadUrl: 'https://forum.xda-developers.com/',
                  required: true
                }
              ]}
              steps={[
                {
                  number: 1,
                  title: 'Unlock Bootloader',
                  description: 'Use Unlock Chamber to unlock bootloader first (required)'
                },
                {
                  number: 2,
                  title: 'Install Custom Recovery',
                  description: 'Flash TWRP or compatible recovery to device',
                  command: 'fastboot flash recovery twrp.img\nfastboot reboot recovery'
                },
                {
                  number: 3,
                  title: 'Download Root Package',
                  description: `Download ${method === 'magisk' ? 'Magisk' : method === 'supersu' ? 'SuperSU' : 'custom root'} ZIP file to device storage or computer`
                },
                {
                  number: 4,
                  title: 'Boot to Recovery',
                  description: 'Power off device, boot to recovery mode (Volume Up + Power)',
                  command: 'Or use: adb reboot recovery'
                },
                {
                  number: 5,
                  title: 'Flash Root Package',
                  description: 'In recovery: Install > Select ZIP > Flash > Reboot',
                  warning: 'Do not reboot to system before flashing completes!'
                },
                {
                  number: 6,
                  title: 'Verify Root',
                  description: 'After reboot, install root checker app to verify root access',
                  command: 'adb shell su -c id'
                }
              ]}
              warnings={[
                'Rooting may void warranty',
                'Some apps may detect root and refuse to run',
                'Incorrect root package can brick device',
                'Keep device charged during process',
                'Backup device before rooting'
              ]}
            />

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-ink-muted">
                Type "{requiredRootText}" to confirm
              </label>
              <input
                type="text"
                value={rootConfirmation}
                onChange={(e) => setRootConfirmation(e.target.value)}
                placeholder={requiredRootText}
                className={cn(
                  "w-full px-4 py-3 rounded-lg bg-workbench-steel border font-mono text-sm",
                  "text-ink-primary placeholder:text-ink-muted",
                  "focus:outline-none transition-all motion-snap",
                  rootConfirmation === requiredRootText
                    ? "border-state-ready focus:border-state-ready"
                    : rootConfirmation.length > 0
                    ? "border-state-danger focus:border-state-danger"
                    : "border-panel focus:border-spray-cyan focus:glow-cyan"
                )}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg border border-state-danger/50 bg-state-danger/10">
                <p className="text-sm text-state-danger font-mono">{error}</p>
              </div>
            )}

            {operationComplete && (
              <div className="p-4 rounded-lg border border-state-ready/50 bg-state-ready/10">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-state-ready" />
                  <span className="text-sm font-bold text-state-ready font-mono">
                    Root Installation Complete
                  </span>
                </div>
              </div>
            )}

            <ToolboxDangerLever
              onConfirm={handleExecute}
              disabled={!canProceed}
              label="HOLD TO INSTALL ROOT"
              warning="Rooting may void warranty and can cause security issues. Requires unlocked bootloader and custom recovery."
            />

            {logs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-mono uppercase tracking-wider text-ink-muted">
                  Execution Logs
                </h3>
                <div className="h-64 rounded-lg border border-panel overflow-hidden">
                  <TerminalLogStream
                    logs={logs}
                    maxLines={100}
                    autoScroll={true}
                    className="h-full"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
