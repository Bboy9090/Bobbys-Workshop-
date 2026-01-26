/**
 * TrapdoorWorkflowEngine
 * 
 * Advanced workflow automation interface
 */

import React, { useState, useEffect } from 'react';
import { Zap, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TerminalLogStream, LogEntry } from '../core/TerminalLogStream';
import { useApp } from '@/lib/app-context';

interface TrapdoorWorkflowEngineProps {
  passcode?: string;
  className?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  platform: string;
  category: string;
  riskLevel: string;
  description?: string;
}

export function TrapdoorWorkflowEngine({
  passcode,
  className,
}: TrapdoorWorkflowEngineProps) {
  const { backendAvailable } = useApp();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [deviceSerials, setDeviceSerials] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [operationComplete, setOperationComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load workflow templates
  useEffect(() => {
    if (!backendAvailable || !passcode) return;

    let cancelled = false;

    async function fetchTemplates() {
      setLoading(true);
      try {
        const response = await fetch('/api/v1/trapdoor/workflows/templates', {
          headers: {
            'X-Secret-Room-Passcode': passcode,
          },
        });

        if (cancelled) return;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const envelope = await response.json();
        if (envelope.ok && envelope.data?.templates) {
          setTemplates(envelope.data.templates);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[TrapdoorWorkflowEngine] Fetch error:', err);
          setError(err instanceof Error ? err.message : 'Failed to load templates');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTemplates();

    return () => {
      cancelled = true;
    };
  }, [backendAvailable, passcode]);

  const handleExecute = async () => {
    if (!selectedTemplate || !passcode) return;

    setIsExecuting(true);
    setError(null);
    setLogs([]);
    setOperationComplete(false);

    const devices = deviceSerials.split(',').map(s => s.trim()).filter(Boolean);

    setLogs([{
      id: '1',
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `[WORKFLOW] Starting workflow: ${selectedTemplate}`,
      source: 'workflow-engine',
    }]);

    try {
      const response = await fetch('/api/v1/trapdoor/workflows/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          workflowId: selectedTemplate,
          devices: devices.length > 0 ? devices : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const envelope = await response.json();

      if (!envelope.ok) {
        throw new Error(envelope.error?.message || 'Workflow execution failed');
      }

      setOperationComplete(true);
      setLogs(prev => [...prev, {
        id: 'success',
        timestamp: new Date().toISOString(),
        level: 'success',
        message: '[WORKFLOW] Workflow execution started successfully',
        source: 'workflow-engine',
      }]);
    } catch (err) {
      console.error('[TrapdoorWorkflowEngine] Execution error:', err);
      setError(err instanceof Error ? err.message : 'Operation failed');
      setLogs(prev => [...prev, {
        id: 'error',
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `[WORKFLOW] Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        source: 'workflow-engine',
      }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const canExecute = selectedTemplate && !isExecuting && backendAvailable && passcode;

  return (
    <div className={cn("h-full flex flex-col bg-basement-concrete", className)}>
      <div className="p-4 border-b border-panel bg-basement-concrete">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg border border-spray-cyan/30 bg-spray-cyan/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-spray-cyan" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-primary font-mono">
              Workflow Engine
            </h1>
            <p className="text-xs text-ink-muted">
              Advanced automation
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-spray-cyan border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm font-mono text-ink-muted">Loading workflow templates...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-ink-muted">
                Select Workflow Template
              </label>
              {templates.length === 0 ? (
                <div className="p-4 rounded-lg border border-panel bg-workbench-steel text-center text-ink-muted">
                  <p className="text-sm">No workflow templates available</p>
                  <p className="text-xs mt-1">Workflows are loaded from the workflows/ directory</p>
                </div>
              ) : (
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-workbench-steel border border-panel text-ink-primary font-mono text-sm focus:outline-none focus:border-spray-cyan focus:glow-cyan transition-all motion-snap"
                >
                  <option value="">-- Select Workflow --</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.platform}) - {template.riskLevel}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedTemplate && (
              <>
                <div className="p-3 rounded-lg border border-panel bg-workbench-steel">
                  {templates.find(t => t.id === selectedTemplate) && (
                    <div>
                      <p className="text-sm font-mono text-ink-primary mb-1">
                        {templates.find(t => t.id === selectedTemplate)?.name}
                      </p>
                      {templates.find(t => t.id === selectedTemplate)?.description && (
                        <p className="text-xs text-ink-muted">
                          {templates.find(t => t.id === selectedTemplate)?.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-ink-muted">
                    Device Serials (comma-separated, optional)
                  </label>
                  <input
                    type="text"
                    value={deviceSerials}
                    onChange={(e) => setDeviceSerials(e.target.value)}
                    placeholder="ABC123, DEF456"
                    className="w-full px-4 py-3 rounded-lg bg-workbench-steel border border-panel text-ink-primary font-mono text-sm placeholder:text-ink-muted focus:outline-none focus:border-spray-cyan focus:glow-cyan transition-all motion-snap"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg border border-state-danger/50 bg-state-danger/10 flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-state-danger shrink-0 mt-0.5" />
                    <p className="text-sm text-state-danger font-mono">{error}</p>
                  </div>
                )}

                {operationComplete && (
                  <div className="p-4 rounded-lg border border-state-ready/50 bg-state-ready/10">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-state-ready" />
                      <span className="text-sm font-bold text-state-ready font-mono">
                        Workflow Execution Started
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted">
                      Workflow execution has been initiated. Check Shadow Archive for detailed logs.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleExecute}
                  disabled={!canExecute}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border font-mono text-sm transition-all motion-snap",
                    "flex items-center justify-center gap-2",
                    canExecute
                      ? "bg-workbench-steel border-spray-cyan text-spray-cyan hover:glow-cyan"
                      : "bg-basement-concrete border-panel text-ink-muted opacity-50 cursor-not-allowed"
                  )}
                >
                  <Zap className="w-4 h-4" />
                  Execute Workflow
                </button>

                {logs.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-mono uppercase tracking-wider text-ink-muted">
                      Execution Logs
                    </h3>
                    <div className="h-64 rounded-lg border border-panel overflow-hidden">
                      <TerminalLogStream
                        logs={logs}
                        maxLines={100}
                        autoScroll={true}
                        className="h-full"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
