/**
 * Jailbreak Sanctum Panel - Secret Room #3
 * 
 * iOS device manipulation (DFU mode, jailbreak, SHSH blobs, FutureRestore)
 * Risk Level: High (Jordan Bred - Black/Red)
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Smartphone, AlertTriangle, Loader2, Download, Upload, Key, Shield, Archive, RefreshCw, Search, Info, BookOpen, CheckCircle } from 'lucide-react';
import { RiskButton, RiskLevel } from '../unified';
import { toast } from 'sonner';
import { DFUInstructionsGuide } from './DFUInstructionsGuide';

interface JailbreakSanctumPanelProps {
  deviceUDID?: string;
}

type JailbreakMethod = 'checkra1n' | 'palera1n' | 'lockra1n' | 'odyssey' | 'unc0ver' | 'taurine';
type Operation = 'dfu_mode' | 'jailbreak' | 'shsh_save' | 'shsh_restore' | 'futurerestore' | 'backup_manipulate';

interface IOSDevice {
  serial: string;
  udid: string;
  type: string;
  connection: string;
  status: string;
  mode?: string;
  model?: string;
  ios_version?: string;
  chip?: string;
}

export const JailbreakSanctumPanel: React.FC<JailbreakSanctumPanelProps> = ({ deviceUDID: initialDeviceUDID }) => {
  const [deviceUDID, setDeviceUDID] = useState(initialDeviceUDID || '');
  const [operation, setOperation] = useState<Operation | null>(null);
  const [jailbreakMethod, setJailbreakMethod] = useState<JailbreakMethod | null>(null);
  const [iosVersion, setIosVersion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Compliance: User-initiated device scanning
  const [devices, setDevices] = useState<IOSDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<IOSDevice | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [showDFUInstructions, setShowDFUInstructions] = useState(false);

  const operations = [
    {
      id: 'dfu_mode' as Operation,
      name: 'DFU Mode Detection',
      description: 'Detect DFU mode (user must manually enter DFU mode)',
      riskLevel: 'low' as RiskLevel,
      confirmationText: 'DETECT',
      icon: RefreshCw,
    },
    {
      id: 'jailbreak' as Operation,
      name: 'Jailbreak Device',
      description: 'Jailbreak iOS device (checkra1n, palera1n, etc.)',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'JAILBREAK',
      icon: Shield,
    },
    {
      id: 'shsh_save' as Operation,
      name: 'Save SHSH Blobs',
      description: 'Save signing blobs for unsigned iOS versions',
      riskLevel: 'medium' as RiskLevel,
      confirmationText: 'SAVE',
      icon: Download,
    },
    {
      id: 'shsh_restore' as Operation,
      name: 'Restore SHSH Blobs',
      description: 'Restore device using saved SHSH blobs',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'RESTORE',
      icon: Upload,
    },
    {
      id: 'futurerestore' as Operation,
      name: 'FutureRestore',
      description: 'Restore to unsigned iOS versions',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'RESTORE',
      icon: Archive,
    },
    {
      id: 'backup_manipulate' as Operation,
      name: 'iTunes Backup Manipulation',
      description: 'Extract, modify, restore backups',
      riskLevel: 'medium' as RiskLevel,
      confirmationText: 'MODIFY',
      icon: Key,
    },
  ];

  const jailbreakMethods = [
    { id: 'checkra1n' as JailbreakMethod, name: 'checkra1n', description: 'A5-A11 devices (iOS 12-15)', chip: 'A5-A11' },
    { id: 'palera1n' as JailbreakMethod, name: 'palera1n', description: 'A9-A11 devices (iOS 15-16)', chip: 'A9-A11' },
    { id: 'lockra1n' as JailbreakMethod, name: 'lockra1n', description: 'A5-A10 devices (passcode bypass)', chip: 'A5-A10' },
    { id: 'odyssey' as JailbreakMethod, name: 'Odyssey', description: 'A12-A15 devices (iOS 13-14)', chip: 'A12-A15' },
    { id: 'unc0ver' as JailbreakMethod, name: 'unc0ver', description: 'A12-A15 devices (iOS 11-14)', chip: 'A12-A15' },
    { id: 'taurine' as JailbreakMethod, name: 'Taurine', description: 'A12-A15 devices (iOS 14)', chip: 'A12-A15' },
  ];

  // Compliance: User-initiated device scanning (no auto-scan)
  const handleScanDevices = async () => {
    setIsScanning(true);
    setError(null);
    setDevices([]);
    setSelectedDevice(null);
    
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/pandora/devices?user_initiated=true', {
        headers: {
          'X-Secret-Room-Passcode': passcode
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Device scan failed');
      }
      
      if (data.ok && data.data) {
        const deviceList = data.data.devices || [];
        setDevices(deviceList);
        
        if (deviceList.length === 0) {
          toast.info('No iOS devices detected. Connect a device via USB and try again.');
        } else {
          toast.success(`Found ${deviceList.length} device(s)`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Device scan failed');
      toast.error(err.message || 'Device scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  // Compliance: Get device information (read-only)
  const handleGetDeviceInfo = async (udid: string) => {
    setIsLoading(true);
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      // Note: This would need a new endpoint for device info
      // For now, use the device data from scan
      const device = devices.find(d => d.udid === udid);
      if (device) {
        setDeviceInfo(device);
        setDeviceUDID(udid);
        setSelectedDevice(device);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get device info');
    } finally {
      setIsLoading(false);
    }
  };

  // Compliance: DFU detection (user-initiated)
  const handleDFUDetect = async () => {
    if (!deviceUDID) {
      toast.error('Device UDID required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/pandora/dfu/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          deviceSerial: deviceUDID,
          user_initiated: true
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'DFU detection failed');
      }
      
      if (data.ok && data.data) {
        if (data.data.dfuMode) {
          toast.success('DFU mode detected');
        } else {
          toast.info('DFU mode not detected. Follow instructions to enter DFU mode.');
          setShowDFUInstructions(true);
        }
      }
    } catch (err: any) {
      setError(err.message || 'DFU detection failed');
      toast.error(err.message || 'DFU detection failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async (op: typeof operations[0]) => {
    if (!deviceUDID) {
      toast.error('Device UDID required');
      return;
    }

    if (op.id === 'jailbreak' && !jailbreakMethod) {
      toast.error('Jailbreak method required');
      return;
    }

    if (confirmation !== op.confirmationText) {
      setError(`Type "${op.confirmationText}" to confirm`);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      
      const response = await fetch('/api/v1/trapdoor/ios/jailbreak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          udid: deviceUDID,
          operation: op.id,
          method: jailbreakMethod,
          iosVersion: iosVersion || undefined,
          confirmation: op.confirmationText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Operation failed: ${response.statusText}`);
      }

      toast.success(`${op.name} initiated successfully`);
      setConfirmation('');
      setOperation(null);
      setJailbreakMethod(null);
      setIosVersion('');
    } catch (err: any) {
      setError(err.message || 'Operation failed');
      toast.error(err.message || 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card-jordan bg-[#141922] border-[#FF6B9D]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#FF6B9D]/20 rounded-lg">
                <Smartphone className="h-6 w-6 text-[#FF6B9D]" />
              </div>
              <div>
                <CardTitle className="text-legendary text-2xl font-display uppercase text-white">
                  Jailbreak Sanctum
                </CardTitle>
                <CardDescription className="text-gray-400">
                  iOS device manipulation - The capabilities that make iOS developers nervous
                </CardDescription>
              </div>
            </div>
            <Badge variant="destructive" className="text-xs">
              HIGH RISK
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-[#0B0F14] border-[#FF6B9D]/50">
            <AlertTriangle className="h-4 w-4 text-[#FF6B9D]" />
            <AlertDescription className="text-gray-300">
              <strong className="text-[#FF6B9D]">Warning:</strong> Jailbreaking voids warranty and may cause instability. 
              Only use on devices you own. Backup before proceeding.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {/* Compliance: User-initiated device scanning */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">
                  Device Detection
                </label>
                <Button
                  onClick={handleScanDevices}
                  disabled={isScanning}
                  variant="outline"
                  size="sm"
                  className="bg-[#0B0F14] border-[#2FD3FF]/50 text-[#2FD3FF] hover:bg-[#2FD3FF]/10"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Scan for Devices
                    </>
                  )}
                </Button>
              </div>
              
              {devices.length > 0 && (
                <div className="space-y-2">
                  {devices.map((device) => (
                    <Card
                      key={device.udid}
                      className={`bg-[#0B0F14] border-2 cursor-pointer transition-all ${
                        selectedDevice?.udid === device.udid
                          ? 'border-[#2FD3FF] bg-[#2FD3FF]/10'
                          : 'border-[#2FD3FF]/20 hover:border-[#2FD3FF]/50'
                      }`}
                      onClick={() => handleGetDeviceInfo(device.udid)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-[#2FD3FF]" />
                            <div>
                              <div className="text-sm font-medium text-white">
                                {device.model || 'iOS Device'}
                              </div>
                              <div className="text-xs text-gray-400">
                                {device.udid.substring(0, 20)}...
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {device.chip && (
                              <Badge variant="outline" className="text-xs">
                                {device.chip}
                              </Badge>
                            )}
                            {device.mode && (
                              <Badge variant={device.mode === 'dfu' ? 'destructive' : 'default'} className="text-xs">
                                {device.mode.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {device.ios_version && (
                          <div className="mt-2 text-xs text-gray-400">
                            iOS {device.ios_version}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {selectedDevice && (
                <Alert className="bg-[#0B0F14] border-[#2FD3FF]/50">
                  <Info className="h-4 w-4 text-[#2FD3FF]" />
                  <AlertDescription className="text-gray-300 text-sm">
                    <strong>Selected Device:</strong> {selectedDevice.model || 'Unknown'} ({selectedDevice.chip || 'Unknown Chip'})
                    {selectedDevice.ios_version && ` - iOS ${selectedDevice.ios_version}`}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Device UDID {selectedDevice && '(Auto-filled)'}
              </label>
              <Input
                value={deviceUDID}
                onChange={(e) => setDeviceUDID(e.target.value)}
                placeholder="00008030-001A... or scan for devices above"
                className="bg-[#0B0F14] border-[#2FD3FF]/50 text-white"
              />
            </div>

            {/* Compliance: DFU Mode Detection */}
            {operation === 'dfu_mode' && (
              <div className="space-y-3 pt-4 border-t border-[#2FD3FF]/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-1">DFU Mode Detection</h4>
                    <p className="text-xs text-gray-400">
                      Compliance: Detection only. You must manually enter DFU mode.
                    </p>
                  </div>
                  <Button
                    onClick={handleDFUDetect}
                    disabled={isLoading || !deviceUDID}
                    variant="outline"
                    size="sm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Detecting...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Detect DFU
                      </>
                    )}
                  </Button>
                </div>
                
                {showDFUInstructions && (
                  <DFUInstructionsGuide
                    deviceModel={selectedDevice?.model}
                    chip={selectedDevice?.chip}
                  />
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {operations.map((op) => {
                const Icon = op.icon;
                return (
                  <Card
                    key={op.id}
                    className={`bg-[#0B0F14] border-2 cursor-pointer transition-all ${
                      operation === op.id
                        ? 'border-[#FF6B9D] bg-[#FF6B9D]/10'
                        : 'border-[#2FD3FF]/20 hover:border-[#2FD3FF]/50'
                    }`}
                    onClick={() => setOperation(op.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-5 w-5 ${op.riskLevel === 'high' ? 'text-[#FF6B9D]' : 'text-[#2FD3FF]'}`} />
                          <CardTitle className="text-white text-sm">{op.name}</CardTitle>
                        </div>
                        <Badge variant={op.riskLevel === 'high' ? 'destructive' : 'default'} className="text-xs">
                          {op.riskLevel.toUpperCase()}
                        </Badge>
                      </div>
                      <CardDescription className="text-gray-400 text-xs">
                        {op.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>

            {operation === 'jailbreak' && (
              <div className="space-y-4 pt-4 border-t border-[#2FD3FF]/20">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Jailbreak Method
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {jailbreakMethods.map((method) => (
                      <Button
                        key={method.id}
                        variant={jailbreakMethod === method.id ? 'default' : 'outline'}
                        onClick={() => setJailbreakMethod(method.id)}
                        className="text-xs"
                      >
                        {method.name}
                      </Button>
                    ))}
                  </div>
                </div>
                {jailbreakMethod && (
                  <Alert className="bg-[#0B0F14] border-[#2FD3FF]/50">
                    <AlertDescription className="text-gray-300 text-sm">
                      <strong>{jailbreakMethods.find(m => m.id === jailbreakMethod)?.name}</strong>: {jailbreakMethods.find(m => m.id === jailbreakMethod)?.description}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {(operation === 'jailbreak' || operation === 'futurerestore') && (
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  iOS Version (optional)
                </label>
                <Input
                  value={iosVersion}
                  onChange={(e) => setIosVersion(e.target.value)}
                  placeholder="14.8, 15.7.1, etc."
                  className="bg-[#0B0F14] border-[#2FD3FF]/50 text-white"
                />
              </div>
            )}

            {operation && (
              <div className="space-y-4 pt-4 border-t border-[#2FD3FF]/20">
                <Alert className="bg-[#0B0F14] border-[#FF6B9D]/50">
                  <AlertTriangle className="h-4 w-4 text-[#FF6B9D]" />
                  <AlertDescription className="text-gray-300">
                    This operation will modify your iOS device. Type{' '}
                    <strong className="text-[#FF6B9D]">
                      {operations.find(o => o.id === operation)?.confirmationText}
                    </strong>{' '}
                    to confirm.
                  </AlertDescription>
                </Alert>

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Confirmation
                  </label>
                  <Input
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder={`Type ${operations.find(o => o.id === operation)?.confirmationText} to confirm`}
                    className="bg-[#0B0F14] border-[#FF6B9D]/50 text-white"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <RiskButton
                  riskLevel={operations.find(o => o.id === operation)?.riskLevel || 'high'}
                  onClick={() => handleExecute(operations.find(o => o.id === operation)!)}
                  disabled={isLoading || !deviceUDID || confirmation !== operations.find(o => o.id === operation)?.confirmationText || (operation === 'jailbreak' && !jailbreakMethod)}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Smartphone className="mr-2 h-4 w-4" />
                      Execute {operations.find(o => o.id === operation)?.name}
                    </>
                  )}
                </RiskButton>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
