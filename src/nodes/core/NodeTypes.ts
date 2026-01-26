/**
 * Node System Type Definitions
 * 
 * Core type definitions for the modular node system.
 * Every feature in Bobby's Workshop is implemented as a Node.
 */

export type NodeCategory = 
  | 'device-management'
  | 'flashing'
  | 'security'
  | 'monitoring'
  | 'firmware'
  | 'workflows'
  | 'trapdoor'
  | 'utility';

export type NodeType = 
  // Device Management
  | 'device-detection'
  | 'device-scan'
  | 'device-monitor'
  | 'device-info'
  
  // Flashing
  | 'fastboot-flash'
  | 'samsung-odin'
  | 'mediatek-spflash'
  | 'qualcomm-edl'
  | 'ios-dfu'
  
  // Security
  | 'root-detection'
  | 'encryption-status'
  | 'security-patch'
  | 'bootloader-status'
  | 'frp-detection'
  | 'mdm-detection'
  
  // Monitoring
  | 'performance-monitor'
  | 'network-monitor'
  | 'storage-analytics'
  | 'thermal-monitor'
  | 'battery-health'
  
  // Firmware
  | 'firmware-library'
  | 'firmware-check'
  | 'firmware-download'
  | 'firmware-compare'
  
  // Workflows
  | 'workflow-builder'
  | 'workflow-executor'
  | 'workflow-template'
  
  // Trapdoor
  | 'trapdoor-access'
  | 'secret-room'
  | 'shadow-log-viewer'
  | 'advanced-tools';

export type NodeStatus = 
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'warning'
  | 'locked';

export type NodeInputType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'device'
  | 'file'
  | 'data';

export type NodeOutputType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'device'
  | 'data'
  | 'event';

export interface NodeInput {
  id: string;
  name: string;
  type: NodeInputType;
  required?: boolean;
  defaultValue?: any;
  description?: string;
}

export interface NodeOutput {
  id: string;
  name: string;
  type: NodeOutputType;
  description?: string;
}

export interface NodeConfig {
  [key: string]: any;
}

export interface NodeState {
  status: NodeStatus;
  data?: any;
  error?: string;
  progress?: number;
  lastUpdated?: number;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeSize {
  width: number;
  height: number;
}

export interface NodeConnection {
  id: string;
  fromNodeId: string;
  fromOutputId: string;
  toNodeId: string;
  toInputId: string;
}

export interface Node {
  id: string;
  type: NodeType;
  category: NodeCategory;
  name: string;
  description?: string;
  icon?: string;
  position: NodePosition;
  size: NodeSize;
  config: NodeConfig;
  state: NodeState;
  inputs: NodeInput[];
  outputs: NodeOutput[];
  locked?: boolean;
  trapdoor?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NodeMetadata {
  type: NodeType;
  category: NodeCategory;
  name: string;
  description: string;
  icon: string;
  version: string;
  author?: string;
  inputs: NodeInput[];
  outputs: NodeOutput[];
  defaultConfig: NodeConfig;
  trapdoor?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  connections: NodeConnection[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  createdAt: number;
  updatedAt: number;
}
