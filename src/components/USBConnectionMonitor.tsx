import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Circle, Usb, Trash } from '@phosphor-icons/react';
import { getUSBVendorName } from '@/lib/deviceDetection';

interface ConnectionEvent {
  id: string;
  type: 'connect' | 'disconnect';
  timestamp: number;
  deviceInfo: {
    vendorId: number;
    productId: number;
    productName?: string;
    manufacturerName?: string;
    serialNumber?: string;
  };
}

// Helper function outside component for better performance
const createEventId = (type: string, vendorId: number, productId: number): string => {
  return `${Date.now()}-${type}-${vendorId}-${productId}`;
};

const createEventFromDevice = (device: any, type: 'connect' | 'disconnect'): ConnectionEvent => {
  return {
    id: createEventId(type, device.vendorId, device.productId),
    type,
    timestamp: Date.now(),
    deviceInfo: {
      vendorId: device.vendorId,
      productId: device.productId,
      productName: device.productName,
      manufacturerName: device.manufacturerName,
      serialNumber: device.serialNumber,
    }
  };
};

export function USBConnectionMonitor() {
  const [events, setEvents] = useState<ConnectionEvent[]>([]);
  
  // Derive monitoring state from USB API availability
  const nav = navigator as any;
  const isMonitoring = Boolean(nav.usb);

  useEffect(() => {
    const navInEffect = navigator as any;
    if (!navInEffect.usb) {
      return;
    }

    // Event handlers defined inside effect to avoid stale closures
    const handleConnect = (event: any) => {
      const newEvent = createEventFromDevice(event.device, 'connect');
      setEvents(prev => [newEvent, ...prev].slice(0, 50));
    };

    const handleDisconnect = (event: any) => {
      const newEvent = createEventFromDevice(event.device, 'disconnect');
      setEvents(prev => [newEvent, ...prev].slice(0, 50));
    };

    navInEffect.usb.addEventListener('connect', handleConnect);
    navInEffect.usb.addEventListener('disconnect', handleDisconnect);

    return () => {
      navInEffect.usb?.removeEventListener('connect', handleConnect);
      navInEffect.usb?.removeEventListener('disconnect', handleDisconnect);
    };
  }, []); // Empty deps is correct - USB API is a global singleton

  const clearHistory = useCallback(() => {
    setEvents([]);
  }, []);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) {
      return `${diffSecs}s ago`;
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleString();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-primary" />
            <CardTitle>Connection History</CardTitle>
            {isMonitoring && (
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <Circle size={8} weight="fill" className="animate-pulse" />
                <span className="hidden sm:inline">Recording</span>
              </div>
            )}
          </div>
          {events.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearHistory}
            >
              <Trash size={16} />
              Clear
            </Button>
          )}
        </div>
        <CardDescription>
          Real-time USB connection and disconnection events
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock size={48} className="mx-auto mb-2 opacity-50" />
            <p>No connection events recorded</p>
            <p className="text-xs mt-1">Connect or disconnect USB devices to see events</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {events.map((event) => {
                const deviceName = event.deviceInfo.productName || 
                  `Device (VID: 0x${event.deviceInfo.vendorId.toString(16).padStart(4, '0')})`;
                const vendorName = getUSBVendorName(event.deviceInfo.vendorId);

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className={`mt-0.5 ${
                      event.type === 'connect' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <Usb size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{deviceName}</div>
                          {event.deviceInfo.manufacturerName && (
                            <div className="text-xs text-muted-foreground">
                              {event.deviceInfo.manufacturerName}
                            </div>
                          )}
                          <div className="flex gap-2 mt-1 text-xs text-muted-foreground font-mono">
                            <span>VID: 0x{event.deviceInfo.vendorId.toString(16).padStart(4, '0')}</span>
                            <span>PID: 0x{event.deviceInfo.productId.toString(16).padStart(4, '0')}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge 
                            variant={event.type === 'connect' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {event.type === 'connect' ? 'Connected' : 'Disconnected'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">
                          {vendorName}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
