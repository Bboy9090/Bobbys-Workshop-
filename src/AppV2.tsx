/**
 * Bobby's Workshop V2 - Node-Based Application
 * 
 * New modular node-based interface replacing the old design.
 * Features the "World of Secrets and Traps" aesthetic.
 */

import React, { useState, useEffect } from 'react';
import { NodeWorkspaceLayout } from './workspaces/NodeWorkspaceLayout';
import { Node, NodeConnection } from './nodes/core/NodeTypes';
import { nodeRegistry } from './nodes';
import { Toaster } from "@/components/ui/sonner";
import { AppProvider, useApp } from "./lib/app-context";
import { GlobalDeviceProvider } from "./lib/global-device-state";
import { checkBackendHealth } from "./lib/backend-health";
import { initializeWebSockets, cleanupWebSockets } from "./lib/websocket-hub";
import './styles/secrets-trap-theme.css';

// Initialize nodes
import './nodes';

function AppV2Content() {
  const { setBackendAvailable } = useApp();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<NodeConnection[]>([]);
  const [backendConnected, setBackendConnected] = useState(false);

  useEffect(() => {
    async function initializeApp() {
      try {
        const backendHealthy = await checkBackendHealth();
        setBackendAvailable(backendHealthy.isHealthy);
        setBackendConnected(backendHealthy.isHealthy);

        if (backendHealthy.isHealthy) {
          initializeWebSockets();
        }

        // Initialize empty workspace
        setNodes([]);
        setConnections([]);
      } catch (error) {
        console.error('Initialization error:', error);
      }
    }

    initializeApp();

    return () => {
      cleanupWebSockets();
    };
  }, [setBackendAvailable]);

  const handleAddNode = (nodeType: string) => {
    try {
      const newNode = nodeRegistry.createNode(
        nodeType as any,
        `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        {}
      );
      
      // Position new node in center of viewport
      const viewportCenter = {
        x: window.innerWidth / 2 - 110,
        y: window.innerHeight / 2 - 80
      };
      
      setNodes(prev => [...prev, {
        ...newNode,
        position: viewportCenter
      }]);
    } catch (error) {
      console.error('Failed to create node:', error);
    }
  };

  const handleNodesChange = (newNodes: Node[]) => {
    setNodes(newNodes);
  };

  const handleConnectionsChange = (newConnections: NodeConnection[]) => {
    setConnections(newConnections);
  };

  return (
    <>
      {!backendConnected && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-warning-amber/90 border-b border-warning-amber px-4 py-2 flex items-center justify-between">
          <span className="text-ink-primary text-sm font-medium">
            ⚠️ Backend server not connected. Some features may be unavailable.
          </span>
        </div>
      )}
      <NodeWorkspaceLayout
        nodes={nodes}
        connections={connections}
        onNodesChange={handleNodesChange}
        onConnectionsChange={handleConnectionsChange}
      />
      <Toaster />
    </>
  );
}

export function AppV2() {
  return (
    <AppProvider>
      <GlobalDeviceProvider>
        <AppV2Content />
      </GlobalDeviceProvider>
    </AppProvider>
  );
}

export default AppV2;
