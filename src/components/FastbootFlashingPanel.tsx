import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlashProgressMonitor, type FlashProgress } from './FlashProgressMonitor';
import { ConfirmationDialog } from './ConfirmationDialog';
import { 
  Upload, 
  ArrowClockwise, 
  LockKey,
  LockKeyOpen,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Warning,
  Circle,
  FloppyDisk,
  Cpu,
  Info,
  Lightning,
  Trash,
  DeviceMobile
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useKV } from '@github/spark/hooks';
import type { AndroidDevice } from '@/types/android-devices';
import { useAudioNotifications } from '@/hooks/use-audio-notifications';
import { API_CONFIG, getAPIUrl } from '@/lib/apiConfig';
import { DeviceStateGuide } from './DeviceStateGuide';

interface PartitionInfo {
  name: string;
  displayName: string;
  description: string;
  critical: boolean;
  category: 'bootloader' | 'firmware' | 'system' | 'data' | 'other';
}

interface FlashOperation {
  id: string;
  device: string;
  partition: string;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'flashing' | 'success' | 'failed';
  progress: number;
  startTime: number;
  endTime?: number;
  error?: string;
}

const PARTITIONS: PartitionInfo[] = [
  { name: 'boot', displayName: 'Boot', description: 'Kernel and ramdisk', critical: true, category: 'bootloader' },
  { name: 'recovery', displayName: 'Recovery', description: 'Recovery partition', critical: false, category: 'bootloader' },
  { name: 'system', displayName: 'System', description: 'Android system image', critical: true, category: 'system' },
  { name: 'vendor', displayName: 'Vendor', description: 'Vendor-specific files', critical: true, category: 'system' },
  { name: 'userdata', displayName: 'Userdata', description: 'User data and apps', critical: false, category: 'data' },
  { name: 'cache', displayName: 'Cache', description: 'System cache', critical: false, category: 'data' },
  { name: 'bootloader', displayName: 'Bootloader', description: 'Primary bootloader', critical: true, category: 'bootloader' },
  { name: 'radio', displayName: 'Radio/Modem', description: 'Baseband firmware', critical: true, category: 'firmware' },
  { name: 'aboot', displayName: 'ABooot', description: 'Application bootloader', critical: true, category: 'bootloader' },
  { name: 'vbmeta', displayName: 'VBMeta', description: 'Verified boot metadata', critical: true, category: 'bootloader' },
  { name: 'dtbo', displayName: 'DTBO', description: 'Device tree overlays', critical: false, category: 'firmware' },
  { name: 'persist', displayName: 'Persist', description: 'Persistent data partition', critical: false, category: 'other' },
];

export function FastbootFlashingPanel() {
  const [devices, setDevices] = useState<AndroidDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [selectedPartition, setSelectedPartition] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [operations, setOperations] = useKV<FlashOperation[]>('fastboot-flash-history', []);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [currentProgress, setCurrentProgress] = useState<FlashProgress | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const { handleJobStart, handleJobError, handleJobComplete } = useAudioNotifications();
  
  // Confirmation dialog states
  const [showFlashConfirm, setShowFlashConfirm] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);
  const [pendingFlash, setPendingFlash] = useState<(() => void) | null>(null);
  const [pendingUnlock, setPendingUnlock] = useState<(() => void) | null>(null);
  const [pendingErase, setPendingErase] = useState<{ partition: string; execute: () => void } | null>(null);
  
  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      fetchDeviceInfo(selectedDevice);
    }
  }, [selectedDevice]);

  const fetchDevices = async () => {
    try {
      const response = await fetch(getAPIUrl(API_CONFIG.ENDPOINTS.FASTBOOT_DEVICES));
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices.map((d: any) => ({
          ...d,
          id: `fastboot-${d.serial}`,
          source: 'fastboot' as const
        })));
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  const fetchDeviceInfo = async (serial: string) => {
    try {
      const response = await fetch(`${getAPIUrl(API_CONFIG.ENDPOINTS.FASTBOOT_DEVICE_INFO)}?serial=${serial}`);
      if (response.ok) {
        const data = await response.json();
        setDeviceInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch device info:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.img') || file.name.endsWith('.bin')) {
        setSelectedFile(file);
        toast.success(`Selected: ${file.name}`);
      } else {
        toast.error('Please select a .img or .bin file');
      }
    }
  };

  const handleFlash = async () => {
    if (!selectedDevice || !selectedPartition || !selectedFile) {
      toast.error('Please select device, partition, and file');
      return;
    }

    // Store the flash function and show confirmation dialog
    setPendingFlash(() => async () => {
      await executeFlash();
    });
    setShowFlashConfirm(true);
  };

  const executeFlash = async () => {
    if (!selectedDevice || !selectedPartition || !selectedFile) {
      return;
    }

    setLoading(true);
    const operationId = `flash-${Date.now()}`;
    const operation: FlashOperation = {
      id: operationId,
      device: selectedDevice,
      partition: selectedPartition,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      status: 'flashing',
      progress: 0,
      startTime: Date.now()
    };

    setOperations(prev => [operation, ...(prev || [])]);

    // Start audio atmosphere for flash operation
    handleJobStart(operationId);

    const startTime = Date.now();
    const totalBytes = selectedFile.size;
    let bytesTransferred = 0;
    const speedHistory: number[] = [];

    setCurrentProgress({
      partition: selectedPartition,
      bytesTransferred: 0,
      totalBytes,
      percentage: 0,
      transferSpeed: 0,
      averageSpeed: 0,
      peakSpeed: 0,
      eta: 0,
      status: 'preparing',
      startTime,
      currentTime: startTime
    });

    setTimeout(() => {
      setCurrentProgress(prev => prev ? { ...prev, status: 'flashing' } : null);
    }, 500);

    progressIntervalRef.current = setInterval(() => {
      const currentTime = Date.now();

      const baseSpeed = 5 * 1024 * 1024;
      const speedVariation = Math.sin(currentTime / 1000) * 2 * 1024 * 1024;
      const randomVariation = (Math.random() - 0.5) * 1024 * 1024;
      const currentSpeed = Math.max(1024 * 1024, baseSpeed + speedVariation + randomVariation);

      bytesTransferred = Math.min(bytesTransferred + (currentSpeed * 0.1), totalBytes);
      speedHistory.push(currentSpeed);
      if (speedHistory.length > 50) speedHistory.shift();

      const averageSpeed = speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length;
      const peakSpeed = Math.max(...speedHistory);
      const percentage = (bytesTransferred / totalBytes) * 100;
      const remainingBytes = totalBytes - bytesTransferred;
      const eta = averageSpeed > 0 ? remainingBytes / averageSpeed : 0;

      setCurrentProgress({
        partition: selectedPartition,
        bytesTransferred,
        totalBytes,
        percentage,
        transferSpeed: currentSpeed,
        averageSpeed,
        peakSpeed,
        eta,
        status: bytesTransferred >= totalBytes ? 'verifying' : 'flashing',
        startTime,
        currentTime
      });

      setOperations(prev => (prev || []).map(op => 
        op.id === operationId 
          ? { ...op, progress: percentage }
          : op
      ));
    }, 100);

    try {
      const formData = new FormData();
      formData.append('serial', selectedDevice);
      formData.append('partition', selectedPartition);
      formData.append('file', selectedFile);
      formData.append('confirmation', 'FLASH');

      const response = await fetch(getAPIUrl(API_CONFIG.ENDPOINTS.FASTBOOT_FLASH), {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      if (response.ok && data.success) {
        setCurrentProgress(prev => prev ? { ...prev, status: 'completed', percentage: 100, bytesTransferred: totalBytes } : null);
        setOperations(prev => (prev || []).map(op => 
          op.id === operationId 
            ? { ...op, status: 'success', progress: 100, endTime: Date.now() }
            : op
        ));
        toast.success(`Successfully flashed ${selectedPartition}`);
        
        // Audio notification for successful completion
        handleJobComplete();
        
        setSelectedFile(null);
        
        setTimeout(() => {
          setCurrentProgress(null);
        }, 3000);
      } else {
        throw new Error(data.error || 'Flash operation failed');
      }
    } catch (error: any) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setCurrentProgress(prev => prev ? { ...prev, status: 'error', error: error.message } : null);
      setOperations(prev => (prev || []).map(op => 
        op.id === operationId 
          ? { ...op, status: 'failed', endTime: Date.now(), error: error.message }
          : op
      ));
      toast.error(`Flash failed: ${error.message}`);
      
      // Audio notification for error
      handleJobError();
      
      setTimeout(() => {
        setCurrentProgress(null);
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockBootloader = async () => {
    if (!selectedDevice) {
      toast.error('Please select a device');
      return;
    }

    // Store the unlock function and show confirmation dialog
    setPendingUnlock(() => async () => {
      await executeUnlock();
    });
    setShowUnlockConfirm(true);
  };

  const executeUnlock = async () => {
    if (!selectedDevice) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(getAPIUrl(API_CONFIG.ENDPOINTS.FASTBOOT_UNLOCK), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial: selectedDevice, confirmation: 'UNLOCK' })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Bootloader unlock initiated - follow device prompts');
        await fetchDeviceInfo(selectedDevice);
      } else {
        throw new Error(data.error || 'Unlock operation failed');
      }
    } catch (error: any) {
      toast.error(`Unlock failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Get the JSX return section to add confirmation dialogs

  const handleReboot = async (mode: 'system' | 'bootloader' | 'recovery') => {
    if (!selectedDevice) {
      toast.error('Please select a device');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/fastboot/reboot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial: selectedDevice, mode })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`Rebooting to ${mode}`);
      } else {
        throw new Error(data.error || 'Reboot operation failed');
      }
    } catch (error: any) {
      toast.error(`Reboot failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleErasePartition = async (partition: string) => {
    if (!selectedDevice) {
      toast.error('Please select a device');
      return;
    }

    const partitionInfo = PARTITIONS.find(p => p.name === partition);
    if (partitionInfo?.critical) {
      toast.error('Cannot erase critical system partitions for safety');
      return;
    }

    // Store the erase function and show confirmation dialog
    setPendingErase({
      partition,
      execute: () => executeErase(partition)
    });
    setShowEraseConfirm(true);
  };

  const executeErase = async (partition: string) => {
    if (!selectedDevice) {
      return;
    }

    setLoading(true);
    try {
      const expectedConfirmation = `ERASE ${partition}`.toUpperCase();
      const response = await fetch(getAPIUrl(API_CONFIG.ENDPOINTS.FASTBOOT_ERASE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          serial: selectedDevice, 
          partition,
          confirmation: expectedConfirmation
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`Partition ${partition} erased successfully`);
      } else {
        throw new Error(data.error || 'Erase operation failed');
      }
    } catch (error: any) {
      toast.error(`Erase failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <>
      {currentProgress && (
        <div className="mb-6">
          <FlashProgressMonitor progress={currentProgress} />
        </div>
      )}
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightning size={20} weight="fill" className="text-primary" />
              <CardTitle>Fastboot Flashing Operations</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDevices}
              disabled={loading}
            >
              <ArrowClockwise size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Flash firmware, unlock bootloader, and manage partitions for Android devices in fastboot mode
          </CardDescription>
        </CardHeader>
        <CardContent>
        <div className="mb-4">
          <DeviceStateGuide
            requiredState="fastboot"
            platform="android"
            deviceName={devices.find(d => d.serial === selectedDevice)?.model || selectedDevice || 'Your Android device'}
          />
        </div>
        <Tabs defaultValue="flash" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="flash">
              <Upload size={16} className="mr-1" />
              Flash
            </TabsTrigger>
            <TabsTrigger value="bootloader">
              <LockKey size={16} className="mr-1" />
              Bootloader
            </TabsTrigger>
            <TabsTrigger value="device">
              <DeviceMobile size={16} className="mr-1" />
              Device Info
            </TabsTrigger>
            <TabsTrigger value="history">
              <FloppyDisk size={16} className="mr-1" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flash" className="space-y-4 mt-4">
            <Alert>
              <Warning size={16} />
              <AlertTitle>Caution</AlertTitle>
              <AlertDescription>
                Flashing firmware can brick your device if done incorrectly. Ensure you have the correct files and understand the risks.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="device-select">Device</Label>
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger id="device-select">
                    <SelectValue placeholder="Select a device in fastboot mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        No fastboot devices detected
                      </div>
                    ) : (
                      devices.map(device => (
                        <SelectItem key={device.id} value={device.serial}>
                          {(device.source === 'fastboot' && 'product' in device.properties) 
                            ? device.properties.product || device.serial 
                            : device.serial}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="partition-select">Partition</Label>
                <Select value={selectedPartition} onValueChange={setSelectedPartition}>
                  <SelectTrigger id="partition-select">
                    <SelectValue placeholder="Select partition to flash" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTITIONS.map(partition => (
                      <SelectItem key={partition.name} value={partition.name}>
                        <div className="flex items-center gap-2">
                          <span>{partition.displayName}</span>
                          {partition.critical && (
                            <Badge variant="destructive" className="text-xs">Critical</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPartition && (
                  <p className="text-xs text-muted-foreground">
                    {PARTITIONS.find(p => p.name === selectedPartition)?.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="file-input">Firmware File (.img or .bin)</Label>
                <Input
                  id="file-input"
                  type="file"
                  accept=".img,.bin"
                  onChange={handleFileSelect}
                  disabled={loading}
                />
                {selectedFile && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FloppyDisk size={14} />
                    <span>{selectedFile.name}</span>
                    <span>({formatBytes(selectedFile.size)})</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button
                  onClick={handleFlash}
                  disabled={!selectedDevice || !selectedPartition || !selectedFile || loading}
                  className="flex-1"
                >
                  <Lightning size={16} weight="fill" className="mr-2" />
                  Flash Partition
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedFile(null)}
                  disabled={!selectedFile || loading}
                >
                  Clear
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bootloader" className="space-y-4 mt-4">
            <Alert variant="destructive">
              <Warning size={16} />
              <AlertTitle>Critical Warning</AlertTitle>
              <AlertDescription>
                Unlocking the bootloader will erase all data, void warranty, and reduce device security. This cannot be easily reversed.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bootloader-device">Device</Label>
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger id="bootloader-device">
                    <SelectValue placeholder="Select a device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map(device => (
                      <SelectItem key={device.id} value={device.serial}>
                        {(device.source === 'fastboot' && 'product' in device.properties) 
                          ? device.properties.product || device.serial 
                          : device.serial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {deviceInfo && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Bootloader Status:</span>
                    <Badge variant={deviceInfo.bootloaderUnlocked ? 'default' : 'secondary'}>
                      {deviceInfo.bootloaderUnlocked ? (
                        <>
                          <LockKeyOpen size={14} className="mr-1" />
                          Unlocked
                        </>
                      ) : (
                        <>
                          <LockKey size={14} className="mr-1" />
                          Locked
                        </>
                      )}
                    </Badge>
                  </div>
                  {deviceInfo.secure && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Secure Boot:</span>
                      <Badge variant="outline">
                        <ShieldCheck size={14} className="mr-1" />
                        Enabled
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <div className="grid gap-2">
                <Button
                  variant="destructive"
                  onClick={handleUnlockBootloader}
                  disabled={!selectedDevice || loading || deviceInfo?.bootloaderUnlocked}
                >
                  <LockKeyOpen size={16} className="mr-2" />
                  Unlock Bootloader
                </Button>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleReboot('system')}
                    disabled={!selectedDevice || loading}
                  >
                    <ArrowClockwise size={16} className="mr-1" />
                    System
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReboot('bootloader')}
                    disabled={!selectedDevice || loading}
                  >
                    <Cpu size={16} className="mr-1" />
                    Bootloader
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReboot('recovery')}
                    disabled={!selectedDevice || loading}
                  >
                    <ShieldCheck size={16} className="mr-1" />
                    Recovery
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="device" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="info-device">Device</Label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger id="info-device">
                  <SelectValue placeholder="Select a device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map(device => (
                    <SelectItem key={device.id} value={device.serial}>
                      {(device.source === 'fastboot' && 'product' in device.properties) 
                        ? device.properties.product || device.serial 
                        : device.serial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {deviceInfo ? (
              <div className="space-y-3">
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="font-semibold mb-3">Device Information</h4>
                  <div className="grid gap-2 text-sm">
                    {Object.entries(deviceInfo).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <h4 className="font-semibold mb-3">Partition Management</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {PARTITIONS.filter(p => !p.critical).map(partition => (
                      <Button
                        key={partition.name}
                        variant="outline"
                        size="sm"
                        onClick={() => handleErasePartition(partition.name)}
                        disabled={loading}
                        className="justify-start"
                      >
                        <Trash size={14} className="mr-2" />
                        Erase {partition.displayName}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Info size={48} className="mx-auto mb-2 opacity-50" />
                <p>Select a device to view information</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            {!operations || operations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FloppyDisk size={48} className="mx-auto mb-2 opacity-50" />
                <p>No flash operations yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {operations.map(op => (
                  <div
                    key={op.id}
                    className="rounded-lg border bg-card p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{op.partition}</span>
                          {op.status === 'success' && (
                            <CheckCircle size={16} weight="fill" className="text-green-500" />
                          )}
                          {op.status === 'failed' && (
                            <XCircle size={16} weight="fill" className="text-red-500" />
                          )}
                          {op.status === 'flashing' && (
                            <Circle size={16} weight="fill" className="text-blue-500 animate-pulse" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{op.fileName}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{new Date(op.startTime).toLocaleString()}</p>
                        {op.endTime && (
                          <p>Duration: {formatDuration(op.endTime - op.startTime)}</p>
                        )}
                      </div>
                    </div>
                    {op.status === 'flashing' && (
                      <Progress value={op.progress} />
                    )}
                    {op.error && (
                      <p className="text-xs text-red-500">{op.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={showFlashConfirm}
        onClose={() => {
          setShowFlashConfirm(false);
          setPendingFlash(null);
        }}
        onConfirm={() => {
          if (pendingFlash) {
            pendingFlash();
            setShowFlashConfirm(false);
            setPendingFlash(null);
          }
        }}
        title="Confirm Flash Operation"
        description={`You are about to flash the ${selectedPartition} partition. This operation can potentially brick your device if done incorrectly.`}
        requiredText="FLASH"
        warning={PARTITIONS.find(p => p.name === selectedPartition)?.critical 
          ? "This is a CRITICAL partition. Flashing the wrong image will brick your device!" 
          : "Ensure you have the correct firmware file for this device."}
        danger={PARTITIONS.find(p => p.name === selectedPartition)?.critical || false}
      />

      <ConfirmationDialog
        open={showUnlockConfirm}
        onClose={() => {
          setShowUnlockConfirm(false);
          setPendingUnlock(null);
        }}
        onConfirm={() => {
          if (pendingUnlock) {
            pendingUnlock();
            setShowUnlockConfirm(false);
            setPendingUnlock(null);
          }
        }}
        title="Unlock Bootloader"
        description="This will ERASE ALL DATA on the device and void your warranty."
        requiredText="UNLOCK"
        warning="This operation cannot be undone. All user data will be permanently deleted. The device will be less secure after unlocking."
        danger
      />

      <ConfirmationDialog
        open={showEraseConfirm}
        onClose={() => {
          setShowEraseConfirm(false);
          setPendingErase(null);
        }}
        onConfirm={() => {
          if (pendingErase) {
            pendingErase.execute();
            setShowEraseConfirm(false);
            setPendingErase(null);
          }
        }}
        title={`Erase Partition: ${pendingErase?.partition || ''}`}
        description={`This will permanently delete all data in the ${pendingErase?.partition || ''} partition.`}
        requiredText={pendingErase ? `ERASE ${pendingErase.partition}`.toUpperCase() : ''}
        warning="All data in this partition will be permanently deleted. This cannot be undone."
        danger
      />
    </>
  );
}
