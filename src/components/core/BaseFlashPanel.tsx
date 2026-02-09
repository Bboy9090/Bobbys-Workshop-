/**
 * Base Flash Panel Component
 * 
 * Provides common functionality for all flash panel implementations.
 * Reduces code duplication across MediaTek, Samsung Odin, Fastboot, Xiaomi EDL, etc.
 */

import { useState, useEffect, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { API_CONFIG } from '@/lib/apiConfig';

export interface BaseDevice {
  id: string;
  name: string;
  serial?: string;
  port?: string;
  mode?: string;
  detected: boolean;
}

export interface BaseFlashJob {
  jobId: string;
  deviceId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  stage: string;
  error?: string;
}

export interface BaseFlashPanelProps<TDevice extends BaseDevice, TJob extends BaseFlashJob> {
  title: string;
  description: string;
  scanEndpoint: string;
  flashEndpoint: string;
  deviceType: string;
  icon?: ReactNode;
  additionalControls?: ReactNode;
  onDeviceSelected?: (device: TDevice | null) => void;
  onJobStatusChange?: (job: TJob | null) => void;
}

export interface BaseFlashPanelState<TDevice extends BaseDevice, TJob extends BaseFlashJob> {
  devices: TDevice[];
  selectedDevice: TDevice | null;
  isScanning: boolean;
  currentJob: TJob | null;
  error: string | null;
}

/**
 * Base hook for flash panel logic
 */
export function useBaseFlashPanel<TDevice extends BaseDevice, TJob extends BaseFlashJob>(
  scanEndpoint: string,
  deviceType: string
) {
  const [devices, setDevices] = useState<TDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<TDevice | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [currentJob, setCurrentJob] = useState<TJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scanDevices = async () => {
    setIsScanning(true);
    setError(null);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${scanEndpoint}`);
      if (response.ok) {
        const data = await response.json();
        if (data.devices && data.devices.length > 0) {
          setDevices(data.devices);
          toast.success(`${deviceType} device scan complete`, {
            description: `Found ${data.devices.length} device(s)`,
          });
        } else {
          setDevices([]);
          toast.info(`No ${deviceType} devices found`);
        }
      } else {
        throw new Error('Backend unavailable');
      }
    } catch (err) {
      console.error(`[${deviceType}FlashPanel] Scan failed:`, err);
      const errorMessage = err instanceof Error ? err.message : 'Backend unavailable';
      toast.error('Failed to scan devices', {
        description: errorMessage,
      });
      setError(errorMessage);
      setDevices([]);
    } finally {
      setIsScanning(false);
    }
  };

  const selectDevice = (device: TDevice | null) => {
    setSelectedDevice(device);
  };

  const updateJob = (job: TJob | null) => {
    setCurrentJob(job);
  };

  return {
    devices,
    selectedDevice,
    isScanning,
    currentJob,
    error,
    scanDevices,
    selectDevice,
    updateJob,
  };
}

/**
 * Common device scanning controls
 */
export interface DeviceScanControlsProps {
  isScanning: boolean;
  deviceCount: number;
  onScan: () => void;
  deviceType: string;
}

export function DeviceScanControls({ isScanning, deviceCount, onScan, deviceType }: DeviceScanControlsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Badge variant={deviceCount > 0 ? 'default' : 'secondary'}>
          {deviceCount} {deviceType} {deviceCount === 1 ? 'device' : 'devices'}
        </Badge>
      </div>
      <Button onClick={onScan} disabled={isScanning} size="sm">
        {isScanning ? 'Scanning...' : 'Scan Devices'}
      </Button>
    </div>
  );
}

/**
 * Common progress display
 */
export interface FlashProgressDisplayProps {
  job: BaseFlashJob;
  showLogs?: boolean;
}

export function FlashProgressDisplay({ job, showLogs = false }: FlashProgressDisplayProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{job.stage}</span>
          <span className="text-sm text-muted-foreground">{job.progress}%</span>
        </div>
        <Progress value={job.progress} />
      </div>
      
      <Badge variant={
        job.status === 'completed' ? 'default' :
        job.status === 'failed' ? 'destructive' :
        job.status === 'running' ? 'default' : 'secondary'
      }>
        {job.status}
      </Badge>

      {job.error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{job.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
