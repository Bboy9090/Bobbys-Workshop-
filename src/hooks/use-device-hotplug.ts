import { useEffect, useState, useCallback, useRef } from 'react';
import { getWSUrl } from '@/lib/apiConfig';
import { connectDeviceEvents, type RealtimeConnection } from '@/lib/realtime';
import { toast } from 'sonner';
import { useApp } from '@/lib/app-context';
import type { CorrelationBadge } from '@/types/correlation';

export type DeviceEventType = 'connected' | 'disconnected';

export interface DeviceHotplugEvent {
  type: DeviceEventType;
  device_uid: string;
  platform_hint: string;
  mode: string;
  confidence: number;
  timestamp: string;
  display_name: string;
  matched_tool_ids?: string[];
  correlation_badge?: CorrelationBadge;
  correlation_notes?: string[];
}

export interface HotplugStats {
  totalConnections: number;
  totalDisconnections: number;
  currentDevices: number;
  lastEventTime: string | null;
}

interface UseDeviceHotplugOptions {
  wsUrl?: string;
  autoConnect?: boolean;
  showToasts?: boolean;
  onConnect?: (event: DeviceHotplugEvent) => void;
  onDisconnect?: (event: DeviceHotplugEvent) => void;
  onError?: (error: Error) => void;
}

export function useDeviceHotplug(options: UseDeviceHotplugOptions = {}) {
  const {
    wsUrl = getWSUrl('/ws/device-events'),
    autoConnect = true,
    showToasts = true,
    onConnect,
    onDisconnect,
    onError,
  } = options;
  
  const { backendAvailable } = useApp();
  const isBackendReady = backendAvailable;
  // Disable toasts when backend is unavailable
  const shouldShowToasts = showToasts && isBackendReady;

  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<DeviceHotplugEvent[]>([]);
  const [stats, setStats] = useState<HotplugStats>({
    totalConnections: 0,
    totalDisconnections: 0,
    currentDevices: 0,
    lastEventTime: null,
  });

  const wsRef = useRef<RealtimeConnection | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const handleEvent = useCallback((event: DeviceHotplugEvent) => {
    setEvents(prev => [event, ...prev].slice(0, 100));
    
    setStats(prev => {
      const newStats = { ...prev };
      
      if (event.type === 'connected') {
        newStats.totalConnections += 1;
        newStats.currentDevices += 1;
        onConnect?.(event);
        
        if (shouldShowToasts) {
          toast.success('Device Connected', {
            description: event.display_name || event.device_uid,
          });
        }
      } else if (event.type === 'disconnected') {
        newStats.totalDisconnections += 1;
        newStats.currentDevices = Math.max(0, newStats.currentDevices - 1);
        onDisconnect?.(event);
        
        if (shouldShowToasts) {
          toast.info('Device Disconnected', {
            description: event.display_name || event.device_uid,
          });
        }
      }
      
      newStats.lastEventTime = event.timestamp;
      return newStats;
    });
  }, [onConnect, onDisconnect, shouldShowToasts]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === 1 || wsRef.current?.readyState === 0) {
      return;
    }

    if (!isBackendReady) {
      disconnect();
      return;
    }

    try {
      const ws = connectDeviceEvents(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        clearReconnectTimeout();
        
        if (shouldShowToasts) {
          toast.success('WebSocket Connected', {
            description: 'Live device monitoring active',
          });
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'ping') {
            ws.send?.(JSON.stringify({ type: 'pong' }));
            return;
          }
          
          if (data.type === 'device_event' && data.event) {
            handleEvent(data.event);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        const err = new Error('WebSocket error');
        console.error('WebSocket error:', error);
        onError?.(err);
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Only attempt reconnection if backend is still ready
        if (!isBackendReady) {
          clearReconnectTimeout();
          return;
        }

        const maxAttempts = 5;
        if (reconnectAttemptsRef.current < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current += 1;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            // Check again before reconnecting (backend might have gone offline)
            if (isBackendReady) {
              connect();
            } else {
              clearReconnectTimeout();
            }
          }, delay);
        } else {
          // Only show error toast once when max attempts reached
          if (shouldShowToasts && reconnectAttemptsRef.current === maxAttempts) {
            toast.error('WebSocket Disconnected', {
              description: 'Failed to reconnect after multiple attempts',
            });
          }
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      onError?.(err as Error);
    }
  }, [wsUrl, shouldShowToasts, handleEvent, onError, clearReconnectTimeout, disconnect, isBackendReady]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
  }, [clearReconnectTimeout]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const resetStats = useCallback(() => {
    setStats({
      totalConnections: 0,
      totalDisconnections: 0,
      currentDevices: 0,
      lastEventTime: null,
    });
  }, []);

  useEffect(() => {
    if (autoConnect && isBackendReady) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, isBackendReady, connect, disconnect]);

  return {
    isConnected,
    events,
    stats,
    connect,
    disconnect,
    clearEvents,
    resetStats,
  };
}
