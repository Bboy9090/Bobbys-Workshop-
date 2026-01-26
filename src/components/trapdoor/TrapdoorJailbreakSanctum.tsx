/**
 * TrapdoorJailbreakSanctum
 * 
 * iOS jailbreak operations interface
 */

import React, { useState } from 'react';
import { Smartphone, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TerminalLogStream, LogEntry } from '../core/TerminalLogStream';
import { ToolboxDangerLever } from '../toolbox/ToolboxDangerLever';
import { TrapdoorInstructionsPanel } from './TrapdoorInstructionsPanel';
import { useApp } from '@/lib/app-context';

interface TrapdoorJailbreakSanctumProps {
  passcode?: string;
  className?: string;
}

export function TrapdoorJailbreakSanctum({
  passcode,
  className,
}: TrapdoorJailbreakSanctumProps) {
  const { backendAvailable } = useApp();
  const [udid, setUdid] = useState('');
  const [method, setMethod] = useState<'checkra1n' | 'palera1n' | 'unc0ver' | 'taurine'>('checkra1n');
  const [iosVersion, setIosVersion] = useState('');
  const [jailbreakConfirmation, setJailbreakConfirmation] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [operationComplete, setOperationComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredJailbreakText = 'JAILBREAK';
  const canProceed = 
    udid &&
    jailbreakConfirmation === requiredJailbreakText &&
    !isExecuting &&
    backendAvailable &&
    passcode;

  const handleExecute = async () => {
    if (!udid || !passcode || !canProceed) return;

    setIsExecuting(true);
    setError(null);
    setLogs([]);
    setOperationComplete(false);

    setLogs([{
      id: '1',
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `[JAILBREAK] Starting ${method} jailbreak for iOS ${iosVersion || 'unknown'}`,
      source: 'jailbreak-sanctum',
    }]);

    try {
      const response = await fetch('/api/v1/trapdoor/ios/jailbreak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          udid,
          method,
          iosVersion,
          confirmation: jailbreakConfirmation,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const envelope = await response.json();

      if (!envelope.ok) {
        throw new Error(envelope.error?.message || 'Jailbreak operation failed');
      }

      if (envelope.data?.logs) {
        const streamLogs: LogEntry[] = envelope.data.logs.map((log: any, idx: number) => ({
          id: `log-${idx}`,
          timestamp: log.timestamp || new Date().toISOString(),
          level: log.level || 'info',
          message: log.message || log.text || JSON.stringify(log),
          source: 'jailbreak-sanctum',
        }));
        setLogs(streamLogs);
      }

      setOperationComplete(true);
      setLogs(prev => [...prev, {
        id: 'success',
        timestamp: new Date().toISOString(),
        level: 'success',
        message: '[JAILBREAK] Jailbreak operation completed successfully',
        source: 'jailbreak-sanctum',
      }]);
    } catch (err) {
      console.error('[TrapdoorJailbreakSanctum] Execution error:', err);
      setError(err instanceof Error ? err.message : 'Operation failed');
      setLogs(prev => [...prev, {
        id: 'error',
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `[JAILBREAK] Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        source: 'jailbreak-sanctum',
      }]);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className={cn("h-full flex flex-col bg-basement-concrete", className)}>
      <div className="p-4 border-b border-panel bg-basement-concrete">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg border border-state-danger/50 bg-state-danger/10 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-state-danger" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-primary font-mono">
              Jailbreak Sanctum
            </h1>
            <p className="text-xs text-ink-muted">
              iOS jailbreak & manipulation
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg border-2 border-state-danger/50 bg-state-danger/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-state-danger" />
            <span className="text-lg font-bold text-state-danger font-mono uppercase tracking-wider">
              DANGEROUS OPERATION
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-2">
            Jailbreaking may void warranty and can cause device instability.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Device UDID
          </label>
          <input
            type="text"
            value={udid}
            onChange={(e) => setUdid(e.target.value)}
            placeholder="00008030-001A..."
            className="w-full px-4 py-3 rounded-lg bg-workbench-steel border border-panel text-ink-primary font-mono text-sm placeholder:text-ink-muted focus:outline-none focus:border-spray-cyan focus:glow-cyan transition-all motion-snap"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Jailbreak Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="w-full px-4 py-3 rounded-lg bg-workbench-steel border border-panel text-ink-primary font-mono text-sm focus:outline-none focus:border-spray-cyan focus:glow-cyan transition-all motion-snap"
          >
            <option value="checkra1n">checkra1n</option>
            <option value="palera1n">palera1n</option>
            <option value="unc0ver">unc0ver</option>
            <option value="taurine">taurine</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            iOS Version (optional)
          </label>
          <input
            type="text"
            value={iosVersion}
            onChange={(e) => setIosVersion(e.target.value)}
            placeholder="14.8"
            className="w-full px-4 py-3 rounded-lg bg-workbench-steel border border-panel text-ink-primary font-mono text-sm placeholder:text-ink-muted focus:outline-none focus:border-spray-cyan focus:glow-cyan transition-all motion-snap"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Type "{requiredJailbreakText}" to confirm
          </label>
          <input
            type="text"
            value={jailbreakConfirmation}
            onChange={(e) => setJailbreakConfirmation(e.target.value)}
            placeholder={requiredJailbreakText}
            className={cn(
              "w-full px-4 py-3 rounded-lg bg-workbench-steel border font-mono text-sm",
              "text-ink-primary placeholder:text-ink-muted",
              "focus:outline-none transition-all motion-snap",
              jailbreakConfirmation === requiredJailbreakText
                ? "border-state-ready focus:border-state-ready"
                : jailbreakConfirmation.length > 0
                ? "border-state-danger focus:border-state-danger"
                : "border-panel focus:border-spray-cyan focus:glow-cyan"
            )}
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-state-danger/50 bg-state-danger/10">
            <p className="text-sm text-state-danger font-mono">{error}</p>
          </div>
        )}

        {operationComplete && (
          <div className="p-4 rounded-lg border border-state-ready/50 bg-state-ready/10">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-state-ready" />
              <span className="text-sm font-bold text-state-ready font-mono">
                Jailbreak Operation Complete
              </span>
            </div>
          </div>
        )}

        <ToolboxDangerLever
          onConfirm={handleExecute}
          disabled={!canProceed}
          label="HOLD TO JAILBREAK DEVICE"
          warning="Jailbreaking may void warranty and can cause device instability. This operation requires external tools."
        />

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
      </div>
    </div>
  );
}
