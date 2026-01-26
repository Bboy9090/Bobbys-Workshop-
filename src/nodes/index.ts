/**
 * Node System Entry Point
 * 
 * Registers all nodes in the system
 */

import { nodeRegistry } from './core/NodeRegistry';
import { EncryptionStatusNode, encryptionStatusNodeMetadata } from './security/EncryptionStatusNode';
import { SecurityPatchNode, securityPatchNodeMetadata } from './security/SecurityPatchNode';
import { DeviceScanNode, deviceScanNodeMetadata } from './device-detection/DeviceScanNode';

// Register security nodes
nodeRegistry.register(
  encryptionStatusNodeMetadata,
  (id: string, config?: any) => ({
    id,
    type: 'encryption-status',
    category: 'security',
    name: encryptionStatusNodeMetadata.name,
    description: encryptionStatusNodeMetadata.description,
    icon: encryptionStatusNodeMetadata.icon,
    position: { x: 0, y: 0 },
    size: { width: 220, height: 160 },
    config: { ...encryptionStatusNodeMetadata.defaultConfig, ...config },
    state: { status: 'idle' },
    inputs: encryptionStatusNodeMetadata.inputs,
    outputs: encryptionStatusNodeMetadata.outputs,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }),
  EncryptionStatusNode
);

nodeRegistry.register(
  securityPatchNodeMetadata,
  (id: string, config?: any) => ({
    id,
    type: 'security-patch',
    category: 'security',
    name: securityPatchNodeMetadata.name,
    description: securityPatchNodeMetadata.description,
    icon: securityPatchNodeMetadata.icon,
    position: { x: 0, y: 0 },
    size: { width: 220, height: 160 },
    config: { ...securityPatchNodeMetadata.defaultConfig, ...config },
    state: { status: 'idle' },
    inputs: securityPatchNodeMetadata.inputs,
    outputs: securityPatchNodeMetadata.outputs,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }),
  SecurityPatchNode
);

// Register device management nodes
nodeRegistry.register(
  deviceScanNodeMetadata,
  (id: string, config?: any) => ({
    id,
    type: 'device-scan',
    category: 'device-management',
    name: deviceScanNodeMetadata.name,
    description: deviceScanNodeMetadata.description,
    icon: deviceScanNodeMetadata.icon,
    position: { x: 0, y: 0 },
    size: { width: 220, height: 160 },
    config: { ...deviceScanNodeMetadata.defaultConfig, ...config },
    state: { status: 'idle' },
    inputs: deviceScanNodeMetadata.inputs,
    outputs: deviceScanNodeMetadata.outputs,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }),
  DeviceScanNode
);

// Export registry
export { nodeRegistry };
export * from './core/NodeTypes';
export * from './core/NodeRegistry';
export * from './base/BaseNode';
