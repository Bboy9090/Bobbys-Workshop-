/**
 * Workspace Canvas
 * 
 * Main canvas for arranging and connecting nodes.
 * Provides zoom, pan, selection, and connection capabilities.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Node, NodeConnection, NodePosition } from '@/nodes/core/NodeTypes';
import { NodeRenderer } from './NodeRenderer';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut, Maximize2, Grid } from 'lucide-react';

export interface WorkspaceCanvasProps {
  nodes: Node[];
  connections: NodeConnection[];
  onNodeMove?: (nodeId: string, position: NodePosition) => void;
  onNodeSelect?: (nodeId: string | null) => void;
  onNodeExecute?: (nodeId: string) => void;
  onNodeUpdate?: (node: Node) => void;
  onConnectionCreate?: (connection: NodeConnection) => void;
  selectedNodeId?: string | null;
  className?: string;
}

export function WorkspaceCanvas({
  nodes,
  connections,
  onNodeMove,
  onNodeSelect,
  onNodeExecute,
  onConnectionCreate,
  selectedNodeId,
  className
}: WorkspaceCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.25, Math.min(2, viewport.zoom * delta));
      setViewport(prev => ({ ...prev, zoom: newZoom }));
    }
  }, [viewport.zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-background')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      onNodeSelect?.(null);
    }
  }, [viewport, onNodeSelect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning && panStart) {
      setViewport(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }));
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);

  useEffect(() => {
    if (isPanning) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isPanning, handleMouseMove, handleMouseUp]);

  const handleZoomIn = useCallback(() => {
    setViewport(prev => ({ ...prev, zoom: Math.min(2, prev.zoom * 1.2) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewport(prev => ({ ...prev, zoom: Math.max(0.25, prev.zoom * 0.8) }));
  }, []);

  const handleResetView = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, []);

  const handleNodeMove = useCallback((nodeId: string, position: NodePosition) => {
    onNodeMove?.(nodeId, position);
  }, [onNodeMove]);

  const handleNodeSelect = useCallback((nodeId: string) => {
    onNodeSelect?.(nodeId);
  }, [onNodeSelect]);

  const handleNodeExecute = useCallback((nodeId: string) => {
    onNodeExecute?.(nodeId);
  }, [onNodeExecute]);

  return (
    <div
      ref={canvasRef}
      className={cn(
        'relative w-full h-full overflow-hidden bg-secrets-bg',
        isPanning && 'cursor-grabbing',
        !isPanning && 'cursor-grab',
        className
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
    >
      {/* Grid Background */}
      {showGrid && (
        <div
          className="absolute inset-0 canvas-background"
          style={{
            backgroundImage: `
              linear-gradient(rgba(42, 42, 58, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(42, 42, 58, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`
          }}
        />
      )}

      {/* Canvas Content */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {/* Connections */}
        <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
          {connections.map(connection => (
            <line
              key={connection.id}
              x1={0}
              y1={0}
              x2={100}
              y2={100}
              stroke="var(--trap-cyan)"
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.5"
            />
          ))}
        </svg>

        {/* Nodes */}
        <div className="relative" style={{ zIndex: 2 }}>
          {nodes.map(node => (
            <NodeRenderer
              key={node.id}
              node={node}
              selected={selectedNodeId === node.id}
              onSelect={handleNodeSelect}
              onMove={handleNodeMove}
              onExecute={handleNodeExecute}
              onNodeUpdate={onNodeUpdate}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
        <div className="bg-secrets-surface border border-secrets-border rounded-lg p-2 flex flex-col gap-2 shadow-lg">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-secrets-border rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4 text-ink-primary" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-secrets-border rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4 text-ink-primary" />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 hover:bg-secrets-border rounded transition-colors"
            title="Reset View"
          >
            <Maximize2 className="w-4 h-4 text-ink-primary" />
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={cn(
              "p-2 rounded transition-colors",
              showGrid ? "bg-trap-cyan/20 text-trap-cyan" : "hover:bg-secrets-border text-ink-primary"
            )}
            title="Toggle Grid"
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Zoom Indicator */}
      <div className="absolute bottom-4 left-4 bg-secrets-surface border border-secrets-border rounded-lg px-3 py-2 text-sm text-ink-secondary font-mono z-10 shadow-lg">
        {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
}
