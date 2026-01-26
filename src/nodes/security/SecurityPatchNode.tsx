/**
 * Security Patch Node
 * 
 * Node for checking Android security patch level
 */

import React, { useCallback } from 'react';
import { BaseNode } from '../base/BaseNode';
import { Node, NodePosition } from '../core/NodeTypes';
import { Shield } from 'lucide-react';
import { nodeStateManager } from '../core/NodeStateManager';

export interface SecurityPatchNodeProps {
  node: Node;
  selected?: boolean;
  onSelect?: (nodeId: string) => void;
  onMove?: (nodeId: string, position: NodePosition) => void;
  onConfigChange?: (nodeId: string, config: any) => void;
  onExecute?: (nodeId: string) => void;
  onNodeUpdate?: (node: Node) => void;
}

export function SecurityPatchNode(props: SecurityPatchNodeProps) {
  const handleExecute = useCallback(async () => {
    if (props.node.state.status === 'running') return;
    
    props.onExecute?.(props.node.id);

    let runningNode = nodeStateManager.setRunning(props.node, props.onNodeUpdate);

    try {
      const deviceSerial = props.node.config.deviceSerial;
      if (!deviceSerial) {
        throw new Error('Device serial is required. Configure the node first.');
      }

      const { NodeAPI } = await import('../core/NodeAPI');
      const response = await NodeAPI.getSecurityPatch(deviceSerial);
      
      if (response.ok && response.data) {
        nodeStateManager.setSuccess(runningNode, response.data, props.onNodeUpdate);
      } else {
        throw new Error(response.error || 'Failed to get security patch');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      nodeStateManager.setError(runningNode, errorMessage, props.onNodeUpdate);
    }
  }, [props]);

  const nodeWithIcon: Node = {
    ...props.node,
    icon: <Shield className="w-5 h-5" />
  };

  return <BaseNode {...props} node={nodeWithIcon} onExecute={handleExecute} />;
}

export const securityPatchNodeMetadata = {
  type: 'security-patch' as const,
  category: 'security' as const,
  name: 'Security Patch',
  description: 'Check Android security patch level and status',
  icon: '🛡️',
  version: '1.0.0',
  inputs: [
    {
      id: 'device-serial',
      name: 'Device Serial',
      type: 'device',
      required: true
    }
  ],
  outputs: [
    {
      id: 'patch-info',
      name: 'Patch Information',
      type: 'data'
    }
  ],
  defaultConfig: {
    deviceSerial: ''
  }
};
