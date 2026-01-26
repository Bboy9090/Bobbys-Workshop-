/**
 * Workflow Engine Panel - Secret Room #6
 * 
 * Automated workflow execution (custom workflows, conditional logic, parallel execution)
 * Risk Level: Medium (Jordan Chicago - Red/White/Black)
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Activity, AlertTriangle, Loader2, Play, FileText, Zap, CheckCircle } from 'lucide-react';
import { RiskButton, RiskLevel } from '../unified';
import { toast } from 'sonner';
import { WorkflowExecutionConsole } from '../WorkflowExecutionConsole';

interface WorkflowEnginePanelProps {
  deviceSerial?: string;
}

export const WorkflowEnginePanel: React.FC<WorkflowEnginePanelProps> = ({ deviceSerial: initialDeviceSerial }) => {
  const [deviceSerial, setDeviceSerial] = useState(initialDeviceSerial || '');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customWorkflowId, setCustomWorkflowId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workflowTemplates = [
    {
      id: 'full-device-setup',
      name: 'Full Device Setup',
      description: 'Unlock, root, and customize device',
      riskLevel: 'high' as RiskLevel,
    },
    {
      id: 'backup-restore',
      name: 'Backup & Restore',
      description: 'Complete device backup and restore',
      riskLevel: 'medium' as RiskLevel,
    },
    {
      id: 'firmware-update',
      name: 'Firmware Update',
      description: 'Update device firmware safely',
      riskLevel: 'high' as RiskLevel,
    },
    {
      id: 'clean-install',
      name: 'Clean Install',
      description: 'Wipe and reinstall everything',
      riskLevel: 'high' as RiskLevel,
    },
  ];

  const handleExecuteWorkflow = async (templateId: string) => {
    if (!deviceSerial) {
      toast.error('Device serial required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      
      const response = await fetch('/api/v1/trapdoor/workflows/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          workflowId: templateId,
          devices: [deviceSerial],
          parameters: {},
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Workflow execution failed: ${response.statusText}`);
      }

      toast.success('Workflow execution initiated');
      setSelectedTemplate(null);
      setCustomWorkflowId('');
    } catch (err: any) {
      setError(err.message || 'Workflow execution failed');
      toast.error(err.message || 'Workflow execution failed');
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
                <Activity className="h-6 w-6 text-[#2FD3FF]" />
              </div>
              <div>
                <CardTitle className="text-legendary text-2xl font-display uppercase text-white">
                  Workflow Engine
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Automated workflow execution - Chain operations together like a LEGEND
                </CardDescription>
              </div>
            </div>
            <Badge variant="default" className="text-xs">
              MEDIUM RISK
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-[#0B0F14] border-[#2FD3FF]/50">
            <AlertTriangle className="h-4 w-4 text-[#2FD3FF]" />
            <AlertDescription className="text-gray-300">
              <strong className="text-[#2FD3FF]">Workflow Engine:</strong> Execute complex multi-step operations 
              with conditional logic, parallel execution, and automatic error recovery.
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
                placeholder="Enter device serial (or leave empty for custom workflow)"
                className="bg-[#0B0F14] border-[#2FD3FF]/50 text-white"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Workflow Templates
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflowTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className={`bg-[#0B0F14] border-2 cursor-pointer transition-all ${
                      selectedTemplate === template.id
                        ? 'border-[#2FD3FF] bg-[#2FD3FF]/10'
                        : 'border-[#2FD3FF]/20 hover:border-[#2FD3FF]/50'
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-[#2FD3FF]" />
                          <CardTitle className="text-white text-sm">{template.name}</CardTitle>
                        </div>
                        <Badge variant={template.riskLevel === 'high' ? 'destructive' : 'default'} className="text-xs">
                          {template.riskLevel.toUpperCase()}
                        </Badge>
                      </div>
                      <CardDescription className="text-gray-400 text-xs">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            {(selectedTemplate || customWorkflowId) && (
              <div className="space-y-4 pt-4 border-t border-[#2FD3FF]/20">
                <Alert className="bg-[#0B0F14] border-[#2FD3FF]/50">
                  <AlertTriangle className="h-4 w-4 text-[#2FD3FF]" />
                  <AlertDescription className="text-gray-300">
                    <strong className="text-[#2FD3FF]">Ready to Execute:</strong>{' '}
                    {selectedTemplate 
                      ? workflowTemplates.find(t => t.id === selectedTemplate)?.name 
                      : `Custom workflow: ${customWorkflowId}`}
                  </AlertDescription>
                </Alert>

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Custom Workflow ID (optional)
                  </label>
                  <Input
                    value={customWorkflowId}
                    onChange={(e) => setCustomWorkflowId(e.target.value)}
                    placeholder="Enter custom workflow ID (or use template above)"
                    className="bg-[#0B0F14] border-[#2FD3FF]/50 text-white"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <RiskButton
                  riskLevel={selectedTemplate ? workflowTemplates.find(t => t.id === selectedTemplate)?.riskLevel || 'medium' : 'medium'}
                  onClick={() => handleExecuteWorkflow(selectedTemplate || customWorkflowId)}
                  disabled={isLoading || (!selectedTemplate && !customWorkflowId)}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Execute {selectedTemplate ? workflowTemplates.find(t => t.id === selectedTemplate)?.name : 'Custom Workflow'}
                    </>
                  )}
                </RiskButton>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#141922] border-[#2FD3FF]/20">
        <CardHeader>
          <CardTitle className="text-white">Workflow Execution Console</CardTitle>
          <CardDescription className="text-gray-400">
            Real-time workflow execution monitoring and management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowExecutionConsole />
        </CardContent>
      </Card>
    </div>
  );
};
