/**
 * Base Node Component
 * 
 * Base component for all nodes in the system.
 * Provides common functionality: rendering, state management, connections.
 */

import React, { useState, useCallback } from 'react';
import { Node, NodeStatus, NodePosition } from '../core/NodeTypes';
import { cn } from '@/lib/utils';
import { 
  Play, 
  Check, 
  X, 
  AlertTriangle, 
  Lock,
  MoreVertical 
} from 'lucide-react';

export interface BaseNodeProps {
  node: Node;
  selected?: boolean;
  onSelect?: (nodeId: string) => void;
  onMove?: (nodeId: string, position: NodePosition) => void;
  onConfigChange?: (nodeId: string, config: any) => void;
  onExecute?: (nodeId: string) => void;
  onNodeUpdate?: (node: Node) => void;
  className?: string;
}

const statusColors = {
  idle: 'border-gray-600 bg-secrets-surface',
  running: 'border-trap-cyan bg-secrets-surface',
  success: 'border-success-green bg-secrets-surface',
  error: 'border-danger-red bg-secrets-surface',
  warning: 'border-node-warning bg-secrets-surface',
  locked: 'border-gray-700 bg-secrets-surface/50'
};

const statusGlow = {
  idle: '',
  running: 'shadow-[0_0_20px_rgba(0,240,255,0.3)]',
  success: 'shadow-[0_0_20px_rgba(0,255,136,0.3)]',
  error: 'shadow-[0_0_20px_rgba(255,59,92,0.3)]',
  warning: 'shadow-[0_0_20px_rgba(255,184,0,0.3)]',
  locked: ''
};

const statusIcons = {
  idle: null,
  running: Play,
  success: Check,
  error: X,
  warning: AlertTriangle,
  locked: Lock
};

export function BaseNode({
  node,
  selected = false,
  onSelect,
  onMove,
  onConfigChange,
  onExecute,
  className
}: BaseNodeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const StatusIcon = node.state.status ? statusIcons[node.state.status] : null;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('.node-handle')) {
      return; // Don't drag if clicking on handles
    }
    if (node.locked) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y
    });
    onSelect?.(node.id);
    e.preventDefault();
  }, [node, onSelect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStart || node.locked) return;
    
    const newPosition: NodePosition = {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    };
    onMove?.(node.id, newPosition);
  }, [isDragging, dragStart, node, onMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleExecute = useCallback(() => {
    if (node.locked || node.state.status === 'running') return;
    onExecute?.(node.id);
  }, [node, onExecute]);

  return (
    <div
      className={cn(
        'absolute rounded-lg border-2 transition-all',
        'min-w-[200px] min-h-[120px]',
        'bg-secrets-surface',
        statusColors[node.state.status || 'idle'],
        statusGlow[node.state.status || 'idle'],
        selected && 'ring-2 ring-trap-cyan ring-offset-2 ring-offset-secrets-bg',
        node.trapdoor && 'border-secret-purple/50',
        node.locked && 'opacity-60 cursor-not-allowed',
        isDragging && 'cursor-move',
        className
      )}
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: `${node.size.width}px`,
        height: `${node.size.height}px`
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Node Header */}
      <div className={cn(
        'flex items-center justify-between p-3 border-b border-secrets-border',
        node.trapdoor && 'bg-secret-purple/10'
      )}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {node.icon && (
            <div className="flex-shrink-0 text-trap-cyan">
              {typeof node.icon === 'string' ? (
                <span className="text-lg">{node.icon}</span>
              ) : (
                node.icon
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-ink-primary text-sm truncate">
              {node.name}
            </div>
            {node.category && (
              <div className="text-xs text-ink-muted truncate">
                {node.category.replace('-', ' ')}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {StatusIcon && (
            <StatusIcon 
              className={cn(
                'w-4 h-4',
                node.state.status === 'running' && 'text-trap-cyan animate-pulse',
                node.state.status === 'success' && 'text-success-green',
                node.state.status === 'error' && 'text-danger-red',
                node.state.status === 'warning' && 'text-node-warning'
              )} 
            />
          )}
          {node.locked && (
            <Lock className="w-3 h-3 text-ink-muted" />
          )}
        </div>
      </div>

      {/* Node Body */}
      <div className="p-3">
        {node.description && (
          <p className="text-xs text-ink-muted mb-2 line-clamp-2">
            {node.description}
          </p>
        )}
        
        {/* Progress */}
        {node.state.progress !== undefined && (
          <div className="mb-2">
            <div className="h-1 bg-secrets-border rounded-full overflow-hidden">
              <div
                className="h-full bg-trap-cyan transition-all"
                style={{ width: `${node.state.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {node.state.error && (
          <div className="text-xs text-danger-red mb-2 line-clamp-2">
            {node.state.error}
          </div>
        )}
      </div>

      {/* Node Footer - Input/Output Handles */}
      <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-secrets-border bg-secrets-surface/50 rounded-b-lg">
        <div className="flex items-center justify-between text-xs">
          <div className="flex gap-2">
            {node.inputs.length > 0 && (
              <span className="text-ink-muted">
                {node.inputs.length} input{node.inputs.length !== 1 ? 's' : ''}
              </span>
            )}
            {node.outputs.length > 0 && (
              <span className="text-ink-muted">
                {node.outputs.length} output{node.outputs.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {!node.locked && (
            <button
              onClick={handleExecute}
              className="px-2 py-1 bg-trap-cyan/20 text-trap-cyan rounded hover:bg-trap-cyan/30 transition-colors node-handle"
              disabled={node.state.status === 'running'}
            >
              Run
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
