import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useApp } from '@/lib/app-context';

export interface FlashProgressMessage {
  type: 'flash_started' | 'flash_progress' | 'flash_completed' | 'flash_failed' | 'flash_paused' | 'flash_resumed' | 'ping' | 'pong';
  jobId?: string;
  deviceId?: string;
  progress?: number;
  stage?: string;
  bytesTransferred?: number;
  totalBytes?: number;
  transferSpeed?: number;
  estimatedTimeRemaining?: number;
  error?: string;
  timestamp: number;
}

export interface FlashProgressData {
  jobId: string;
  deviceId: string;
  deviceName?: string;
  progress: number;
  stage: string;
  bytesTransferred: number;
  totalBytes: number;
  transferSpeed: number;
  estimatedTimeRemaining: number;
  startedAt: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  error?: string;
}

export interface FlashProgressWebSocketConfig {
  url: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  enableNotifications?: boolean;
  autoConnect?: boolean;
}

export function useFlashProgressWebSocket(config: FlashProgressWebSocketConfig) {
  const {
    url,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
    enableNotifications = true,
    autoConnect = true,
  } = config;
  
  const { backendAvailable } = useApp();
  const isBackendReady = backendAvailable;
  // Disable notifications when backend is unavailable
  const shouldNotify = enableNotifications && isBackendReady;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastMessageTime, setLastMessageTime] = useState<number>(0);
  const [activeJobs, setActiveJobs] = useState<Map<string, FlashProgressData>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((message: FlashProgressMessage) => {
    setLastMessageTime(Date.now());

    switch (message.type) {
      case 'flash_started':
        if (message.jobId && message.deviceId) {
          setActiveJobs(prev => {
            const next = new Map(prev);
            next.set(message.jobId!, {
              jobId: message.jobId!,
              deviceId: message.deviceId!,
              progress: 0,
              stage: message.stage || 'Initializing',
              bytesTransferred: 0,
              totalBytes: message.totalBytes || 0,
              transferSpeed: 0,
              estimatedTimeRemaining: 0,
              startedAt: message.timestamp,
              status: 'running',
            });
            return next;
          });

          if (shouldNotify) {
            toast.info(`Flash started: ${message.deviceId}`, {
              description: 'Device flashing operation initiated',
            });
          }
        }
        break;

      case 'flash_progress':
        if (message.jobId) {
          setActiveJobs(prev => {
            const next = new Map(prev);
            const existing = next.get(message.jobId!);
            if (existing) {
              next.set(message.jobId!, {
                ...existing,
                progress: message.progress ?? existing.progress,
                stage: message.stage ?? existing.stage,
                bytesTransferred: message.bytesTransferred ?? existing.bytesTransferred,
                transferSpeed: message.transferSpeed ?? existing.transferSpeed,
                estimatedTimeRemaining: message.estimatedTimeRemaining ?? existing.estimatedTimeRemaining,
              });
            }
            return next;
          });
        }
        break;

      case 'flash_completed':
        if (message.jobId) {
          setActiveJobs(prev => {
            const next = new Map(prev);
            const existing = next.get(message.jobId!);
            if (existing) {
              next.set(message.jobId!, {
                ...existing,
                progress: 100,
                stage: 'Completed',
                status: 'completed',
              });
            }
            return next;
          });

          if (shouldNotify) {
            toast.success(`Flash completed: ${message.deviceId}`, {
              description: 'Device flashing operation finished successfully',
            });
          }
        }
        break;

      case 'flash_failed':
        if (message.jobId) {
          setActiveJobs(prev => {
            const next = new Map(prev);
            const existing = next.get(message.jobId!);
            if (existing) {
              next.set(message.jobId!, {
                ...existing,
                status: 'failed',
                error: message.error,
              });
            }
            return next;
          });

          if (shouldNotify) {
            toast.error(`Flash failed: ${message.deviceId}`, {
              description: message.error || 'Device flashing operation failed',
            });
          }
        }
        break;

      case 'flash_paused':
        if (message.jobId) {
          setActiveJobs(prev => {
            const next = new Map(prev);
            const existing = next.get(message.jobId!);
            if (existing) {
              next.set(message.jobId!, {
                ...existing,
                status: 'paused',
              });
            }
            return next;
          });

          if (shouldNotify) {
            toast.warning(`Flash paused: ${message.deviceId}`);
          }
        }
        break;

      case 'flash_resumed':
        if (message.jobId) {
          setActiveJobs(prev => {
            const next = new Map(prev);
            const existing = next.get(message.jobId!);
            if (existing) {
              next.set(message.jobId!, {
                ...existing,
                status: 'running',
              });
            }
            return next;
          });

          if (shouldNotify) {
            toast.info(`Flash resumed: ${message.deviceId}`);
          }
        }
        break;

      case 'pong':
        break;

      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }, [shouldNotify]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (!isBackendReady) {
      clearReconnectTimeout();
      clearPingInterval();
      setConnectionStatus('disconnected');
      return;
    }

    clearReconnectTimeout();
    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        
        if (shouldNotify) {
          toast.success('Connected to flash progress server');
        }

        clearPingInterval();
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message: FlashProgressMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        clearPingInterval();

        // Only attempt reconnection if backend is still ready
        if (!isBackendReady) {
          clearReconnectTimeout();
          return;
        }

        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            // Check again before reconnecting (backend might have gone offline)
            if (isBackendReady) {
              setReconnectAttempts(prev => prev + 1);
              connect();
            } else {
              clearReconnectTimeout();
            }
          }, reconnectDelay);
        } else {
          // Only show error toast once when max attempts reached
          if (shouldNotify && reconnectAttempts === maxReconnectAttempts) {
            toast.error('Connection lost', {
              description: 'Max reconnection attempts reached',
            });
          }
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionStatus('error');
    }
  }, [url, reconnectAttempts, maxReconnectAttempts, reconnectDelay, shouldNotify, handleMessage, clearReconnectTimeout, clearPingInterval, isBackendReady]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    clearPingInterval();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setReconnectAttempts(0);
  }, [clearReconnectTimeout, clearPingInterval]);

  const send = useCallback((message: Partial<FlashProgressMessage>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        ...message,
        timestamp: Date.now(),
      }));
      return true;
    }
    return false;
  }, []);

  const clearJob = useCallback((jobId: string) => {
    setActiveJobs(prev => {
      const next = new Map(prev);
      next.delete(jobId);
      return next;
    });
  }, []);

  const clearAllJobs = useCallback(() => {
    setActiveJobs(new Map());
  }, []);

  useEffect(() => {
    if (autoConnect && isBackendReady) {
      connect();
    } else {
      disconnect();
      setReconnectAttempts(0);
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, isBackendReady, connect, disconnect]);

  return {
    isConnected,
    connectionStatus,
    reconnectAttempts,
    lastMessageTime,
    activeJobs: Array.from(activeJobs.values()),
    connect,
    disconnect,
    send,
    clearJob,
    clearAllJobs,
  };
}
