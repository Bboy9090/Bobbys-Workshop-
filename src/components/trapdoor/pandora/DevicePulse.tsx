/**
 * Device Pulse Monitor
 * 
 * Real-time device status display with color-coded indicators.
 */

import React from 'react';
import { Usb, Battery, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DevicePulseProps {
  devices: any[];
  selectedDevice: any | null;
  onSelectDevice: (device: any) => void;
}

export function DevicePulse({ devices, selectedDevice, onSelectDevice }: DevicePulseProps) {
  const getModeColor = (mode?: string) => {
    switch (mode) {
      case 'dfu':
        return 'text-[#00FF41] border-[#00FF41]/30 bg-[#00FF41]/10';
      case 'recovery':
        return 'text-[#FFB000] border-[#FFB000]/30 bg-[#FFB000]/10';
      case 'normal':
        return 'text-[#FF0000] border-[#FF0000]/30 bg-[#FF0000]/10';
      default:
        return 'text-[#FFB000] border-[#FFB000]/30 bg-[#FFB000]/10';
    }
  };

  return (
    <div className="p-4 space-y-3">
      {devices.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-[#FFB000]">No devices detected</p>
          <p className="text-xs text-[#FFB000]/70 mt-2">Connect a device via USB</p>
        </div>
      ) : (
        devices.map((device) => (
          <button
            key={device.id}
            onClick={() => onSelectDevice(device)}
            className={cn(
              "w-full p-4 rounded-lg border text-left transition-all",
              selectedDevice?.id === device.id
                ? "border-[#00FF41] bg-[#00FF41]/20"
                : "border-[#FFB000]/30 hover:border-[#00FF41]/50",
              getModeColor(device.mode)
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Usb className="w-4 h-4" />
                <span className="font-medium">{device.name}</span>
              </div>
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                device.mode === 'dfu' && "bg-[#00FF41]",
                device.mode === 'recovery' && "bg-[#FFB000]",
                device.mode === 'normal' && "bg-[#FF0000]"
              )} />
            </div>
            
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#FFB000]/70">ID:</span>
                <span className="font-mono">{device.id}</span>
              </div>
              {device.mode && (
                <div className="flex justify-between">
                  <span className="text-[#FFB000]/70">Mode:</span>
                  <span className="uppercase">{device.mode}</span>
                </div>
              )}
              {device.vid && (
                <div className="flex justify-between">
                  <span className="text-[#FFB000]/70">VID:</span>
                  <span className="font-mono">{device.vid}</span>
                </div>
              )}
              {device.pid && (
                <div className="flex justify-between">
                  <span className="text-[#FFB000]/70">PID:</span>
                  <span className="font-mono">{device.pid}</span>
                </div>
              )}
            </div>
          </button>
        ))
      )}
    </div>
  );
}
