/**
 * TrapdoorFlashForge
 * 
 * Multi-brand flash operations interface
 */

import React, { useState } from 'react';
import { Flashlight, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TerminalCommandPreview } from '../core/TerminalCommandPreview';
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

interface TrapdoorFlashForgeProps {
  passcode?: string;
  devices?: Device[];
  className?: string;
}

export function TrapdoorFlashForge({
  passcode,
  devices = [],
  className,
}: TrapdoorFlashForgeProps) {
  const { backendAvailable } = useApp();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [brand, setBrand] = useState<'samsung' | 'mediatek' | 'qualcomm' | 'generic'>('samsung');
  const [flashConfirmation, setFlashConfirmation] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [operationComplete, setOperationComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredFlashText = 'FLASH';
  const canProceed = 
    selectedDevice &&
    flashConfirmation === requiredFlashText &&
    !isExecuting &&
    backendAvailable &&
    passcode;

  const commands = selectedDevice ? [
    {
      command: brand === 'samsung' ? 'odin3 --flash firmware.tar' : 
               brand === 'mediatek' ? 'sp_flash_tool --flash firmware.bin' :
               brand === 'qualcomm' ? 'edl --flash firmware.img' :
               'fastboot flash system firmware.img',
      description: `Flash firmware (${brand})`,
      risk: 'destructive' as const,
    },
  ] : [];

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
      message: `[FLASH] Starting ${brand} flash for device: ${selectedDevice.serial}`,
      source: 'flash-forge',
    }]);

    try {
      const response = await fetch('/api/v1/trapdoor/flash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          deviceSerial: selectedDevice.serial,
          brand,
          confirmation: flashConfirmation,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const envelope = await response.json();

      if (!envelope.ok) {
        throw new Error(envelope.error?.message || 'Flash operation failed');
      }

      if (envelope.data?.logs) {
        const streamLogs: LogEntry[] = envelope.data.logs.map((log: any, idx: number) => ({
          id: `log-${idx}`,
          timestamp: log.timestamp || new Date().toISOString(),
          level: log.level || 'info',
          message: log.message || log.text || JSON.stringify(log),
          source: 'flash-forge',
        }));
        setLogs(streamLogs);
      }

      setOperationComplete(true);
      setLogs(prev => [...prev, {
        id: 'success',
        timestamp: new Date().toISOString(),
        level: 'success',
        message: '[FLASH] Flash operation completed successfully',
        source: 'flash-forge',
      }]);
    } catch (err) {
      console.error('[TrapdoorFlashForge] Execution error:', err);
      setError(err instanceof Error ? err.message : 'Operation failed');
      setLogs(prev => [...prev, {
        id: 'error',
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `[FLASH] Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        source: 'flash-forge',
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
            <Flashlight className="w-5 h-5 text-state-danger" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-primary font-mono">
              Flash Forge
            </h1>
            <p className="text-xs text-ink-muted">
              Multi-brand flash operations
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
            This will overwrite device firmware. All data will be lost.
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
                Select Brand
              </label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value as any)}
                className="w-full px-4 py-3 rounded-lg bg-workbench-steel border border-panel text-ink-primary font-mono text-sm focus:outline-none focus:border-spray-cyan focus:glow-cyan transition-all motion-snap"
              >
                <option value="samsung">Samsung (Odin)</option>
                <option value="mediatek">MediaTek (SP Flash)</option>
                <option value="qualcomm">Qualcomm (EDL)</option>
                <option value="generic">Generic (Fastboot)</option>
              </select>
            </div>

            <TerminalCommandPreview
              commands={commands}
              impactedPartitions={['system', 'boot', 'recovery', 'userdata']}
              riskLevel="destructive"
              expectedOutput="... OKAY\n... finished. total time: 5.234s"
            />

            <TrapdoorInstructionsPanel
              title="Flash Instructions & Requirements"
              description={`Complete guide for ${brand} firmware flashing`}
              prerequisites={[
                'Device must be in correct mode (Download Mode for Samsung, Fastboot for others)',
                'Firmware files must be downloaded and ready',
                'USB drivers installed for your device',
                'Backup all important data (operation will erase device)'
              ]}
              requiredFiles={brand === 'samsung' ? [
                {
                  name: 'Odin3 Tool',
                  description: 'Samsung Odin flashing tool (latest version)',
                  downloadUrl: 'https://odindownload.com/',
                  required: true
                },
                {
                  name: 'Firmware Files',
                  description: 'AP, BL, CP, CSC tar files for your device model',
                  downloadUrl: 'https://www.sammobile.com/firmwares/',
                  required: true
                },
                {
                  name: 'Samsung USB Drivers',
                  description: 'Samsung USB drivers for Windows',
                  downloadUrl: 'https://developer.samsung.com/mobile/android-usb-driver.html',
                  required: true
                }
              ] : brand === 'mediatek' ? [
                {
                  name: 'SP Flash Tool',
                  description: 'MediaTek SP Flash Tool (latest version)',
                  downloadUrl: 'https://spflashtool.com/',
                  required: true
                },
                {
                  name: 'Firmware Files',
                  description: 'Scatter file and firmware images for your device',
                  downloadUrl: 'https://firmwarefile.com/',
                  required: true
                },
                {
                  name: 'MediaTek USB Drivers',
                  description: 'MediaTek USB VCOM drivers',
                  downloadUrl: 'https://androidmtk.com/download-mtk-usb-driver',
                  required: true
                }
              ] : brand === 'qualcomm' ? [
                {
                  name: 'EDL Tool',
                  description: 'Qualcomm EDL flashing tool (QPST, QFIL, or EDL Tool)',
                  downloadUrl: 'https://qpsttool.com/',
                  required: true
                },
                {
                  name: 'Firehose Programmer',
                  description: 'Device-specific firehose programmer file (.mbn)',
                  downloadUrl: 'https://firmwarefile.com/',
                  required: true
                },
                {
                  name: 'Qualcomm USB Drivers',
                  description: 'Qualcomm HS-USB QDLoader drivers',
                  downloadUrl: 'https://qpsttool.com/qualcomm-usb-driver/',
                  required: true
                }
              ] : [
                {
                  name: 'Fastboot Tool',
                  description: 'Android SDK Platform Tools (includes fastboot)',
                  downloadUrl: 'https://developer.android.com/tools/releases/platform-tools',
                  required: true
                },
                {
                  name: 'Firmware Images',
                  description: 'Boot, system, recovery images for your device',
                  downloadUrl: 'https://source.android.com/docs/core/architecture/bootloader',
                  required: true
                }
              ]}
              steps={brand === 'samsung' ? [
                {
                  number: 1,
                  title: 'Download Required Files',
                  description: 'Download Odin3, firmware files (AP, BL, CP, CSC), and Samsung USB drivers'
                },
                {
                  number: 2,
                  title: 'Install USB Drivers',
                  description: 'Install Samsung USB drivers and restart computer if needed'
                },
                {
                  number: 3,
                  title: 'Enter Download Mode',
                  description: 'Power off device, then hold Volume Down + Home + Power (or Volume Down + Bixby + Power on newer devices)',
                  command: 'Or use: adb reboot download'
                },
                {
                  number: 4,
                  title: 'Open Odin3',
                  description: 'Run Odin3 as Administrator, connect device via USB'
                },
                {
                  number: 5,
                  title: 'Load Firmware Files',
                  description: 'Click AP/BL/CP/CSC buttons and select corresponding tar files'
                },
                {
                  number: 6,
                  title: 'Start Flash',
                  description: 'Click Start button in Odin3. Wait for completion (device will reboot)',
                  warning: 'Do not disconnect device during flash process!'
                }
              ] : brand === 'mediatek' ? [
                {
                  number: 1,
                  title: 'Download SP Flash Tool',
                  description: 'Download and extract SP Flash Tool, download firmware files'
                },
                {
                  number: 2,
                  title: 'Install MediaTek Drivers',
                  description: 'Install MediaTek USB VCOM drivers, disable driver signature enforcement if needed'
                },
                {
                  number: 3,
                  title: 'Enter Download Mode',
                  description: 'Power off device, connect via USB while holding Volume Down (or use ADB)',
                  command: 'adb reboot bootloader'
                },
                {
                  number: 4,
                  title: 'Open SP Flash Tool',
                  description: 'Run SP Flash Tool, click Scatter-loading, select scatter file from firmware'
                },
                {
                  number: 5,
                  title: 'Configure Flash',
                  description: 'Select partitions to flash, choose Download Only mode'
                },
                {
                  number: 6,
                  title: 'Start Flash',
                  description: 'Click Download button, wait for completion',
                  warning: 'Device must stay in Download Mode throughout process!'
                }
              ] : brand === 'qualcomm' ? [
                {
                  number: 1,
                  title: 'Download EDL Tools',
                  description: 'Download QPST/QFIL or EDL Tool, download firehose programmer file'
                },
                {
                  number: 2,
                  title: 'Install Qualcomm Drivers',
                  description: 'Install Qualcomm HS-USB QDLoader drivers'
                },
                {
                  number: 3,
                  title: 'Enter EDL Mode',
                  description: 'Power off device, hold Volume Up + Volume Down, connect USB cable',
                  command: 'Or use: adb reboot edl'
                },
                {
                  number: 4,
                  title: 'Open EDL Tool',
                  description: 'Run EDL Tool/QFIL, device should appear as Qualcomm HS-USB QDLoader'
                },
                {
                  number: 5,
                  title: 'Load Firehose',
                  description: 'Load firehose programmer file (.mbn), select partitions to flash'
                },
                {
                  number: 6,
                  title: 'Start Flash',
                  description: 'Click Download/Flash button, wait for completion',
                  warning: 'EDL mode is critical - do not disconnect!'
                }
              ] : [
                {
                  number: 1,
                  title: 'Download Platform Tools',
                  description: 'Download Android SDK Platform Tools (includes fastboot)'
                },
                {
                  number: 2,
                  title: 'Download Firmware',
                  description: 'Download boot, system, recovery images for your device model'
                },
                {
                  number: 3,
                  title: 'Enter Fastboot Mode',
                  description: 'Enable USB debugging, reboot to bootloader',
                  command: 'adb reboot bootloader'
                },
                {
                  number: 4,
                  title: 'Verify Connection',
                  description: 'Check device is detected in fastboot mode',
                  command: 'fastboot devices'
                },
                {
                  number: 5,
                  title: 'Flash Partitions',
                  description: 'Flash each partition using fastboot flash command',
                  command: 'fastboot flash system system.img\nfastboot flash boot boot.img\nfastboot flash recovery recovery.img'
                },
                {
                  number: 6,
                  title: 'Reboot Device',
                  description: 'Reboot device after flashing completes',
                  command: 'fastboot reboot'
                }
              ]}
              warnings={[
                'This operation will erase all data on the device',
                'Ensure firmware matches your exact device model',
                'Do not disconnect device during flash process',
                'Incorrect firmware can permanently brick your device'
              ]}
            />

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-ink-muted">
                Type "{requiredFlashText}" to confirm flash
              </label>
              <input
                type="text"
                value={flashConfirmation}
                onChange={(e) => setFlashConfirmation(e.target.value)}
                placeholder={requiredFlashText}
                className={cn(
                  "w-full px-4 py-3 rounded-lg bg-workbench-steel border font-mono text-sm",
                  "text-ink-primary placeholder:text-ink-muted",
                  "focus:outline-none transition-all motion-snap",
                  flashConfirmation === requiredFlashText
                    ? "border-state-ready focus:border-state-ready"
                    : flashConfirmation.length > 0
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
                    Flash Operation Complete
                  </span>
                </div>
              </div>
            )}

            <ToolboxDangerLever
              onConfirm={handleExecute}
              disabled={!canProceed}
              label="HOLD TO FLASH FIRMWARE"
              warning="This will overwrite device firmware. All data will be lost. This cannot be undone."
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
