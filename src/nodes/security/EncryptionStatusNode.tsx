/**
 * Encryption Status Node
 * 
 * Node for checking device encryption status (FDE/FBE)
 */

import React, { useCallback } from 'react';
import { BaseNode } from '../base/BaseNode';
import { Node, NodePosition } from '../core/NodeTypes';
import { Smartphone } from 'lucide-react';
import { nodeStateManager } from '../core/NodeStateManager';

export interface EncryptionStatusNodeProps {
  node: Node;
  selected?: boolean;
  onSelect?: (nodeId: string) => void;
  onMove?: (nodeId: string, position: NodePosition) => void;
  onConfigChange?: (nodeId: string, config: any) => void;
  onExecute?: (nodeId: string) => void;
  onNodeUpdate?: (node: Node) => void;
}

export function EncryptionStatusNode(props: EncryptionStatusNodeProps) {
  const handleExecute = useCallback(async () => {
    if (props.node.state.status === 'running') return;
    
    props.onExecute?.(props.node.id);
    
    // Update node state to running
    let runningNode = nodeStateManager.setRunning(props.node, props.onNodeUpdate);

    try {
      const deviceSerial = props.node.config.deviceSerial;
      if (!deviceSerial) {
        throw new Error('Device serial is required. Configure the node first.');
      }

      // Call backend API
      const { NodeAPI } = await import('../core/NodeAPI');
      const response = await NodeAPI.getEncryptionStatus(deviceSerial);
      
      if (response.ok && response.data) {
        // Update node with success
        nodeStateManager.setSuccess(runningNode, response.data, props.onNodeUpdate);
      } else {
        throw new Error(response.error || 'Failed to get encryption status');
      }
    } catch (error) {
      // Update node with error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      nodeStateManager.setError(runningNode, errorMessage, props.onNodeUpdate);
    }
  }, [props]);

  const nodeWithIcon: Node = {
    ...props.node,
    icon: <Smartphone className="w-5 h-5" />
  };

  return <BaseNode {...props} node={nodeWithIcon} onExecute={handleExecute} />;
}

// Node metadata for registration
export const encryptionStatusNodeMetadata = {
  type: 'encryption-status' as const,
  category: 'security' as const,
  name: 'Encryption Status',
  description: 'Check device encryption status (FDE/FBE)',
  icon: '🔒',
  version: '1.0.0',
  inputs: [
    {
      id: 'device-serial',
      name: 'Device Serial',
      type: 'device',
      required: true,
      description: 'Serial number of the device to check'
    }
  ],
  outputs: [
    {
      id: 'encryption-status',
      name: 'Encryption Status',
      type: 'data',
      description: 'Encryption status information'
    }
  ],
  defaultConfig: {
    deviceSerial: ''
  }
};
