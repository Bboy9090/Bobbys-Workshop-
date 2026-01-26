/**
 * Secret Room Documentation Component
 * 
 * Displays comprehensive documentation about Bobby's Secret Rooms
 * Includes philosophy, access control, room descriptions, and safety information
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { 
  Lock, 
  Shield, 
  Key, 
  AlertTriangle, 
  Info, 
  FileText,
  Zap,
  Unlock,
  Smartphone,
  Cpu,
  Activity,
  Database,
  Mic,
  FileX,
  Workflow
} from 'lucide-react';
import { Badge } from '../ui/badge';

interface SecretRoomDocsProps {
  roomId?: string; // If provided, shows specific room documentation
}

export function SecretRoomDocs({ roomId }: SecretRoomDocsProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const secretRooms = [
    {
      id: 'unlock',
      name: 'The Unlock Chamber',
      icon: Unlock,
      description: 'Complete device unlock automation',
      features: [
        'FRP Bypass - Factory Reset Protection removal (owner devices only)',
        'Bootloader Unlock - Automated unlock across all brands',
        'OEM Unlock Enable - Unlock the unlocker',
        'Security Patch Bypass - For testing and research (owner devices)'
      ],
      riskLevel: 'high',
      endpoint: '/api/v1/trapdoor/unlock'
    },
    {
      id: 'flash',
      name: 'The Flash Forge',
      icon: Zap,
      description: 'Multi-brand flash operations',
      features: [
        'Samsung Odin Automation - Full Odin protocol support',
        'MediaTek SP Flash - Preloader/DA mode flashing',
        'Qualcomm EDL - Firehose protocol automation',
        'Custom Recovery Installation - TWRP, OrangeFox, any recovery',
        'Partition-Level Operations - Direct partition manipulation'
      ],
      riskLevel: 'high',
      endpoint: '/api/v1/trapdoor/flash'
    },
    {
      id: 'ios',
      name: 'The Jailbreak Sanctum',
      icon: Smartphone,
      description: 'iOS device manipulation',
      features: [
        'DFU Mode Automation - Enter/exit DFU automatically',
        'Jailbreak Integration - checkra1n, palera1n automation',
        'SHSH Blob Management - Save/restore signing blobs',
        'FutureRestore Automation - Restore to unsigned iOS versions',
        'iTunes Backup Manipulation - Extract, modify, restore backups'
      ],
      riskLevel: 'high',
      endpoint: '/api/v1/trapdoor/ios'
    },
    {
      id: 'root',
      name: 'The Root Vault',
      icon: Shield,
      description: 'Root installation and management',
      features: [
        'Magisk Installation - Automated root via recovery',
        'SuperSU Installation - Legacy root support',
        'Xposed Framework - LSPosed module installation',
        'Root Verification - Confirm root status',
        'System App Management - Install/uninstall system apps'
      ],
      riskLevel: 'medium',
      endpoint: '/api/v1/trapdoor/root'
    },
    {
      id: 'bypass',
      name: 'The Bypass Laboratory',
      icon: Key,
      description: 'Security bypass automation',
      features: [
        'Screen Lock Bypass - FRP lock removal (owner devices)',
        'Biometric Bypass - Fingerprint/Face ID testing (research mode)',
        'Certificate Pinning Bypass - For security research',
        'MDM Removal - Enterprise profile removal (authorized only)',
        'Encryption Bypass - For data recovery (owner devices)'
      ],
      riskLevel: 'high',
      endpoint: '/api/v1/trapdoor/bypass'
    },
    {
      id: 'workflows',
      name: 'The Workflow Engine',
      icon: Workflow,
      description: 'Automated workflow execution',
      features: [
        'Custom Workflow Execution - Run complex multi-step operations',
        'Conditional Logic - If/then/else workflows',
        'Parallel Execution - Multiple devices, simultaneously',
        'Error Recovery - Automatic retry with exponential backoff',
        'Workflow Templates - Pre-built workflows for common tasks'
      ],
      riskLevel: 'medium',
      endpoint: '/api/v1/trapdoor/workflows'
    },
    {
      id: 'logs',
      name: 'The Shadow Archive',
      icon: Database,
      description: 'Complete operation history',
      features: [
        'Shadow Logs - Encrypted, immutable audit logs',
        'Operation History - Complete device operation timeline',
        'Correlation Tracking - Link operations across devices',
        'Analytics Dashboard - Visualize your operations',
        'Export Capabilities - Export logs for compliance'
      ],
      riskLevel: 'admin',
      endpoint: '/api/v1/trapdoor/logs'
    },
    {
      id: 'sonic',
      name: 'Sonic Codex',
      icon: Mic,
      description: 'Audio processing and transcription',
      features: [
        'Audio Capture - Live/file/URL',
        'Forensic Enhancement - Spectral gating, consonant boost',
        'Whisper Transcription - High-accuracy speech-to-text',
        'Speaker Diarization - Identify different speakers',
        'Export Forensic Packages - Complete audio analysis'
      ],
      riskLevel: 'medium',
      endpoint: '/api/v1/trapdoor/sonic'
    },
    {
      id: 'ghost',
      name: 'Ghost Codex',
      icon: FileX,
      description: 'Metadata shredding and privacy',
      features: [
        'Metadata Shredder - Images, videos, audio, PDFs',
        'Canary Token Generator - Trap files that alert when accessed',
        'Burner Persona Creation - Temporary identities',
        'Privacy Tools - Complete data anonymization',
        'Stealth Mode - Leave no trace'
      ],
      riskLevel: 'medium',
      endpoint: '/api/v1/trapdoor/ghost'
    },
    {
      id: 'pandora',
      name: 'Pandora Codex',
      icon: Cpu,
      description: 'Hardware manipulation and Chain-Breaker',
      features: [
        'USB Device Detection - Advanced hardware scanning',
        'DFU Mode Detection - iOS device modes',
        'Hardware Manipulation - Low-level device control',
        'Jailbreak Automation - Automated iOS jailbreaking',
        'Chain-Breaker Operations - Activation bypass'
      ],
      riskLevel: 'high',
      endpoint: '/api/v1/trapdoor/pandora'
    }
  ];

  const selectedRoom = roomId ? secretRooms.find(r => r.id === roomId) : null;

  return (
    <div className="space-y-6">
      <Card className="card-jordan">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-lg">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-legendary text-2xl font-display uppercase">
                Bobby's Secret Rooms
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                The Hidden Power Behind Bobby's Workshop
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="rooms">Secret Rooms</TabsTrigger>
              <TabsTrigger value="access">Access Control</TabsTrigger>
              <TabsTrigger value="safety">Safety & Legal</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold uppercase tracking-wide mb-2">
                    What Are Bobby's Secret Rooms?
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    <strong>Bobby's Secret Rooms</strong> are ultra-secure, authenticated access points 
                    to the most advanced device manipulation capabilities ever built. Think of them as 
                    the "master control room" - where the real magic happens.
                  </p>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>The Philosophy:</strong> "Not everything should be accessible to everyone. 
                    Some operations are so powerful, so dangerous, so LEGENDARY that they require a 
                    special key. That key is Bobby's Secret Rooms."
                  </AlertDescription>
                </Alert>

                <div>
                  <h4 className="font-semibold uppercase tracking-wide mb-2">
                    Why Secret Rooms Are LEGENDARY
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Power Without Compromise</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        Full automation of operations that normally take hours. Multi-device support. 
                        Error recovery built-in. Complete audit trails.
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Security First</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        Passcode-protected access. Rate limiting. Shadow logging. Policy enforcement.
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Industry-Leading</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        No other tool has this level of automation, security, and capability.
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">The Bobby Difference</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        Built for professionals. Built for power users. Built for LEGENDS.
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rooms" className="space-y-4 mt-4">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {secretRooms.map((room) => {
                    const Icon = room.icon;
                    return (
                      <Card key={room.id} className="hover:border-primary/50 transition-colors">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-lg font-display uppercase">
                                  {room.name}
                                </CardTitle>
                                <CardDescription>{room.description}</CardDescription>
                              </div>
                            </div>
                            <Badge variant={
                              room.riskLevel === 'high' ? 'destructive' :
                              room.riskLevel === 'medium' ? 'default' : 'secondary'
                            }>
                              {room.riskLevel.toUpperCase()} RISK
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="text-xs font-mono text-muted-foreground">
                              Endpoint: <code className="bg-muted px-1 rounded">{room.endpoint}</code>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Features:</h4>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                {room.features.map((feature, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-primary mt-1">•</span>
                                    <span>{feature}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="access" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold uppercase tracking-wide mb-2">
                    Authentication Required
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Every Secret Room operation requires <strong>Trapdoor Authentication</strong>:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground ml-4">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Header:</strong> <code className="bg-muted px-1 rounded">X-Secret-Room-Passcode: &lt;your-passcode&gt;</code></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Alternative:</strong> <code className="bg-muted px-1 rounded">X-API-Key: &lt;your-api-key&gt;</code></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Rate Limited:</strong> Maximum security with request throttling</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Audit Logged:</strong> Every action is recorded in Shadow Logs</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold uppercase tracking-wide mb-2">
                    The Passcode System
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    The passcode is your <strong>master key</strong> to unlock:
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-4 mt-2">
                    <li>• Destructive operations</li>
                    <li>• Advanced bypasses</li>
                    <li>• Unrestricted device access</li>
                    <li>• Experimental features</li>
                    <li>• The LEGENDARY capabilities</li>
                  </ul>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    All Secret Room operations are under <code className="bg-muted px-1 rounded">/api/v1/trapdoor/*</code>
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            <TabsContent value="safety" className="space-y-4 mt-4">
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Legal & Ethical:</strong> Owner Devices Only - All operations are for devices you own. 
                    Authorized Use - Only use for legitimate purposes. Compliance - Follow all applicable laws and regulations.
                  </AlertDescription>
                </Alert>

                <div>
                  <h3 className="text-lg font-semibold uppercase tracking-wide mb-2">
                    Safety Requirements
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-primary mt-0.5" />
                      <span><strong>Confirmation Required</strong> - Destructive operations require explicit confirmation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Lock className="h-4 w-4 text-primary mt-0.5" />
                      <span><strong>Device Locking</strong> - Only one operation per device at a time</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-primary mt-0.5" />
                      <span><strong>Audit Logging</strong> - Every action is logged</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold uppercase tracking-wide mb-2">
                    Responsibility
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• <strong>Use Wisely</strong> - With great power comes great responsibility</li>
                    <li>• <strong>Test First</strong> - Always test on non-critical devices</li>
                    <li>• <strong>Backup Everything</strong> - Before any destructive operation</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
