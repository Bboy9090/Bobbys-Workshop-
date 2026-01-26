/**
 * Flash Forge Panel - Secret Room #2
 * 
 * Multi-brand flash operations (Samsung Odin, MediaTek SP Flash, Qualcomm EDL)
 * Risk Level: High (Jordan Bred - Black/Red)
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Zap, AlertTriangle, CheckCircle, Loader2, Smartphone, Upload, HardDrive, Shield, FileUp } from 'lucide-react';
import { RiskButton, RiskLevel } from '../unified';
import { toast } from 'sonner';

interface FlashForgePanelProps {
  deviceSerial?: string;
}

type FlashBrand = 'samsung' | 'mediatek' | 'qualcomm' | 'generic';
type FlashOperation = 'full_flash' | 'partition_flash' | 'recovery_install' | 'firmware_update';

export const FlashForgePanel: React.FC<FlashForgePanelProps> = ({ deviceSerial: initialDeviceSerial }) => {
  const [deviceSerial, setDeviceSerial] = useState(initialDeviceSerial || '');
  const [brand, setBrand] = useState<FlashBrand>('samsung');
  const [operation, setOperation] = useState<FlashOperation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [firmwarePath, setFirmwarePath] = useState('');

  const operations = [
    {
      id: 'full_flash' as FlashOperation,
      name: 'Full Firmware Flash',
      description: 'Complete device firmware flash (all partitions)',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'FLASH',
      icon: Upload,
      availableBrands: ['samsung', 'mediatek', 'qualcomm'] as FlashBrand[],
    },
    {
      id: 'partition_flash' as FlashOperation,
      name: 'Partition Flash',
      description: 'Flash specific partition (boot, system, recovery, etc.)',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'FLASH',
      icon: HardDrive,
      availableBrands: ['samsung', 'mediatek', 'qualcomm', 'generic'] as FlashBrand[],
    },
    {
      id: 'recovery_install' as FlashOperation,
      name: 'Custom Recovery Install',
      description: 'Install TWRP, OrangeFox, or other custom recovery',
      riskLevel: 'medium' as RiskLevel,
      confirmationText: 'INSTALL',
      icon: Shield,
      availableBrands: ['samsung', 'mediatek', 'qualcomm', 'generic'] as FlashBrand[],
    },
    {
      id: 'firmware_update' as FlashOperation,
      name: 'Firmware Update',
      description: 'Update device firmware to newer version',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'UPDATE',
      icon: FileUp,
      availableBrands: ['samsung', 'mediatek', 'qualcomm'] as FlashBrand[],
    },
  ];

  const brandInfo = {
    samsung: {
      name: 'Samsung Odin',
      description: 'Full Odin protocol support (AP, BL, CP, CSC)',
      color: 'text-blue-400',
    },
    mediatek: {
      name: 'MediaTek SP Flash',
      description: 'Preloader/DA mode flashing',
      color: 'text-green-400',
    },
    qualcomm: {
      name: 'Qualcomm EDL',
      description: 'Firehose protocol automation',
      color: 'text-purple-400',
    },
    generic: {
      name: 'Generic Fastboot',
      description: 'Standard Fastboot protocol',
      color: 'text-gray-400',
    },
  };

  const handleExecute = async (op: typeof operations[0]) => {
    if (!deviceSerial) {
      toast.error('Device serial required');
      return;
    }

    if (!firmwarePath && op.id !== 'recovery_install') {
      toast.error('Firmware path required');
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
      
      const response = await fetch('/api/v1/trapdoor/flash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          deviceSerial,
          brand,
          operation: op.id,
          firmwarePath: firmwarePath || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Flash operation failed: ${response.statusText}`);
      }

      toast.success(`${op.name} initiated successfully`);
      setConfirmation('');
      setFirmwarePath('');
      setOperation(null);
    } catch (err: any) {
      setError(err.message || 'Flash operation failed');
      toast.error(err.message || 'Flash operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOperations = operations.filter(op => op.availableBrands.includes(brand));

  return (
    <div className="space-y-6">
      <Card className="card-jordan bg-[#141922] border-[#FF6B9D]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#FF6B9D]/20 rounded-lg">
                <Zap className="h-6 w-6 text-[#FF6B9D]" />
              </div>
              <div>
                <CardTitle className="text-legendary text-2xl font-display uppercase text-white">
                  Flash Forge
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Multi-brand flash operations - Flash ANY device, ANY brand, ANY firmware
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
              <strong className="text-[#FF6B9D]">Warning:</strong> Flash operations can permanently damage your device 
              if performed incorrectly. Only flash firmware you trust on devices you own. Always backup first.
            </AlertDescription>
          </Alert>

          <Tabs value={brand} onValueChange={(v) => setBrand(v as FlashBrand)} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-[#0B0F14]">
              <TabsTrigger value="samsung">Samsung</TabsTrigger>
              <TabsTrigger value="mediatek">MediaTek</TabsTrigger>
              <TabsTrigger value="qualcomm">Qualcomm</TabsTrigger>
              <TabsTrigger value="generic">Generic</TabsTrigger>
            </TabsList>

            <TabsContent value={brand} className="space-y-4 mt-4">
              <Card className="bg-[#0B0F14] border-[#2FD3FF]/20">
                <CardHeader>
                  <CardTitle className="text-white text-lg">{brandInfo[brand].name}</CardTitle>
                  <CardDescription className="text-gray-400">{brandInfo[brand].description}</CardDescription>
                </CardHeader>
              </Card>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Device Serial
                  </label>
                  <Input
                    value={deviceSerial}
                    onChange={(e) => setDeviceSerial(e.target.value)}
                    placeholder="Enter device serial"
                    className="bg-[#0B0F14] border-[#2FD3FF]/50 text-white"
                  />
                </div>

                {operation && operation !== 'recovery_install' && (
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      Firmware Path
                    </label>
                    <Input
                      value={firmwarePath}
                      onChange={(e) => setFirmwarePath(e.target.value)}
                      placeholder="/path/to/firmware.tar or .zip"
                      className="bg-[#0B0F14] border-[#2FD3FF]/50 text-white"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredOperations.map((op) => {
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

                {operation && (
                  <div className="space-y-4 pt-4 border-t border-[#2FD3FF]/20">
                    <Alert className="bg-[#0B0F14] border-[#FF6B9D]/50">
                      <AlertTriangle className="h-4 w-4 text-[#FF6B9D]" />
                      <AlertDescription className="text-gray-300">
                        This operation will flash firmware to your device. Type{' '}
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
                      disabled={isLoading || !deviceSerial || confirmation !== operations.find(o => o.id === operation)?.confirmationText}
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Zap className="mr-2 h-4 w-4" />
                          Execute {operations.find(o => o.id === operation)?.name}
                        </>
                      )}
                    </RiskButton>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
