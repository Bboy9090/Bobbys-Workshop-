/**
 * TrapdoorInstructionsPanel
 * 
 * Reusable instruction panel for secret room operations
 */

import React from 'react';
import { Download, ExternalLink, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InstructionStep {
  number: number;
  title: string;
  description: string;
  command?: string;
  warning?: string;
}

interface RequiredFile {
  name: string;
  description: string;
  downloadUrl?: string;
  size?: string;
  required: boolean;
}

interface TrapdoorInstructionsPanelProps {
  title: string;
  description: string;
  steps: InstructionStep[];
  requiredFiles?: RequiredFile[];
  prerequisites?: string[];
  warnings?: string[];
  className?: string;
}

export function TrapdoorInstructionsPanel({
  title,
  description,
  steps,
  requiredFiles = [],
  prerequisites = [],
  warnings = [],
  className,
}: TrapdoorInstructionsPanelProps) {
  return (
    <div className={cn("p-4 rounded-lg border border-panel bg-workbench-steel space-y-4", className)}>
      <div>
        <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-ink-primary mb-1">
          {title}
        </h3>
        <p className="text-xs text-ink-muted">{description}</p>
      </div>

      {prerequisites.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted">Prerequisites</h4>
          <ul className="space-y-1">
            {prerequisites.map((req, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-ink-muted">
                <CheckCircle2 className="w-3.5 h-3.5 text-spray-cyan shrink-0 mt-0.5" />
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {requiredFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Required Files
          </h4>
          <div className="space-y-2">
            {requiredFiles.map((file, idx) => (
              <div key={idx} className="p-2 rounded border border-panel bg-basement-concrete">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-ink-primary">{file.name}</p>
                    <p className="text-xs text-ink-muted mt-0.5">{file.description}</p>
                    {file.size && (
                      <p className="text-xs text-ink-muted/70 mt-0.5">Size: {file.size}</p>
                    )}
                  </div>
                  {file.downloadUrl ? (
                    <a
                      href={file.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 px-2 py-1 rounded border border-spray-cyan/30 bg-spray-cyan/10 hover:bg-spray-cyan/20 transition-colors flex items-center gap-1 text-xs text-spray-cyan"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  ) : (
                    <span className="shrink-0 px-2 py-1 rounded border border-panel text-xs text-ink-muted">
                      Manual
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-2 rounded border border-state-danger/30 bg-state-danger/10">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-state-danger shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              {warnings.map((warning, idx) => (
                <p key={idx} className="text-xs text-state-danger font-mono">{warning}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-mono uppercase tracking-wider text-ink-muted">Step-by-Step Instructions</h4>
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full border-2 border-spray-cyan bg-spray-cyan/10 flex items-center justify-center">
                <span className="text-xs font-mono font-bold text-spray-cyan">{step.number}</span>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs font-mono font-medium text-ink-primary">{step.title}</p>
                <p className="text-xs text-ink-muted">{step.description}</p>
                {step.command && (
                  <code className="block px-2 py-1 rounded bg-basement-concrete border border-panel text-xs font-mono text-spray-cyan mt-1">
                    {step.command}
                  </code>
                )}
                {step.warning && (
                  <p className="text-xs text-state-danger font-mono mt-1">⚠ {step.warning}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
