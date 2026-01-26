/**
 * PHOENIX FORGE - Backend Status Indicator
 * 
 * Real-time connectivity monitoring with:
 * - REST API health check
 * - WebSocket connection status
 * - BootForge USB backend status
 */

import { useState, useEffect, useRef } from 'react';
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CheckCircle, Warning, XCircle, CircleNotch, Lightning } from '@phosphor-icons/react';
import { useBackendHealth } from '@/lib/backend-health';
import { useAudioNotifications } from '@/hooks/use-audio-notifications';
import { API_CONFIG, getWSUrl } from '@/lib/apiConfig';
import { LegendaryConnectionManager } from '@/lib/legendary-connection-manager';

interface ServiceStatus {
  name: string;
  status: 'connected' | 'checking' | 'disconnected' | 'error';
  lastCheck: number;
  error?: string;
  endpoint?: string;
}

const WS_DEVICE_EVENTS_URL = getWSUrl('/ws/device-events');

export function BackendStatusIndicator() {
  const health = useBackendHealth(30000);
  const audio = useAudioNotifications();
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [bootforgeStatus, setBootforgeStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const previousWsStatusRef = useRef<'connected' | 'disconnected' | 'checking'>('checking');
  const audioRef = useRef(audio);

  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);
  
  // WebSocket Connection
  useEffect(() => {
    const connectionManager = new LegendaryConnectionManager({
      url: WS_DEVICE_EVENTS_URL,
      maxReconnectAttempts: Infinity,
      initialReconnectDelay: 1000,
      maxReconnectDelay: 60000,
      jitter: true,
      healthCheckBeforeReconnect: true,
      onConnect: () => {
        if (previousWsStatusRef.current === 'disconnected') {
          audioRef.current.handleConnect();
        }
        setWsStatus('connected');
        previousWsStatusRef.current = 'connected';
      },
      onDisconnect: () => {
        if (previousWsStatusRef.current === 'connected') {
          audioRef.current.handleDisconnect();
        }
        setWsStatus('disconnected');
        previousWsStatusRef.current = 'disconnected';
      },
      onError: () => {
        setWsStatus('disconnected');
      }
    });

    connectionManager.connect();

    const statusInterval = setInterval(() => {
      const stats = connectionManager.getStats();
      if (stats.isConnected) {
        setWsStatus('connected');
      } else if (stats.status === 'connecting' || stats.status === 'reconnecting') {
        setWsStatus('checking');
      } else {
        setWsStatus('disconnected');
      }
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      connectionManager.disconnect();
    };
  }, []);

  // Check BootForge USB backend
  useEffect(() => {
    const checkBootforge = async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/bootforgeusb/status`, {
          signal: AbortSignal.timeout(5000),
        });
        setBootforgeStatus(response.ok ? 'connected' : 'disconnected');
      } catch {
        setBootforgeStatus('disconnected');
      }
    };

    checkBootforge();
    const interval = setInterval(checkBootforge, 30000);

    return () => clearInterval(interval);
  }, []);

  const services: ServiceStatus[] = [
    {
      name: 'REST API',
      status: health.isHealthy ? 'connected' : 'disconnected',
      lastCheck: health.lastCheck,
      error: health.error,
      endpoint: `${API_CONFIG.BASE_URL}/api/health`
    },
    {
      name: 'WebSocket',
      status: wsStatus,
      lastCheck: Date.now(),
      endpoint: WS_DEVICE_EVENTS_URL
    },
    {
      name: 'BootForge USB',
      status: bootforgeStatus,
      lastCheck: Date.now(),
      endpoint: `${API_CONFIG.BASE_URL}/api/bootforgeusb/*`
    }
  ];

  const allConnected = services.every(s => s.status === 'connected');
  const someConnected = services.some(s => s.status === 'connected');
  const allChecking = services.every(s => s.status === 'checking');

  const getOverallStatus = () => {
    if (allChecking) return 'checking';
    if (allConnected) return 'connected';
    if (someConnected) return 'partial';
    return 'disconnected';
  };

  const overallStatus = getOverallStatus();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle weight="fill" className="text-[#10B981]" size={16} />;
      case 'checking':
        return <CircleNotch className="text-[#64748B] animate-spin" size={16} />;
      case 'disconnected':
      case 'error':
        return <XCircle weight="fill" className="text-[#F43F5E]" size={16} />;
      default:
        return <Warning weight="fill" className="text-[#F59E0B]" size={16} />;
    }
  };

  const getOverallBadge = () => {
    switch (overallStatus) {
      case 'connected':
        return (
          <Badge variant="success" className="gap-1.5">
            <Lightning weight="fill" size={12} />
            Forge Online
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="warning" className="gap-1.5">
            <Warning weight="fill" size={12} />
            Partial
          </Badge>
        );
      case 'checking':
        return (
          <Badge variant="secondary" className="gap-1.5">
            <CircleNotch className="animate-spin" size={12} />
            Connecting...
          </Badge>
        );
      default:
        return (
          <Badge variant="error" className="gap-1.5">
            <XCircle weight="fill" size={12} />
            Offline
          </Badge>
        );
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-auto p-0 hover:bg-transparent"
          onClick={(e) => e.stopPropagation()}
        >
          {getOverallBadge()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-[#14142B] border-white/10" align="end">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-sm text-[#F1F5F9]">Forge Services</h3>
            <p className="text-xs text-[#64748B] mt-1">
              Real-time connectivity monitoring
            </p>
          </div>

          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]"
              >
                <div className="flex items-center gap-2.5">
                  {getStatusIcon(service.status)}
                  <div>
                    <p className="text-sm font-medium text-[#F1F5F9]">{service.name}</p>
                    <p className="text-[10px] font-mono text-[#64748B] truncate max-w-[140px]">
                      {service.endpoint}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={service.status === 'connected' ? 'online' : 'offline'}
                  size="sm"
                >
                  {service.status}
                </Badge>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-white/[0.05]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748B]">Last Updated</span>
              <span className="font-mono text-[#94A3B8]">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>

          {!allConnected && (
            <div className="p-2.5 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/20">
              <p className="text-xs text-[#FB7185]">
                <strong>Limited Mode:</strong> Some backend services are unavailable. 
                Certain features may not function properly.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
