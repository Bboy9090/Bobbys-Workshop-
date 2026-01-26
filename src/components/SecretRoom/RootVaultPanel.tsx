/**
 * Root Vault Panel - Secret Room #4
 * 
 * Root installation and management (Magisk, SuperSU, Xposed, LSPosed)
 * Risk Level: Medium-High (Jordan Chicago - Red/White/Black)
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Shield, AlertTriangle, Loader2, Package, Settings, CheckCircle, Lock, Unlock } from 'lucide-react';
import { RiskButton, RiskLevel } from '../unified';
import { toast } from 'sonner';

interface RootVaultPanelProps {
  deviceSerial?: string;
}

type RootMethod = 'magisk' | 'supersu' | 'kingroot' | 'xposed' | 'lsposed';
type Operation = 'install_root' | 'verify_root' | 'install_xposed' | 'system_app_install' | 'system_app_uninstall';

export const RootVaultPanel: React.FC<RootVaultPanelProps> = ({ deviceSerial: initialDeviceSerial }) => {
  const [deviceSerial, setDeviceSerial] = useState(initialDeviceSerial || '');
  const [operation, setOperation] = useState<Operation | null>(null);
  const [rootMethod, setRootMethod] = useState<RootMethod | null>(null);
  const [recoveryType, setRecoveryType] = useState<'twrp' | 'orange-fox' | 'cwm' | 'auto'>('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const operations = [
    {
      id: 'install_root' as Operation,
      name: 'Install Root',
      description: 'Install root solution (Magisk, SuperSU, etc.)',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'INSTALL',
      icon: Package,
    },
    {
      id: 'verify_root' as Operation,
      name: 'Verify Root Status',
      description: 'Check if device is rooted',
      riskLevel: 'low' as RiskLevel,
      confirmationText: 'VERIFY',
      icon: CheckCircle,
    },
    {
      id: 'install_xposed' as Operation,
      name: 'Install Xposed/LSPosed',
      description: 'Install Xposed framework or LSPosed',
      riskLevel: 'medium' as RiskLevel,
      confirmationText: 'INSTALL',
      icon: Settings,
    },
    {
      id: 'system_app_install' as Operation,
      name: 'Install System App',
      description: 'Install app as system app',
      riskLevel: 'medium' as RiskLevel,
      confirmationText: 'INSTALL',
      icon: Package,
    },
    {
      id: 'system_app_uninstall' as Operation,
      name: 'Uninstall System App',
      description: 'Remove system app',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'UNINSTALL',
      icon: Unlock,
    },
  ];

  const rootMethods = [
    { id: 'magisk' as RootMethod, name: 'Magisk', description: 'Modern root solution (recommended)', recovery: true },
    { id: 'supersu' as RootMethod, name: 'SuperSU', description: 'Legacy root solution', recovery: true },
    { id: 'kingroot' as RootMethod, name: 'KingRoot', description: 'One-click root (deprecated)', recovery: false },
    { id: 'xposed' as RootMethod, name: 'Xposed Framework', description: 'Legacy Xposed', recovery: true },
    { id: 'lsposed' as RootMethod, name: 'LSPosed', description: 'Modern Xposed alternative', recovery: true },
  ];

  const handleExecute = async (op: typeof operations[0]) => {
    if (!deviceSerial) {
      toast.error('Device serial required');
      return;
    }

    if (op.id === 'install_root' && !rootMethod) {
      toast.error('Root method required');
      return;
    }

    if (op.id !== 'verify_root' && confirmation !== op.confirmationText) {
      setError(`Type "${op.confirmationText}" to confirm`);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      
      const response = await fetch('/api/v1/trapdoor/root/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          deviceSerial,
          operation: op.id,
          method: rootMethod,
          recovery: recoveryType !== 'auto' ? recoveryType : undefined,
          confirmation: op.id !== 'verify_root' ? op.confirmationText : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Operation failed: ${response.statusText}`);
      }

      toast.success(`${op.name} executed successfully`);
      setConfirmation('');
      setOperation(null);
      setRootMethod(null);
    } catch (err: any) {
      setError(err.message || 'Operation failed');
      toast.error(err.message || 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card-jordan bg-[#141922] border-[#2FD3FF]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#2FD3FF]/20 rounded-lg">
                <Shield className="h-6 w-6 text-[#2FD3FF]" />
              </div>
              <div>
                <CardTitle className="text-legendary text-2xl font-display uppercase text-white">
                  Root Vault
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Root installation and management - Automate what used to take hours
                </CardDescription>
              </div>
            </div>
            <Badge variant="default" className="text-xs">
              MEDIUM-HIGH RISK
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-[#0B0F14] border-[#2FD3FF]/50">
            <AlertTriangle className="h-4 w-4 text-[#2FD3FF]" />
            <AlertDescription className="text-gray-300">
              <strong className="text-[#2FD3FF]">Warning:</strong> Rooting voids warranty and may cause security issues. 
              Only root devices you own. Backup before proceeding.
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
                className="bg-[#0B0F14] border-[#2FD3FF]/50 text-white"
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
                        ? 'border-[#2FD3FF] bg-[#2FD3FF]/10'
                        : 'border-[#2FD3FF]/20 hover:border-[#2FD3FF]/50'
                    }`}
                    onClick={() => setOperation(op.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-5 w-5 text-[#2FD3FF]`} />
                          <CardTitle className="text-white text-sm">{op.name}</CardTitle>
                        </div>
                        <Badge variant={op.riskLevel === 'high' ? 'destructive' : op.riskLevel === 'medium' ? 'default' : 'secondary'} className="text-xs">
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

            {operation === 'install_root' && (
              <div className="space-y-4 pt-4 border-t border-[#2FD3FF]/20">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Root Method
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {rootMethods.filter(m => m.id !== 'xposed' && m.id !== 'lsposed').map((method) => (
                      <Button
                        key={method.id}
                        variant={rootMethod === method.id ? 'default' : 'outline'}
                        onClick={() => setRootMethod(method.id)}
                        className="text-sm"
                      >
                        {method.name}
                      </Button>
                    ))}
                  </div>
                </div>
                {rootMethod && rootMethods.find(m => m.id === rootMethod)?.recovery && (
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      Recovery Type
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {['twrp', 'orange-fox', 'cwm', 'auto'].map((rec) => (
                        <Button
                          key={rec}
                          variant={recoveryType === rec ? 'default' : 'outline'}
                          onClick={() => setRecoveryType(rec as any)}
                          className="text-xs"
                        >
                          {rec === 'orange-fox' ? 'OrangeFox' : rec.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {operation && (
              <div className="space-y-4 pt-4 border-t border-[#2FD3FF]/20">
                {operation !== 'verify_root' && (
                  <Alert className="bg-[#0B0F14] border-[#2FD3FF]/50">
                    <AlertTriangle className="h-4 w-4 text-[#2FD3FF]" />
                    <AlertDescription className="text-gray-300">
                      This operation will modify your device. Type{' '}
                      <strong className="text-[#2FD3FF]">
                        {operations.find(o => o.id === operation)?.confirmationText}
                      </strong>{' '}
                      to confirm.
                    </AlertDescription>
                  </Alert>
                )}

                {operation !== 'verify_root' && (
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      Confirmation
                    </label>
                    <Input
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      placeholder={`Type ${operations.find(o => o.id === operation)?.confirmationText} to confirm`}
                      className="bg-[#0B0F14] border-[#2FD3FF]/50 text-white"
                    />
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <RiskButton
                  riskLevel={operations.find(o => o.id === operation)?.riskLevel || 'medium'}
                  onClick={() => handleExecute(operations.find(o => o.id === operation)!)}
                  disabled={isLoading || !deviceSerial || (operation !== 'verify_root' && confirmation !== operations.find(o => o.id === operation)?.confirmationText) || (operation === 'install_root' && !rootMethod)}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
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
