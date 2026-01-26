/**
 * Bypass Laboratory Panel - Secret Room #5
 * 
 * Security bypass automation (FRP, biometric, certificate pinning, MDM, encryption)
 * Risk Level: High (Jordan Bred - Black/Red)
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Key, AlertTriangle, Loader2, Fingerprint, Lock, Shield, Eye, FileX } from 'lucide-react';
import { RiskButton, RiskLevel } from '../unified';
import { toast } from 'sonner';

interface BypassLaboratoryPanelProps {
  deviceSerial?: string;
}

type BypassOperation = 'frp_bypass' | 'biometric_bypass' | 'cert_pinning_bypass' | 'mdm_removal' | 'encryption_bypass';

export const BypassLaboratoryPanel: React.FC<BypassLaboratoryPanelProps> = ({ deviceSerial: initialDeviceSerial }) => {
  const [deviceSerial, setDeviceSerial] = useState(initialDeviceSerial || '');
  const [operation, setOperation] = useState<BypassOperation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const operations = [
    {
      id: 'frp_bypass' as BypassOperation,
      name: 'FRP Bypass',
      description: 'Factory Reset Protection lock removal (owner devices only)',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'BYPASS',
      icon: Lock,
      warning: 'Only use on devices you own',
    },
    {
      id: 'biometric_bypass' as BypassOperation,
      name: 'Biometric Bypass',
      description: 'Fingerprint/Face ID testing (research mode only)',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'BYPASS',
      icon: Fingerprint,
      warning: 'For security research only',
    },
    {
      id: 'cert_pinning_bypass' as BypassOperation,
      name: 'Certificate Pinning Bypass',
      description: 'SSL pinning bypass for security research',
      riskLevel: 'medium' as RiskLevel,
      confirmationText: 'BYPASS',
      icon: Shield,
      warning: 'For security research only',
    },
    {
      id: 'mdm_removal' as BypassOperation,
      name: 'MDM Removal',
      description: 'Enterprise profile removal (authorized only)',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'REMOVE',
      icon: FileX,
      warning: 'Only with proper authorization',
    },
    {
      id: 'encryption_bypass' as BypassOperation,
      name: 'Encryption Bypass',
      description: 'Device encryption bypass for data recovery (owner devices)',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'BYPASS',
      icon: Eye,
      warning: 'Only on devices you own',
    },
  ];

  const handleExecute = async (op: typeof operations[0]) => {
    if (!deviceSerial) {
      toast.error('Device serial required');
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
      
      const response = await fetch('/api/v1/trapdoor/bypass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          deviceSerial,
          operation: op.id,
          confirmation: op.confirmationText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Operation failed: ${response.statusText}`);
      }

      toast.success(`${op.name} executed successfully`);
      setConfirmation('');
      setOperation(null);
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
                <Key className="h-6 w-6 text-[#FF6B9D]" />
              </div>
              <div>
                <CardTitle className="text-legendary text-2xl font-display uppercase text-white">
                  Bypass Laboratory
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Security bypass automation - For research, testing, and recovery
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
              <strong className="text-[#FF6B9D]">Legal Notice:</strong> All bypass operations are for authorized use only. 
              Only use on devices you own or have explicit permission to access. Unauthorized access is illegal.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Device Serial
              </label>
              <Input
                value={deviceSerial}
                onChange={(e) => setDeviceSerial(e.target.value)}
                placeholder="Enter device serial"
                className="bg-[#0B0F14] border-[#FF6B9D]/50 text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {operations.map((op) => {
                const Icon = op.icon;
                return (
                  <Card
                    key={op.id}
                    className={`bg-[#0B0F14] border-2 cursor-pointer transition-all ${
                      operation === op.id
                        ? 'border-[#FF6B9D] bg-[#FF6B9D]/10'
                        : 'border-[#FF6B9D]/20 hover:border-[#FF6B9D]/50'
                    }`}
                    onClick={() => setOperation(op.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-[#FF6B9D]" />
                          <CardTitle className="text-white text-sm">{op.name}</CardTitle>
                        </div>
                        <Badge variant={op.riskLevel === 'high' ? 'destructive' : op.riskLevel === 'medium' ? 'default' : 'secondary'} className="text-xs">
                          {op.riskLevel.toUpperCase()}
                        </Badge>
                      </div>
                      <CardDescription className="text-gray-400 text-xs">
                        {op.description}
                      </CardDescription>
                      {op.warning && (
                        <Alert className="mt-2 bg-[#0B0F14] border-[#FF6B9D]/30">
                          <AlertDescription className="text-xs text-gray-400">
                            ⚠ {op.warning}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardHeader>
                  </Card>
                );
              })}
            </div>

            {operation && (
              <div className="space-y-4 pt-4 border-t border-[#FF6B9D]/20">
                <Alert className="bg-[#0B0F14] border-[#FF6B9D]/50">
                  <AlertTriangle className="h-4 w-4 text-[#FF6B9D]" />
                  <AlertDescription className="text-gray-300">
                    <strong className="text-[#FF6B9D]">Warning:</strong> This bypass operation will modify security settings. 
                    Type <strong className="text-[#FF6B9D]">{operations.find(o => o.id === operation)?.confirmationText}</strong> to confirm.
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
                      <Key className="mr-2 h-4 w-4" />
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
