/**
 * Device Scan Node
 * 
 * Node for scanning and detecting connected devices
 */

import React, { useCallback } from 'react';
import { BaseNode } from '../base/BaseNode';
import { Node, NodePosition } from '../core/NodeTypes';
import { ScanSearch } from 'lucide-react';
import { nodeStateManager } from '../core/NodeStateManager';

export interface DeviceScanNodeProps {
  node: Node;
  selected?: boolean;
  onSelect?: (nodeId: string) => void;
  onMove?: (nodeId: string, position: NodePosition) => void;
  onConfigChange?: (nodeId: string, config: any) => void;
  onExecute?: (nodeId: string) => void;
  onNodeUpdate?: (node: Node) => void;
}

export function DeviceScanNode(props: DeviceScanNodeProps) {
  const handleExecute = useCallback(async () => {
    if (props.node.state.status === 'running') return;
    
    props.onExecute?.(props.node.id);

    let runningNode = nodeStateManager.setRunning(props.node, props.onNodeUpdate);

    try {
      const { NodeAPI } = await import('../core/NodeAPI');
      const response = await NodeAPI.scanDevices();
      
      if (response.ok && response.data) {
        nodeStateManager.setSuccess(runningNode, response.data, props.onNodeUpdate);
      } else {
        throw new Error(response.error || 'Failed to scan devices');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      nodeStateManager.setError(runningNode, errorMessage, props.onNodeUpdate);
    }
  }, [props]);

  const nodeWithIcon: Node = {
    ...props.node,
    icon: <ScanSearch className="w-5 h-5" />
  };

  return <BaseNode {...props} node={nodeWithIcon} onExecute={handleExecute} />;
}

export const deviceScanNodeMetadata = {
  type: 'device-scan' as const,
  category: 'device-management' as const,
  name: 'Device Scan',
  description: 'Scan for connected Android/iOS devices',
  icon: '📱',
  version: '1.0.0',
  inputs: [],
  outputs: [
    {
      id: 'devices',
      name: 'Devices',
      type: 'data',
      description: 'List of detected devices'
    }
  ],
  defaultConfig: {}
};
