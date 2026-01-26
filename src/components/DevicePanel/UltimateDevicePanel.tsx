/**
 * Ultimate Device Panel
 * 
 * GOD MODE: Complete device information and control center.
 * Everything you need to know about and do with a device.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  Battery,
  HardDrive,
  Wifi,
  Cpu,
  Shield,
  Settings,
  Activity,
  RefreshCw,
  Zap,
  Terminal,
  Download,
  Upload,
  Camera,
  Mic,
  Speaker,
  Monitor,
  Fingerprint,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Play,
  FileText,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { UnifiedDevice, DeviceCapability } from '@/hooks/use-ultimate-device-manager';
import { 
  runDiagnostics, 
  DiagnosticReport, 
  DiagnosticCheck,
  getDiagnosticStatusColor,
  DiagnosticCategory
} from '@/lib/device-diagnostics';
import { SlideUp, StatusIndicator } from '@/components/ui/animated-container';

interface UltimateDevicePanelProps {
  device: UnifiedDevice;
  onClose?: () => void;
  onAction?: (action: string, device: UnifiedDevice) => void;
}

// Mode badge colors
const MODE_COLORS: Record<string, string> = {
  normal: 'bg-green-500/20 text-green-400 border-green-500/50',
  recovery: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  fastboot: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  dfu: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  edl: 'bg-red-500/20 text-red-400 border-red-500/50',
  download: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  unauthorized: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
};

// Capability icons
const CAPABILITY_ICONS: Record<string, React.ReactNode> = {
  adb_shell: <Terminal className="w-3 h-3" />,
  adb_push: <Upload className="w-3 h-3" />,
  adb_pull: <Download className="w-3 h-3" />,
  fastboot_flash: <Zap className="w-3 h-3" />,
  fastboot_unlock: <Unlock className="w-3 h-3" />,
  dfu_restore: <RefreshCw className="w-3 h-3" />,
  checkra1n: <Lock className="w-3 h-3" />,
};

// Category icons
const CATEGORY_ICONS: Record<DiagnosticCategory, React.ReactNode> = {
  battery: <Battery className="w-4 h-4" />,
  storage: <HardDrive className="w-4 h-4" />,
  network: <Wifi className="w-4 h-4" />,
  hardware: <Cpu className="w-4 h-4" />,
  security: <Shield className="w-4 h-4" />,
  software: <Settings className="w-4 h-4" />,
};

export function UltimateDevicePanel({ device, onClose, onAction }: UltimateDevicePanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [diagnostics, setDiagnostics] = useState<DiagnosticReport | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [shellOutput, setShellOutput] = useState<string[]>([]);
  const [shellCommand, setShellCommand] = useState('');

  // Run diagnostics
  const handleRunDiagnostics = useCallback(async () => {
    if (!device.serial) {
      toast.error('Device serial not available');
      return;
    }

    setIsRunningDiagnostics(true);
    try {
      const report = await runDiagnostics(device.serial);
      setDiagnostics(report);
      toast.success(`Diagnostics complete: ${report.overallHealth}% health`);
    } catch (error) {
      toast.error('Diagnostics failed');
    } finally {
      setIsRunningDiagnostics(false);
    }
  }, [device.serial]);

  // Execute shell command
  const handleShellCommand = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shellCommand.trim() || !device.serial) return;

    setShellOutput(prev => [...prev, `$ ${shellCommand}`]);
    
    try {
      const response = await fetch('/api/v1/adb/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serial: device.serial,
          command: shellCommand,
        }),
      });
      
      const data = await response.json();
      if (data.ok && data.data?.output) {
        setShellOutput(prev => [...prev, data.data.output]);
      } else {
        setShellOutput(prev => [...prev, `Error: ${data.error?.message || 'Command failed'}`]);
      }
    } catch (error) {
      setShellOutput(prev => [...prev, `Error: ${error}`]);
    }
    
    setShellCommand('');
  }, [shellCommand, device.serial]);

  // Quick action handler
  const handleQuickAction = useCallback((action: string) => {
    onAction?.(action, device);
    toast.info(`${action} initiated`);
  }, [device, onAction]);

  // Group diagnostics by category
  const diagnosticsByCategory = diagnostics?.checks.reduce((acc, check) => {
    if (!acc[check.category]) acc[check.category] = [];
    acc[check.category].push(check);
    return acc;
  }, {} as Record<DiagnosticCategory, DiagnosticCheck[]>);

  return (
    <div className="h-full flex flex-col bg-basement-concrete">
      {/* Header */}
      <div className="p-4 border-b border-panel bg-workbench-steel">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={cn(
                "w-16 h-16 rounded-xl flex items-center justify-center",
                device.platform === 'android' ? "bg-green-500/20" : "bg-gray-500/20"
              )}>
                <Smartphone className="w-8 h-8 text-ink-primary" />
              </div>
              <StatusIndicator 
                status={device.connectionHealth === 'excellent' ? 'online' : 'warning'}
                className="absolute -bottom-1 -right-1"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink-primary font-mono">
                {device.displayName}
              </h2>
              <p className="text-sm text-ink-muted">
                {device.manufacturer} • {device.serial}
              </p>
              <div className="flex gap-2 mt-2">
                <Badge className={cn("text-xs", MODE_COLORS[device.mode] || MODE_COLORS.unknown)}>
                  {device.mode.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {device.platform.toUpperCase()}
                </Badge>
                {device.isFlashable && (
                  <Badge className="text-xs bg-spray-cyan/20 text-spray-cyan">
                    FLASHABLE
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Quick Stats */}
          {diagnostics && (
            <div className="text-right">
              <div className={cn(
                "text-3xl font-bold font-mono",
                diagnostics.overallHealth >= 80 ? "text-green-400" :
                diagnostics.overallHealth >= 50 ? "text-yellow-400" : "text-red-400"
              )}>
                {diagnostics.overallHealth}%
              </div>
              <p className="text-xs text-ink-muted">Device Health</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-panel bg-workbench-steel px-4">
          <TabsList className="bg-transparent h-auto p-0 space-x-4">
            <TabsTrigger 
              value="overview" 
              className="bg-transparent data-[state=active]:bg-spray-cyan/10 data-[state=active]:text-spray-cyan rounded-none border-b-2 border-transparent data-[state=active]:border-spray-cyan pb-3 pt-2"
            >
              <Activity className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="diagnostics"
              className="bg-transparent data-[state=active]:bg-spray-cyan/10 data-[state=active]:text-spray-cyan rounded-none border-b-2 border-transparent data-[state=active]:border-spray-cyan pb-3 pt-2"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Diagnostics
            </TabsTrigger>
            <TabsTrigger 
              value="shell"
              className="bg-transparent data-[state=active]:bg-spray-cyan/10 data-[state=active]:text-spray-cyan rounded-none border-b-2 border-transparent data-[state=active]:border-spray-cyan pb-3 pt-2"
              disabled={device.mode !== 'normal'}
            >
              <Terminal className="w-4 h-4 mr-2" />
              Shell
            </TabsTrigger>
            <TabsTrigger 
              value="actions"
              className="bg-transparent data-[state=active]:bg-spray-cyan/10 data-[state=active]:text-spray-cyan rounded-none border-b-2 border-transparent data-[state=active]:border-spray-cyan pb-3 pt-2"
            >
              <Zap className="w-4 h-4 mr-2" />
              Actions
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {/* Overview Tab */}
          <TabsContent value="overview" className="p-4 space-y-4 mt-0">
            <SlideUp>
              {/* Device Info Card */}
              <Card className="bg-workbench-steel border-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-spray-cyan" />
                    Device Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-ink-muted">Serial Number</p>
                    <p className="font-mono text-sm">{device.serial || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">Platform</p>
                    <p className="font-mono text-sm">{device.platform}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">Manufacturer</p>
                    <p className="font-mono text-sm">{device.manufacturer || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">Model</p>
                    <p className="font-mono text-sm">{device.model || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">Current Mode</p>
                    <p className="font-mono text-sm capitalize">{device.mode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">Connection</p>
                    <p className="font-mono text-sm capitalize">{device.connectionType}</p>
                  </div>
                  {device.androidVersion && (
                    <div>
                      <p className="text-xs text-ink-muted">Android Version</p>
                      <p className="font-mono text-sm">{device.androidVersion}</p>
                    </div>
                  )}
                  {device.batteryLevel !== undefined && (
                    <div>
                      <p className="text-xs text-ink-muted">Battery Level</p>
                      <p className="font-mono text-sm">{device.batteryLevel}%</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </SlideUp>

            <SlideUp delay={0.1}>
              {/* Capabilities Card */}
              <Card className="bg-workbench-steel border-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <Zap className="w-4 h-4 text-spray-cyan" />
                    Available Capabilities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {device.capabilities.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {device.capabilities.map((cap) => (
                        <Badge 
                          key={cap} 
                          variant="outline"
                          className="text-xs flex items-center gap-1"
                        >
                          {CAPABILITY_ICONS[cap] || <CheckCircle className="w-3 h-3" />}
                          {cap.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-muted">
                      No capabilities available in current mode
                    </p>
                  )}
                </CardContent>
              </Card>
            </SlideUp>

            <SlideUp delay={0.2}>
              {/* Quick Actions */}
              <Card className="bg-workbench-steel border-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    <Play className="w-4 h-4 text-spray-cyan" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleQuickAction('reboot')}
                      disabled={device.mode !== 'normal'}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reboot
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleQuickAction('bootloader')}
                    >
                      <Unlock className="w-4 h-4 mr-2" />
                      Bootloader
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleQuickAction('recovery')}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Recovery
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleRunDiagnostics}
                      disabled={isRunningDiagnostics}
                    >
                      {isRunningDiagnostics ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <BarChart3 className="w-4 h-4 mr-2" />
                      )}
                      Run Diagnostics
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </SlideUp>
          </TabsContent>

          {/* Diagnostics Tab */}
          <TabsContent value="diagnostics" className="p-4 space-y-4 mt-0">
            {!diagnostics ? (
              <div className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="w-16 h-16 text-ink-muted mb-4" />
                <p className="text-ink-muted mb-4">No diagnostics data</p>
                <Button onClick={handleRunDiagnostics} disabled={isRunningDiagnostics}>
                  {isRunningDiagnostics ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Run Full Diagnostics
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <>
                {/* Health Overview */}
                <Card className="bg-workbench-steel border-panel">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-ink-muted">Overall Device Health</p>
                        <div className={cn(
                          "text-4xl font-bold font-mono",
                          diagnostics.overallHealth >= 80 ? "text-green-400" :
                          diagnostics.overallHealth >= 50 ? "text-yellow-400" : "text-red-400"
                        )}>
                          {diagnostics.overallHealth}%
                        </div>
                      </div>
                      <div className="text-right text-sm text-ink-muted">
                        <p>{diagnostics.summary.passed} passed</p>
                        <p>{diagnostics.summary.warnings} warnings</p>
                        <p>{diagnostics.summary.failed} failed</p>
                      </div>
                    </div>
                    <Progress value={diagnostics.overallHealth} className="h-2" />
                  </CardContent>
                </Card>

                {/* Recommendations */}
                {diagnostics.recommendations.length > 0 && (
                  <Card className="bg-yellow-500/10 border-yellow-500/30">
                    <CardContent className="pt-4">
                      <h3 className="font-mono text-sm text-yellow-400 flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        Recommendations
                      </h3>
                      <ul className="space-y-1 text-sm">
                        {diagnostics.recommendations.map((rec, i) => (
                          <li key={i} className="text-ink-muted">• {rec}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Diagnostics by Category */}
                {diagnosticsByCategory && Object.entries(diagnosticsByCategory).map(([category, checks]) => (
                  <Card key={category} className="bg-workbench-steel border-panel">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-mono flex items-center gap-2 capitalize">
                        {CATEGORY_ICONS[category as DiagnosticCategory]}
                        {category}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {checks.map((check) => (
                        <div 
                          key={check.id}
                          className="flex items-center justify-between py-2 border-b border-panel last:border-0"
                        >
                          <div>
                            <p className="text-sm font-medium">{check.name}</p>
                            <p className="text-xs text-ink-muted">{check.description}</p>
                          </div>
                          <div className="text-right">
                            <span className={cn("text-sm font-mono", getDiagnosticStatusColor(check.status))}>
                              {check.value || check.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          {/* Shell Tab */}
          <TabsContent value="shell" className="p-4 mt-0">
            <Card className="bg-black/50 border-panel h-[400px] flex flex-col">
              <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                <ScrollArea className="flex-1 p-4">
                  <div className="font-mono text-sm space-y-1">
                    <p className="text-green-400">$ Bobby's Workshop Shell</p>
                    <p className="text-ink-muted">Connected to {device.serial}</p>
                    <p className="text-ink-muted">---</p>
                    {shellOutput.map((line, i) => (
                      <p key={i} className={cn(
                        line.startsWith('$') ? 'text-spray-cyan' :
                        line.startsWith('Error') ? 'text-red-400' : 'text-ink-primary'
                      )}>
                        {line}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
                <form onSubmit={handleShellCommand} className="p-4 border-t border-panel flex gap-2">
                  <span className="text-spray-cyan font-mono">$</span>
                  <input
                    type="text"
                    value={shellCommand}
                    onChange={(e) => setShellCommand(e.target.value)}
                    placeholder="Enter command..."
                    className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-ink-primary"
                  />
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="p-4 space-y-4 mt-0">
            <div className="grid grid-cols-2 gap-4">
              {/* Reboot Options */}
              <Card className="bg-workbench-steel border-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono">Reboot Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('reboot_system')}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reboot to System
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('reboot_recovery')}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Reboot to Recovery
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('reboot_bootloader')}
                  >
                    <Unlock className="w-4 h-4 mr-2" />
                    Reboot to Bootloader
                  </Button>
                </CardContent>
              </Card>

              {/* Flash Options */}
              <Card className="bg-workbench-steel border-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono">Flash Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('flash_rom')}
                    disabled={!device.isFlashable}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Flash ROM
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('flash_recovery')}
                    disabled={!device.isFlashable}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Flash Recovery
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('sideload')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Sideload Package
                  </Button>
                </CardContent>
              </Card>

              {/* Security Options */}
              <Card className="bg-workbench-steel border-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono">Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('check_bootloader')}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Check Bootloader
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('check_root')}
                  >
                    <Fingerprint className="w-4 h-4 mr-2" />
                    Check Root Status
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-orange-400 hover:text-orange-300"
                    onClick={() => handleQuickAction('secret_rooms')}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Secret Rooms
                  </Button>
                </CardContent>
              </Card>

              {/* Backup Options */}
              <Card className="bg-workbench-steel border-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono">Backup & Restore</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('backup_full')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Full Backup
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('backup_partitions')}
                  >
                    <HardDrive className="w-4 h-4 mr-2" />
                    Partition Backup
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('restore')}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Restore Backup
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

export default UltimateDevicePanel;
