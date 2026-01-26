/**
 * Unlock Chamber Panel - Secret Room #1
 * 
 * Complete device unlock automation (FRP, bootloader, OEM unlock)
 * Risk Level: High (Jordan Bred - Black/Red)
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Unlock, AlertTriangle, CheckCircle, Loader2, Smartphone, Key, Shield } from 'lucide-react';
import { RiskButton, RiskLevel } from '../unified';
import { toast } from 'sonner';

interface UnlockChamberPanelProps {
  deviceSerial?: string;
}

export const UnlockChamberPanel: React.FC<UnlockChamberPanelProps> = ({ deviceSerial: initialDeviceSerial }) => {
  const [deviceSerial, setDeviceSerial] = useState(initialDeviceSerial || '');
  const [operation, setOperation] = useState<'frp_bypass' | 'bootloader_unlock' | 'oem_unlock' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const operations = [
    {
      id: 'frp_bypass',
      name: 'FRP Bypass',
      description: 'Factory Reset Protection removal (owner devices only)',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'BYPASS',
      icon: Shield,
    },
    {
      id: 'bootloader_unlock',
      name: 'Bootloader Unlock',
      description: 'Automated unlock across all brands',
      riskLevel: 'high' as RiskLevel,
      confirmationText: 'UNLOCK',
      icon: Key,
    },
    {
      id: 'oem_unlock',
      name: 'OEM Unlock Enable',
      description: 'Unlock the unlocker',
      riskLevel: 'medium' as RiskLevel,
      confirmationText: 'ENABLE',
      icon: Unlock,
    },
  ];

  const handleExecute = async (op: typeof operations[0]) => {
    if (!deviceSerial) {
      toast.error('Device serial required');
      return;
    }

    if (confirmation !== op.confirmationText) {
      toast.error(`Please type "${op.confirmationText}" to confirm`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      
      const response = await fetch('/api/v1/trapdoor/unlock', {
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
        throw new Error(data.error || data.message || 'Operation failed');
      }

      toast.success(`${op.name} executed successfully`);
      setConfirmation('');
      setOperation(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to execute operation';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card-jordan">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-lg">
              <Unlock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-legendary text-2xl font-display uppercase">
                Unlock Chamber
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Complete device unlock automation - The stuff that makes repair shops jealous
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Device Serial Input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold uppercase tracking-wide">
              Device Serial Number
            </label>
            <Input
              value={deviceSerial}
              onChange={(e) => setDeviceSerial(e.target.value)}
              placeholder="Enter device serial number"
              className="font-mono"
            />
          </div>

          {/* Operations Grid */}
          <div className="grid gap-4">
            <h3 className="text-lg font-semibold uppercase tracking-wide">
              Available Operations
            </h3>
            {operations.map((op) => {
              const Icon = op.icon;
              const isSelected = operation === op.id;
              
              return (
                <Card
                  key={op.id}
                  className={isSelected ? 'border-primary ring-2 ring-primary/50' : ''}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{op.name}</h4>
                            <Badge className={op.riskLevel === 'high' ? 'jordan-bred' : 'jordan-chicago'}>
                              {op.riskLevel.toUpperCase()} RISK
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{op.description}</p>
                        </div>
                      </div>
                      <RiskButton
                        riskLevel={op.riskLevel}
                        onClick={() => setOperation(op.id)}
                        size="sm"
                      >
                        Select
                      </RiskButton>
                    </div>

                    {isSelected && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            This operation is <strong>DESTRUCTIVE</strong> and cannot be undone.
                            Type <strong className="font-mono">{op.confirmationText}</strong> to confirm.
                          </AlertDescription>
                        </Alert>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-semibold">
                            Confirmation Required
                          </label>
                          <Input
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            placeholder={`Type "${op.confirmationText}" to confirm`}
                            className="font-mono uppercase"
                          />
                        </div>

                        <div className="flex gap-2">
                          <RiskButton
                            riskLevel={op.riskLevel}
                            onClick={() => handleExecute(op)}
                            disabled={isLoading || confirmation !== op.confirmationText}
                            className="flex-1"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Executing...
                              </>
                            ) : (
                              <>
                                <Icon className="h-4 w-4 mr-2" />
                                Execute {op.name}
                              </>
                            )}
                          </RiskButton>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setOperation(null);
                              setConfirmation('');
                              setError(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
