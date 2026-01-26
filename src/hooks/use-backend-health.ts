/**
 * Backend Health Hook
 * Monitors Python backend health and readiness
 */

import { useState, useEffect } from 'react';

export interface BackendHealth {
  status: 'booting' | 'ready' | 'failed';
  pythonBackend?: {
    port: number;
    version: string;
    uptime_ms: number;
  };
  nodeBackend?: {
    status: string;
  };
  error?: string;
}

export function useBackendHealth() {
  const [health, setHealth] = useState<BackendHealth>({
    status: 'booting'
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let mounted = true;

    const checkHealth = async () => {
      try {
        // Check if Tauri is available
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
          // Dynamic import for Tauri API (only when in Tauri runtime)
          const { invoke } = await import('@tauri-apps/api/core');
          const nodeStatus = await invoke<string>('get_backend_status');
          
          if (mounted) {
            setHealth({
              status: 'ready',
              nodeBackend: {
                status: nodeStatus
              }
            });
          }
        } else {
          // Web mode: Check backend via HTTP
          const response = await fetch('/api/health');
          if (response.ok) {
            const data = await response.json();
            if (mounted) {
              setHealth({
                status: 'ready',
                nodeBackend: {
                  status: data.status || 'ok'
                }
              });
            }
          } else {
            throw new Error('Backend not available');
          }
        }
      } catch (error) {
        if (mounted) {
          setHealth({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    };

    // Initial check
    checkHealth();

    // Poll every 2 seconds
    interval = setInterval(checkHealth, 2000);

    return () => {
      mounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  return health;
}
