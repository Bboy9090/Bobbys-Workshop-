/**
 * Backend Health - Monitor backend API health status
 */

import { useState, useEffect } from 'react';
import { safeJsonFetch } from './apiConfig';

export interface BackendHealthStatus {
  isHealthy: boolean;
  lastCheck: number;
  error?: string;
}

export async function checkBackendHealth(): Promise<BackendHealthStatus> {
  try {
    const { data, ok } = await safeJsonFetch<{ ok?: boolean; error?: { message?: string } }>(
      '/api/v1/ready',
      { signal: AbortSignal.timeout(5000) }
    );
    const envelope = data?.ok !== undefined ? data : { ok: true, data };

    return {
      isHealthy: ok && envelope.ok === true,
      lastCheck: Date.now(),
      error: envelope.ok === false ? envelope.error?.message : undefined,
    };
  } catch (error) {
    return {
      isHealthy: false,
      lastCheck: Date.now(),
      error: error instanceof Error ? error.message : 'Backend unavailable',
    };
  }
}

export function useBackendHealth(checkInterval: number = 30000): BackendHealthStatus {
  const [health, setHealth] = useState<BackendHealthStatus>({
    isHealthy: false,
    lastCheck: 0,
  });

  useEffect(() => {
    let isMounted = true;
    let consecutiveFailures = 0;
    const MAX_SILENT_FAILURES = 3; // Only log errors after 3 consecutive failures

    const checkHealth = async () => {
      try {
        const { data, ok } = await safeJsonFetch<{ ok?: boolean; error?: { message?: string } }>('/api/v1/ready');
        if (!isMounted) return;
        const envelope = data?.ok !== undefined ? data : { ok: true, data };
        if (envelope.ok === true) {
          consecutiveFailures = 0;
        } else {
          consecutiveFailures++;
        }
        if (!isMounted) return;
        setHealth({
          isHealthy: ok && envelope.ok === true,
          lastCheck: Date.now(),
          error: envelope.ok === false && consecutiveFailures > MAX_SILENT_FAILURES
            ? (envelope as any).error?.message
            : undefined,
        });
      } catch (error) {
        if (!isMounted) return;
        
        consecutiveFailures++;
        setHealth({
          isHealthy: false,
          lastCheck: Date.now(),
          // Only show error after multiple failures to reduce noise
          error: consecutiveFailures > MAX_SILENT_FAILURES 
            ? (error instanceof Error ? error.message : 'Backend unavailable')
            : undefined,
        });
      }
    };

    // Check immediately
    checkHealth();

    // Set up interval - longer interval to reduce noise
    const interval = setInterval(checkHealth, Math.max(checkInterval, 30000));

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [checkInterval]);

  return health;
}
