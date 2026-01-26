/**
 * Node State Manager
 * 
 * Manages state updates for nodes in the workspace
 */

import { Node, NodeState } from './NodeTypes';

export type NodeStateUpdate = Partial<NodeState> & {
  nodeId: string;
};

export class NodeStateManager {
  private static instance: NodeStateManager;
  private listeners: Map<string, Set<(node: Node) => void>> = new Map();

  private constructor() {}

  static getInstance(): NodeStateManager {
    if (!NodeStateManager.instance) {
      NodeStateManager.instance = new NodeStateManager();
    }
    return NodeStateManager.instance;
  }

  /**
   * Subscribe to node state changes
   */
  subscribe(nodeId: string, callback: (node: Node) => void): () => void {
    if (!this.listeners.has(nodeId)) {
      this.listeners.set(nodeId, new Set());
    }
    this.listeners.get(nodeId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(nodeId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(nodeId);
        }
      }
    };
  }

  /**
   * Update node state
   */
  updateNode(node: Node, update: Partial<NodeState>, onUpdate?: (node: Node) => void): Node {
    const updatedNode: Node = {
      ...node,
      state: {
        ...node.state,
        ...update,
        lastUpdated: Date.now()
      },
      updatedAt: Date.now()
    };

    // Notify listeners
    const callbacks = this.listeners.get(node.id);
    if (callbacks) {
      callbacks.forEach(callback => callback(updatedNode));
    }

    // Call optional callback
    if (onUpdate) {
      onUpdate(updatedNode);
    }

    return updatedNode;
  }

  /**
   * Update node state to running
   */
  setRunning(node: Node, onUpdate?: (node: Node) => void): Node {
    return this.updateNode(node, {
      status: 'running',
      progress: 0,
      error: undefined
    }, onUpdate);
  }

  /**
   * Update node state to success
   */
  setSuccess(node: Node, data?: any, onUpdate?: (node: Node) => void): Node {
    return this.updateNode(node, {
      status: 'success',
      progress: 100,
      data,
      error: undefined
    }, onUpdate);
  }

  /**
   * Update node state to error
   */
  setError(node: Node, error: string, onUpdate?: (node: Node) => void): Node {
    return this.updateNode(node, {
      status: 'error',
      error
    }, onUpdate);
  }

  /**
   * Update node state to idle
   */
  setIdle(node: Node, onUpdate?: (node: Node) => void): Node {
    return this.updateNode(node, {
      status: 'idle',
      progress: undefined,
      error: undefined,
      data: undefined
    }, onUpdate);
  }

  /**
   * Update node progress
   */
  setProgress(node: Node, progress: number, onUpdate?: (node: Node) => void): Node {
    return this.updateNode(node, {
      progress: Math.max(0, Math.min(100, progress))
    }, onUpdate);
  }
}

export const nodeStateManager = NodeStateManager.getInstance();
export default nodeStateManager;
