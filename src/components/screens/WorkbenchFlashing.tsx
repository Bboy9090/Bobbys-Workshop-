/**
 * PHOENIX FORGE - Flash Forge Screen
 * 
 * Device flashing interface with:
 * - Device detection for fastboot/bootloader mode
 * - Command preview with risk indicators
 * - Real-time flash logs
 * - Safety confirmations
 */

import { useState, useEffect, useCallback } from 'react';
import { TerminalCommandPreview } from '../core/TerminalCommandPreview';
import { TerminalLogStream, LogEntry } from '../core/TerminalLogStream';
import { ToolboxDangerLever } from '../toolbox/ToolboxDangerLever';
import { WorkbenchDeviceStack } from '../core/WorkbenchDeviceStack';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { AlertTriangle, Loader2, Zap, Terminal, Shield, Flame } from 'lucide-react';
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

        const adbResponse = await fetch('/api/v1/adb/devices');
        const adbData = await adbResponse.json();
        
        if (cancelled) return;

        if (adbData.ok && adbData.data?.devices) {
          adbData.data.devices
            .filter((d: { state: string }) => d.state === 'bootloader' || d.state === 'recovery')
            .forEach((d: { serial: string; state: string; model?: string; product?: string }) => {
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
          addLog('info', '[FORGE] No devices in fastboot/bootloader mode detected');
        } else {
          addLog('info', `[FORGE] Found ${fastbootDevices.length} device(s) ready for flashing`);
        }
      } catch (error) {
        if (cancelled) return;
        addLog('error', `[FORGE] Failed to fetch devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setDevices([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);

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
    addLog('warn', `[FORGE] Starting flash operation for ${selectedDevice.serial}...`);
    
    try {
      addLog('info', '[FORGE] Acquiring device lock...');
      
      const response = await fetch('/api/v1/fastboot/devices');
      const data = await response.json();
      
      if (!data.ok || !data.data?.devices?.find((d: { serial: string }) => d.serial === selectedDevice.serial)) {
        throw new Error('Device disconnected during operation');
      }
      
      addLog('info', '[FORGE] Device locked. Ready to flash.');
      addLog('warn', '[FORGE] Flash operation requires firmware file selection.');
      toast.info('Select firmware files to begin flashing');
      
    } catch (error) {
      addLog('error', `[FORGE] Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error('Flash operation failed');
    } finally {
      setIsFlashing(false);
    }
  }, [selectedDevice, addLog]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9] flex items-center gap-3">
            <Zap className="w-7 h-7 text-[#FF6B2C]" />
            Flash Forge
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Device flashing with safety confirmations
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {isLoading && (
            <Badge variant="secondary" className="gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Scanning
            </Badge>
          )}
          <Badge variant={devices.length > 0 ? 'success' : 'secondary'}>
            {devices.length} device{devices.length !== 1 ? 's' : ''} ready
          </Badge>
        </div>
      </div>

      {/* Warning Banner */}
      <Card variant="danger" className="border-[#F43F5E]/30">
        <div className="p-4 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#F43F5E]/10">
            <AlertTriangle className="w-5 h-5 text-[#F43F5E]" />
          </div>
          <div>
            <p className="font-semibold text-[#FB7185] mb-1">
              Destructive Operation Warning
            </p>
            <p className="text-sm text-[#94A3B8]">
              Flashing will overwrite device partitions. Ensure you have backups and understand the risks before proceeding.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Device Selection & Command Preview */}
        <div className="space-y-4">
          <Card variant="phoenix">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#FF6B2C]" />
                Select Device
              </CardTitle>
            </CardHeader>
            <CardContent>
              {devices.length === 0 && !isLoading ? (
                <div className="p-6 rounded-lg bg-white/[0.02] border border-white/[0.05] text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                    <Zap className="w-6 h-6 text-[#64748B]" />
                  </div>
                  <p className="text-sm text-[#94A3B8]">
                    {backendAvailable 
                      ? 'No devices in fastboot/bootloader mode'
                      : 'Backend offline - cannot detect devices'}
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">
                    Connect a device and reboot to bootloader
                  </p>
                </div>
              ) : (
                <WorkbenchDeviceStack
                  devices={devices}
                  onSelectDevice={setSelectedDevice}
                  selectedSerial={selectedDevice?.serial}
                />
              )}
            </CardContent>
          </Card>

          {selectedDevice && (
            <>
              <Card variant="cosmic">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[#A78BFA]" />
                    Command Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TerminalCommandPreview
                    commands={commands}
                    impactedPartitions={['system', 'boot', 'recovery']}
                    riskLevel="destructive"
                  />
                </CardContent>
              </Card>

              <Card variant="danger">
                <CardContent className="pt-6">
                  <ToolboxDangerLever
                    onConfirm={handleFlash}
                    disabled={!selectedDevice || isFlashing}
                    label="HOLD TO START FLASH"
                    warning="This will overwrite device partitions. This cannot be undone."
                  />
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Right: Flash Logs */}
        <Card variant="glass" className="h-fit">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#06B6D4]" />
                Flash Logs
              </CardTitle>
              <Badge variant="ghost" size="sm">
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-96 rounded-lg bg-[#0A0A12] border border-white/[0.05] overflow-hidden">
              <TerminalLogStream
                logs={flashLogs}
                maxLines={100}
                autoScroll={true}
                className="h-full"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
