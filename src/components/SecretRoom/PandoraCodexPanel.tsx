/**
 * Pandora Codex Panel - Secret Room #10
 * Hardware manipulation, DFU detection, jailbreak automation
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Unlock, Smartphone, Cpu, Zap, AlertTriangle, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';

export const PandoraCodexPanel: React.FC = () => {
  const [deviceSerial, setDeviceSerial] = useState('');
  const [devices, setDevices] = useState<any[]>([]);
  const [jailbreakMethods, setJailbreakMethods] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dfuMode, setDfuMode] = useState(false);

  // Compliance: No auto-scanning - user must initiate
  useEffect(() => {
    loadJailbreakMethods();
    // Removed auto-scanning - user must click "Scan for Devices" button
  }, []);

  // Compliance: User-initiated device scanning only
  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/pandora/devices?user_initiated=true', {
        headers: {
          'X-Secret-Room-Passcode': passcode
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.data && data.data.devices) {
          setDevices(data.data.devices);
          if (data.data.devices.length === 0) {
            toast.info('No iOS devices detected. Connect a device via USB and try again.');
          } else {
            toast.success(`Found ${data.data.devices.length} device(s)`);
          }
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Device scan failed');
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
      toast.error('Device scan failed');
    } finally {
      setIsLoading(false);
    }
  };

  const loadJailbreakMethods = async () => {
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/pandora/jailbreak/methods', {
        headers: {
          'X-Secret-Room-Passcode': passcode
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.methods) {
          setJailbreakMethods(data.data.methods);
        }
      }
    } catch (error) {
      console.error('Failed to load jailbreak methods:', error);
    }
  };

  const handleChainBreaker = async () => {
    if (!deviceSerial) {
      alert('Please enter device serial');
      return;
    }
    setIsLoading(true);
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/pandora/chainbreaker', {
        method: 'POST',
        headers: {
          'X-Secret-Room-Passcode': passcode,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deviceSerial, deviceType: 'auto-detect', operation: 'activation_bypass' })
      });
      if (response.ok) {
        alert('Chain-Breaker operation initiated');
      }
    } catch (error) {
      console.error('Chain-Breaker failed:', error);
      alert('Chain-Breaker operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDFUDetect = async () => {
    setIsLoading(true);
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/pandora/dfu/detect', {
        method: 'POST',
        headers: {
          'X-Secret-Room-Passcode': passcode,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deviceSerial: deviceSerial || 'auto' })
      });
      if (response.ok) {
        const data = await response.json();
        setDfuMode(data.data?.dfuMode || false);
        alert(data.data?.dfuMode ? 'DFU mode detected' : 'DFU mode not detected');
      }
    } catch (error) {
      console.error('DFU detection failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJailbreak = async (method: string) => {
    if (!deviceSerial) {
      alert('Please enter device serial');
      return;
    }
    setIsLoading(true);
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/pandora/jailbreak/execute', {
        method: 'POST',
        headers: {
          'X-Secret-Room-Passcode': passcode,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          deviceSerial, 
          deviceType: 'iPhone',
          iosVersion: 'auto-detect',
          method 
        })
      });
      if (response.ok) {
        alert('Jailbreak operation initiated');
      }
    } catch (error) {
      console.error('Jailbreak failed:', error);
      alert('Jailbreak operation failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-[#141922] border-[#FF6B9D]/50">
        <Unlock className="h-4 w-4 text-[#FF6B9D]" />
        <AlertDescription className="text-gray-300">
          <strong className="text-[#FF6B9D]">Pandora Codex</strong> - Hardware manipulation, DFU detection, jailbreak automation.
          Proxies to FastAPI backend.
        </AlertDescription>
      </Alert>

      <Alert className="bg-[#0B0F14] border-yellow-500/50">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="text-gray-300">
          <strong className="text-yellow-500">Legal Notice:</strong> All operations are for owner devices only. 
          Use responsibly and in compliance with applicable laws.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="chainbreaker" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-[#141922]">
          <TabsTrigger value="chainbreaker">Chain-Breaker</TabsTrigger>
          <TabsTrigger value="dfu">DFU</TabsTrigger>
          <TabsTrigger value="jailbreak">Jailbreak</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
        </TabsList>

        <TabsContent value="chainbreaker" className="space-y-4">
          <Card className="bg-[#141922] border-[#FF6B9D]/20">
            <CardHeader>
              <CardTitle className="text-white">Chain-Breaker</CardTitle>
              <CardDescription className="text-gray-400">
                Bypass activation locks and security measures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Device Serial</label>
                <Input
                  value={deviceSerial}
                  onChange={(e) => setDeviceSerial(e.target.value)}
                  placeholder="Enter device serial"
                  className="bg-[#0B0F14] border-[#2FD3FF]/50"
                />
              </div>
              <Button 
                onClick={handleChainBreaker}
                disabled={isLoading || !deviceSerial}
                className="bg-[#FF6B9D] hover:bg-[#FF6B9D]/80 text-white w-full"
              >
                <Unlock className="mr-2" />
                {isLoading ? 'Executing...' : 'Execute Chain-Breaker'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dfu" className="space-y-4">
          <Card className="bg-[#141922] border-[#FF6B9D]/20">
            <CardHeader>
              <CardTitle className="text-white">DFU Mode</CardTitle>
              <CardDescription className="text-gray-400">
                Detect and manipulate DFU mode
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={dfuMode ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                    {dfuMode ? 'DFU Mode Detected' : 'No DFU Mode'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    onClick={handleDFUDetect}
                    disabled={isLoading}
                    variant="outline" 
                    className="border-[#2FD3FF]/50"
                  >
                    {isLoading ? 'Detecting...' : 'Detect DFU'}
                  </Button>
                  <Button variant="outline" className="border-[#2FD3FF]/50" disabled>
                    Enter DFU
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jailbreak" className="space-y-4">
          <Card className="bg-[#141922] border-[#FF6B9D]/20">
            <CardHeader>
              <CardTitle className="text-white">Jailbreak Automation</CardTitle>
              <CardDescription className="text-gray-400">
                Automated jailbreak execution (checkra1n, palera1n, dopamine, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Device Serial</label>
                <Input
                  value={deviceSerial}
                  onChange={(e) => setDeviceSerial(e.target.value)}
                  placeholder="Enter device serial"
                  className="bg-[#0B0F14] border-[#2FD3FF]/50"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Method</label>
                <select 
                  id="jailbreak-method"
                  className="w-full bg-[#0B0F14] border border-[#2FD3FF]/50 rounded p-2 text-white"
                  defaultValue="auto-select"
                >
                  <option value="auto-select">Auto-select</option>
                  {jailbreakMethods.map(method => (
                    <option key={method.id} value={method.id}>
                      {method.name} ({method.devices})
                    </option>
                  ))}
                </select>
              </div>
              <Button 
                onClick={() => {
                  const select = document.getElementById('jailbreak-method') as HTMLSelectElement;
                  handleJailbreak(select.value);
                }}
                disabled={isLoading || !deviceSerial}
                className="bg-[#FF6B9D] hover:bg-[#FF6B9D]/80 text-white w-full"
              >
                <Zap className="mr-2" />
                {isLoading ? 'Executing...' : 'Execute Jailbreak'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <Card className="bg-[#141922] border-[#FF6B9D]/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Detected Devices</CardTitle>
                  <CardDescription className="text-gray-400">
                    Compliance: User-initiated scanning only. Click "Scan for Devices" to detect connected iOS devices.
                  </CardDescription>
                </div>
                <Button
                  onClick={loadDevices}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                  className="bg-[#0B0F14] border-[#2FD3FF]/50 text-[#2FD3FF] hover:bg-[#2FD3FF]/10"
                >
                  {isLoading ? (
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
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-2">No devices detected</p>
                  <p className="text-xs text-gray-500">
                    Connect an iOS device via USB and click "Scan for Devices" above
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.map((device) => (
                    <div key={device.serial || device.udid} className="p-3 bg-[#0B0F14] rounded border border-[#2FD3FF]/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Smartphone className="text-[#2FD3FF]" />
                          <div>
                            <p className="text-white font-medium">{device.model || device.name || 'iOS Device'}</p>
                            <p className="text-sm text-gray-400">{device.serial || device.udid}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {device.chip && (
                            <Badge variant="outline" className="text-xs">
                              {device.chip}
                            </Badge>
                          )}
                          {device.ios_version && (
                            <Badge variant="outline" className="text-xs">
                              iOS {device.ios_version}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
