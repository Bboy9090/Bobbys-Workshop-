/**
 * UnifiedDeviceCard Component
 * 
 * Device card styled as a baseball card (90s hip-hop aesthetic)
 * Based on master theme system
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface UnifiedDeviceCardProps {
  device: {
    id: string;
    name: string;
    model?: string;
    manufacturer?: string;
    serial?: string;
    platform?: 'android' | 'ios' | 'unknown';
    status?: string;
    battery?: number;
    connectionType?: string;
    [key: string]: any;
  };
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export function UnifiedDeviceCard({
  device,
  onClick,
  selected,
  className,
}: UnifiedDeviceCardProps) {
  const getPlatformIcon = () => {
    switch (device.platform) {
      case 'android':
        return '🤖';
      case 'ios':
        return '🍎';
      default:
        return '📱';
    }
  };

  const getPlatformColor = () => {
    switch (device.platform) {
      case 'android':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'ios':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    }
  };

  return (
    <Card
      className={cn(
        'baseball-card cursor-pointer transition-all',
        selected && 'ring-2 ring-primary',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{getPlatformIcon()}</span>
            <div>
              <CardTitle className="text-lg font-display uppercase tracking-tight">
                {device.name || device.model || 'Unknown Device'}
              </CardTitle>
              <CardDescription className="text-xs mt-1 font-mono">
                {device.serial || device.id}
              </CardDescription>
            </div>
          </div>
          {device.platform && (
            <Badge className={getPlatformColor()}>
              {device.platform.toUpperCase()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="baseball-card-stats space-y-2">
          {device.manufacturer && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Manufacturer:</span>
              <span className="font-semibold">{device.manufacturer}</span>
            </div>
          )}
          {device.model && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Model:</span>
              <span className="font-semibold">{device.model}</span>
            </div>
          )}
          {device.battery !== undefined && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Battery:</span>
              <span className="font-semibold">{device.battery}%</span>
            </div>
          )}
          {device.connectionType && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Connection:</span>
              <span className="font-semibold uppercase">{device.connectionType}</span>
            </div>
          )}
          {device.status && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="outline" className="text-xs">
                {device.status}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
