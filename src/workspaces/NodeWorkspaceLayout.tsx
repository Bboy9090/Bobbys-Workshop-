/**
 * Node Workspace Layout
 * 
 * Main layout for the node-based workspace system.
 * Combines canvas, node palette, and inspector panels.
 */

import React, { useState, useCallback } from 'react';
import { WorkspaceCanvas } from './WorkspaceCanvas';
import { NodePalette } from './NodePalette';
import { NodeInspector } from './NodeInspector';
import { Node, NodeConnection } from '@/nodes/core/NodeTypes';
import { cn } from '@/lib/utils';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

export interface NodeWorkspaceLayoutProps {
  workspaceId?: string;
  nodes: Node[];
  connections: NodeConnection[];
  onNodesChange?: (nodes: Node[]) => void;
  onConnectionsChange?: (connections: NodeConnection[]) => void;
  className?: string;
}

export function NodeWorkspaceLayout({
  workspaceId,
  nodes,
  connections,
  onNodesChange,
  onConnectionsChange,
  className
}: NodeWorkspaceLayoutProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [showInspector, setShowInspector] = useState(true);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  const handleNodeMove = useCallback((nodeId: string, position: { x: number; y: number }) => {
    if (!onNodesChange) return;
    onNodesChange(nodes.map(node => 
      node.id === nodeId 
        ? { ...node, position, updatedAt: Date.now() }
        : node
    ));
  }, [nodes, onNodesChange]);

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleNodeExecute = useCallback((nodeId: string) => {
    // Node execution is handled by the node component itself
    // This callback is for workspace-level execution tracking if needed
    console.log('Execute node:', nodeId);
  }, []);

  const handleNodeUpdate = useCallback((updatedNode: Node) => {
    if (!onNodesChange) return;
    onNodesChange(nodes.map(node => 
      node.id === updatedNode.id ? updatedNode : node
    ));
  }, [nodes, onNodesChange]);

  const handleAddNode = useCallback((nodeType: string) => {
    if (!onNodesChange) return;
    
    try {
      const { nodeRegistry } = await import('@/nodes/core/NodeRegistry');
      const newNode = nodeRegistry.createNode(
        nodeType as any,
        `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        {}
      );
      
      // Position new node in center of viewport
      const viewportCenter = {
        x: Math.max(0, (window.innerWidth - 300) / 2),
        y: Math.max(0, (window.innerHeight - 200) / 2)
      };
      
      onNodesChange([...nodes, {
        ...newNode,
        position: viewportCenter
      }]);
    } catch (error) {
      console.error('Failed to create node:', error);
    }
  }, [nodes, onNodesChange]);

  return (
    <div className={cn('flex h-screen bg-secrets-bg', className)}>
      {/* Node Palette */}
      {showPalette && (
        <div className="w-64 border-r border-secrets-border bg-secrets-surface flex-shrink-0">
          <NodePalette onAddNode={handleAddNode} />
        </div>
      )}

      {/* Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <WorkspaceCanvas
          nodes={nodes}
          connections={connections}
          onNodeMove={handleNodeMove}
          onNodeSelect={handleNodeSelect}
          onNodeExecute={handleNodeExecute}
          onNodeUpdate={handleNodeUpdate}
          selectedNodeId={selectedNodeId}
          className="flex-1"
        />
      </div>

      {/* Node Inspector */}
      {showInspector && selectedNode && (
        <div className="w-80 border-l border-secrets-border bg-secrets-surface flex-shrink-0">
          <NodeInspector node={selectedNode} />
        </div>
      )}

      {/* Toggle Buttons */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <button
          onClick={() => setShowPalette(!showPalette)}
          className="p-2 bg-secrets-surface border border-secrets-border rounded-lg hover:bg-secrets-border transition-colors shadow-lg"
          title={showPalette ? "Hide Palette" : "Show Palette"}
        >
          {showPalette ? (
            <PanelLeftClose className="w-4 h-4 text-ink-primary" />
          ) : (
            <PanelLeftOpen className="w-4 h-4 text-ink-primary" />
          )}
        </button>
        <button
          onClick={() => setShowInspector(!showInspector)}
          className="p-2 bg-secrets-surface border border-secrets-border rounded-lg hover:bg-secrets-border transition-colors shadow-lg"
          title={showInspector ? "Hide Inspector" : "Show Inspector"}
        >
          {showInspector ? (
            <PanelRightClose className="w-4 h-4 text-ink-primary" />
          ) : (
            <PanelRightOpen className="w-4 h-4 text-ink-primary" />
          )}
        </button>
      </div>
    </div>
  );
}
