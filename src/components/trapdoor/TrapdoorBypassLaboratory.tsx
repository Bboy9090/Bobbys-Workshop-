/**
 * TrapdoorBypassLaboratory
 * 
 * Security bypass operations interface
 */

import React, { useState } from 'react';
import { Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

interface TrapdoorBypassLaboratoryProps {
  passcode?: string;
  devices?: Device[];
  className?: string;
}

export function TrapdoorBypassLaboratory({
  passcode,
  devices = [],
  className,
}: TrapdoorBypassLaboratoryProps) {
  const { backendAvailable } = useApp();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [operation, setOperation] = useState<'screenlock' | 'mdm'>('screenlock');
  const [bypassConfirmation, setBypassConfirmation] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [operationComplete, setOperationComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredBypassText = operation === 'screenlock' ? 'BYPASS' : 'REMOVE';
  const canProceed = 
    selectedDevice &&
    bypassConfirmation === requiredBypassText &&
    !isExecuting &&
    backendAvailable &&
    passcode;

  const handleExecute = async () => {
    if (!selectedDevice || !passcode || !canProceed) return;

    setIsExecuting(true);
    setError(null);
    setLogs([]);
    setOperationComplete(false);

    const endpoint = operation === 'screenlock' 
      ? '/api/v1/trapdoor/bypass/screenlock'
      : '/api/v1/trapdoor/bypass/mdm';

    setLogs([{
      id: '1',
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `[BYPASS] Starting ${operation} bypass for device: ${selectedDevice.serial}`,
      source: 'bypass-laboratory',
    }]);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          deviceSerial: selectedDevice.serial,
          confirmation: bypassConfirmation,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const envelope = await response.json();

      if (!envelope.ok) {
        throw new Error(envelope.error?.message || 'Bypass operation failed');
      }

      if (envelope.data?.logs) {
        const streamLogs: LogEntry[] = envelope.data.logs.map((log: any, idx: number) => ({
          id: `log-${idx}`,
          timestamp: log.timestamp || new Date().toISOString(),
          level: log.level || 'info',
          message: log.message || log.text || JSON.stringify(log),
          source: 'bypass-laboratory',
        }));
        setLogs(streamLogs);
      }

      setOperationComplete(true);
      setLogs(prev => [...prev, {
        id: 'success',
        timestamp: new Date().toISOString(),
        level: 'success',
        message: `[BYPASS] ${operation} bypass completed successfully`,
        source: 'bypass-laboratory',
      }]);
    } catch (err) {
      console.error('[TrapdoorBypassLaboratory] Execution error:', err);
      setError(err instanceof Error ? err.message : 'Operation failed');
      setLogs(prev => [...prev, {
        id: 'error',
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `[BYPASS] Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        source: 'bypass-laboratory',
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
            <Wrench className="w-5 h-5 text-state-danger" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-primary font-mono">
              Bypass Laboratory
            </h1>
            <p className="text-xs text-ink-muted">
              Security bypasses & unlocks
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
            This operation is for owner devices only. Unauthorized use is illegal.
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
                Bypass Operation
              </label>
              <select
                value={operation}
                onChange={(e) => {
                  setOperation(e.target.value as any);
                  setBypassConfirmation('');
                }}
                className="w-full px-4 py-3 rounded-lg bg-workbench-steel border border-panel text-ink-primary font-mono text-sm focus:outline-none focus:border-spray-cyan focus:glow-cyan transition-all motion-snap"
              >
                <option value="screenlock">Screen Lock Bypass</option>
                <option value="mdm">MDM Removal</option>
              </select>
            </div>

            <TrapdoorInstructionsPanel
              title={`${operation === 'screenlock' ? 'Screen Lock' : 'MDM'} Bypass Instructions & Requirements`}
              description={`Complete guide for ${operation === 'screenlock' ? 'screen lock bypass' : 'MDM removal'}`}
              prerequisites={operation === 'screenlock' ? [
                'Device must have root access OR be in recovery mode',
                'ADB debugging enabled (if using ADB method)',
                'Backup device data before proceeding',
                'This operation is for owner devices only'
              ] : [
                'Device admin access OR recovery mode access',
                'MDM profile must be removable (some are permanent)',
                'Backup device data before proceeding',
                'This operation is for authorized device owners only'
              ]}
              requiredFiles={operation === 'screenlock' ? [
                {
                  name: 'ADB & Fastboot',
                  description: 'Android SDK Platform Tools',
                  downloadUrl: 'https://developer.android.com/tools/releases/platform-tools',
                  required: true
                },
                {
                  name: 'Custom Recovery (Optional)',
                  description: 'TWRP or compatible recovery for recovery mode method',
                  downloadUrl: 'https://twrp.me/Devices/',
                  required: false
                }
              ] : [
                {
                  name: 'ADB & Fastboot',
                  description: 'Android SDK Platform Tools',
                  downloadUrl: 'https://developer.android.com/tools/releases/platform-tools',
                  required: true
                }
              ]}
              steps={operation === 'screenlock' ? [
                {
                  number: 1,
                  title: 'Check Root Access',
                  description: 'Verify device has root access or boot to recovery mode',
                  command: 'adb shell su -c id'
                },
                {
                  number: 2,
                  title: 'Method A: Root Access',
                  description: 'If device is rooted, remove locksettings database',
                  command: 'adb shell su -c "rm /data/system/locksettings.db"'
                },
                {
                  number: 3,
                  title: 'Method B: Recovery Mode',
                  description: 'If no root, boot to recovery and use file manager to delete locksettings.db',
                  command: 'adb reboot recovery'
                },
                {
                  number: 4,
                  title: 'Clear Lock Pattern',
                  description: 'Remove additional lock files if present',
                  command: 'adb shell su -c "rm /data/system/locksettings.db-wal"'
                },
                {
                  number: 5,
                  title: 'Reboot Device',
                  description: 'Reboot device and verify screen lock is removed',
                  command: 'adb reboot'
                }
              ] : [
                {
                  number: 1,
                  title: 'Check MDM Status',
                  description: 'Identify MDM profile and device admin apps',
                  command: 'adb shell pm list packages | grep mdm'
                },
                {
                  number: 2,
                  title: 'Method A: Device Settings',
                  description: 'Go to Settings > Security > Device admin apps, disable MDM',
                  warning: 'Some MDM profiles cannot be removed this way'
                },
                {
                  number: 3,
                  title: 'Method B: Recovery Mode',
                  description: 'Boot to recovery, perform factory reset (erases all data)',
                  command: 'adb reboot recovery'
                },
                {
                  number: 4,
                  title: 'Method C: ADB (Root Required)',
                  description: 'If rooted, remove MDM package',
                  command: 'adb shell su -c "pm uninstall -k --user 0 com.mdm.package"'
                },
                {
                  number: 5,
                  title: 'Verify Removal',
                  description: 'Check device admin apps to confirm MDM is removed'
                }
              ]}
              warnings={operation === 'screenlock' ? [
                'This operation is for owner devices only',
                'Unauthorized bypass is illegal',
                'May require root access or recovery mode',
                'Backup device before proceeding'
              ] : [
                'MDM removal is only authorized for device owners',
                'Unauthorized removal is illegal',
                'Some MDM profiles are permanent and cannot be removed',
                'Factory reset will erase all data',
                'Backup device before proceeding'
              ]}
            />

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-ink-muted">
                Type "{requiredBypassText}" to confirm
              </label>
              <input
                type="text"
                value={bypassConfirmation}
                onChange={(e) => setBypassConfirmation(e.target.value)}
                placeholder={requiredBypassText}
                className={cn(
                  "w-full px-4 py-3 rounded-lg bg-workbench-steel border font-mono text-sm",
                  "text-ink-primary placeholder:text-ink-muted",
                  "focus:outline-none transition-all motion-snap",
                  bypassConfirmation === requiredBypassText
                    ? "border-state-ready focus:border-state-ready"
                    : bypassConfirmation.length > 0
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
                    Bypass Operation Complete
                  </span>
                </div>
              </div>
            )}

            <ToolboxDangerLever
              onConfirm={handleExecute}
              disabled={!canProceed}
              label={`HOLD TO ${operation === 'screenlock' ? 'BYPASS SCREEN LOCK' : 'REMOVE MDM'}`}
              warning={operation === 'screenlock' 
                ? 'This operation is for owner devices only. Unauthorized use is illegal.'
                : 'MDM removal is only authorized for device owners. Unauthorized removal is illegal.'}
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
