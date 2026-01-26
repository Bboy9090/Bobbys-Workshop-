/**
 * Node Renderer
 * 
 * Renders the appropriate node component based on node type
 */

import React from 'react';
import { Node, NodePosition } from '@/nodes/core/NodeTypes';
import { nodeRegistry } from '@/nodes/core/NodeRegistry';
import { BaseNode } from '@/nodes/base/BaseNode';

export interface NodeRendererProps {
  node: Node;
  selected?: boolean;
  onSelect?: (nodeId: string) => void;
  onMove?: (nodeId: string, position: NodePosition) => void;
  onConfigChange?: (nodeId: string, config: any) => void;
  onExecute?: (nodeId: string) => void;
  onNodeUpdate?: (node: Node) => void;
}

export function NodeRenderer({
  node,
  selected,
  onSelect,
  onMove,
  onConfigChange,
  onExecute,
  onNodeUpdate
}: NodeRendererProps) {
  try {
    // Get node component from registry
    const NodeComponent = nodeRegistry.getNodeComponent(node.type);
    
    // Render the specific node component
    return (
      <NodeComponent
        node={node}
        selected={selected}
        onSelect={onSelect}
        onMove={onMove}
        onConfigChange={onConfigChange}
        onExecute={onExecute}
        onNodeUpdate={onNodeUpdate}
      />
    );
  } catch (error) {
    // Fallback to BaseNode if component not found
    console.warn(`Node component for type ${node.type} not found, using BaseNode`, error);
    return (
      <BaseNode
        node={node}
        selected={selected}
        onSelect={onSelect}
        onMove={onMove}
        onConfigChange={onConfigChange}
        onExecute={onExecute}
      />
    );
  }
}
