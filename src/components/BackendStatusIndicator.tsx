import { useState, useEffect, useRef } from 'react';
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CheckCircle, Warning, XCircle, CircleNotch } from '@phosphor-icons/react';
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
  const health = useBackendHealth(30000); // Check every 30 seconds (reduced noise)
  const audio = useAudioNotifications();
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [bootforgeStatus, setBootforgeStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const previousWsStatusRef = useRef<'connected' | 'disconnected' | 'checking'>('checking');
  const audioRef = useRef(audio);
  const shouldReconnectRef = useRef(true);

  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);
  
  // 🔱 LEGENDARY WebSocket Connection - Bulletproof reconnection
  useEffect(() => {
    const connectionManager = new LegendaryConnectionManager({
      url: WS_DEVICE_EVENTS_URL,
      maxReconnectAttempts: Infinity, // Never give up!
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

    // Start connection
    connectionManager.connect();

    // Update status based on connection state
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
      } catch (error) {
        setBootforgeStatus('disconnected');
      }
    };

    checkBootforge();
    const interval = setInterval(checkBootforge, 30000); // Check every 30 seconds (reduced noise)

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
        return <CheckCircle weight="fill" className="text-success" size={16} />;
      case 'checking':
        return <CircleNotch className="text-muted-foreground animate-spin" size={16} />;
      case 'disconnected':
      case 'error':
        return <XCircle weight="fill" className="text-destructive" size={16} />;
      default:
        return <Warning weight="fill" className="text-warning" size={16} />;
    }
  };

  const getOverallBadge = () => {
    switch (overallStatus) {
      case 'connected':
        return (
          <Badge className="text-xs font-mono candy-shimmer bg-success hover:bg-success/90">
            <div className="status-led connected mr-1.5" />
            🟢 All Services Online
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="text-xs font-mono candy-shimmer" variant="outline">
            <div className="status-led error mr-1.5" />
            ⚠️ Partial Connectivity
          </Badge>
        );
      case 'checking':
        return (
          <Badge className="text-xs font-mono" variant="secondary">
            <CircleNotch className="animate-spin mr-1.5" size={14} />
            Checking...
          </Badge>
        );
      default:
        return (
          <Badge className="text-xs font-mono" variant="destructive">
            <div className="status-led disconnected mr-1.5" />
            ⚠️ Offline Mode
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
          onClick={(e) => {
            // Prevent any accidental auto-opening
            e.stopPropagation();
          }}
        >
          {getOverallBadge()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sneaker-box-card" align="end">
        <div className="space-y-3">
          <div className="graffiti-tag">
            <h3 className="font-semibold text-sm">Backend Services Status</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Real-time connectivity monitoring
            </p>
          </div>

          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-2 rounded-md bg-secondary/20 device-card-console"
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(service.status)}
                  <div>
                    <p className="text-sm font-medium">{service.name}</p>
                    <p className="text-xs font-mono text-muted-foreground console-text">
                      {service.endpoint}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    variant={service.status === 'connected' ? 'default' : 'outline'}
                    className="text-xs"
                  >
                    {service.status}
                  </Badge>
                  {service.error && (
                    <p className="text-xs text-destructive mt-1">{service.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="font-mono console-text">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>

          {!allConnected && (
            <div className="p-2 rounded-md bg-error/10 border border-error/20">
              <p className="text-xs text-error">
                <strong>Backend Offline:</strong> Backend server is not responding. 
                Please check the server connection. Some features may be unavailable.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
