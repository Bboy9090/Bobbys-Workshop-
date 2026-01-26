/**
 * Node Inspector
 * 
 * Side panel showing properties and configuration for the selected node.
 */

import React from 'react';
import { Node } from '@/nodes/core/NodeTypes';
import { cn } from '@/lib/utils';

export interface NodeInspectorProps {
  node: Node;
  onConfigChange?: (nodeId: string, config: any) => void;
  className?: string;
}

export function NodeInspector({ node, onConfigChange, className }: NodeInspectorProps) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b border-secrets-border">
        <h2 className="text-lg font-semibold text-ink-primary">Node Inspector</h2>
        <div className="mt-1 text-xs text-ink-muted">{node.type}</div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Status */}
        <div>
          <h3 className="text-sm font-medium text-ink-primary mb-2">Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-secondary">State</span>
              <span className={cn(
                'font-medium',
                node.state.status === 'success' && 'text-success-green',
                node.state.status === 'error' && 'text-danger-red',
                node.state.status === 'running' && 'text-trap-cyan',
                node.state.status === 'warning' && 'text-warning-amber'
              )}>
                {node.state.status || 'idle'}
              </span>
            </div>
            {node.state.progress !== undefined && (
              <div>
                <div className="flex justify-between text-xs text-ink-muted mb-1">
                  <span>Progress</span>
                  <span>{node.state.progress}%</span>
                </div>
                <div className="h-2 bg-secrets-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-trap-cyan transition-all"
                    style={{ width: `${node.state.progress}%` }}
                  />
                </div>
              </div>
            )}
            {node.state.error && (
              <div className="text-sm text-danger-red bg-danger-red/10 p-2 rounded">
                {node.state.error}
              </div>
            )}
          </div>
        </div>

        {/* Configuration */}
        <div>
          <h3 className="text-sm font-medium text-ink-primary mb-2">Configuration</h3>
          <div className="space-y-2">
            {Object.entries(node.config).map(([key, value]) => (
              <div key={key} className="text-sm">
                <div className="text-ink-secondary mb-1">{key}</div>
                <div className="text-ink-primary font-mono text-xs bg-secrets-bg p-2 rounded border border-secrets-border">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </div>
              </div>
            ))}
            {Object.keys(node.config).length === 0 && (
              <div className="text-sm text-ink-muted">No configuration</div>
            )}
          </div>
        </div>

        {/* Inputs */}
        {node.inputs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-ink-primary mb-2">Inputs</h3>
            <div className="space-y-2">
              {node.inputs.map(input => (
                <div key={input.id} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-trap-cyan border-2 border-secrets-surface" />
                    <span className="text-ink-primary">{input.name}</span>
                    {input.required && (
                      <span className="text-xs text-danger-red">*</span>
                    )}
                  </div>
                  {input.description && (
                    <div className="text-xs text-ink-muted ml-5">{input.description}</div>
                  )}
                  <div className="text-xs text-ink-muted ml-5">Type: {input.type}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outputs */}
        {node.outputs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-ink-primary mb-2">Outputs</h3>
            <div className="space-y-2">
              {node.outputs.map(output => (
                <div key={output.id} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-success-green border-2 border-secrets-surface" />
                    <span className="text-ink-primary">{output.name}</span>
                  </div>
                  {output.description && (
                    <div className="text-xs text-ink-muted ml-5">{output.description}</div>
                  )}
                  <div className="text-xs text-ink-muted ml-5">Type: {output.type}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div>
          <h3 className="text-sm font-medium text-ink-primary mb-2">Metadata</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-secondary">Category</span>
              <span className="text-ink-primary">{node.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-secondary">Created</span>
              <span className="text-ink-primary">
                {new Date(node.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-secondary">Updated</span>
              <span className="text-ink-primary">
                {new Date(node.updatedAt).toLocaleString()}
              </span>
            </div>
            {node.trapdoor && (
              <div className="mt-2 p-2 bg-secret-purple/10 border border-secret-purple/30 rounded text-secret-purple">
                🔒 Trapdoor Node - Requires unlock
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
