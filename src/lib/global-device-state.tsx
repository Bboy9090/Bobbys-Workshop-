/**
 * Global Device State Provider
 * 
 * GOD MODE: Centralized device state management for the entire application.
 * Provides real-time device updates to all components via React Context.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { 
  useUltimateDeviceManager, 
  UnifiedDevice, 
  DeviceMode 
} from '@/hooks/use-ultimate-device-manager';

interface GlobalDeviceState {
  // Devices
  devices: UnifiedDevice[];
  selectedDevice: UnifiedDevice | null;
  
  // Status
  isScanning: boolean;
  lastScanTime: number | null;
  error: string | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  
  // Device counts
  deviceCounts: {
    total: number;
    android: number;
    ios: number;
    flashable: number;
    byMode: Record<DeviceMode, number>;
  };
  
  // Actions
  scanDevices: () => Promise<void>;
  selectDevice: (deviceId: string | null) => void;
  refreshDevice: (deviceId: string) => Promise<void>;
  executeCommand: (deviceId: string, command: string) => Promise<{
    success: boolean;
    output: string;
    error?: string;
  }>;
  
  // Helpers
  getDeviceById: (id: string) => UnifiedDevice | undefined;
  getDevicesByMode: (mode: DeviceMode) => UnifiedDevice[];
  getFlashableDevices: () => UnifiedDevice[];
  getAndroidDevices: () => UnifiedDevice[];
  getIOSDevices: () => UnifiedDevice[];
}

const GlobalDeviceContext = createContext<GlobalDeviceState | null>(null);

export function GlobalDeviceProvider({ children }: { children: ReactNode }) {
  const deviceManager = useUltimateDeviceManager();
  
  // Helper functions
  const getDeviceById = (id: string) => deviceManager.devices.find(d => d.id === id);
  const getDevicesByMode = (mode: DeviceMode) => deviceManager.devices.filter(d => d.mode === mode);
  const getFlashableDevices = () => deviceManager.devices.filter(d => d.isFlashable);
  const getAndroidDevices = () => deviceManager.devices.filter(d => d.platform === 'android');
  const getIOSDevices = () => deviceManager.devices.filter(d => d.platform === 'ios');
  
  const value: GlobalDeviceState = {
    ...deviceManager,
    getDeviceById,
    getDevicesByMode,
    getFlashableDevices,
    getAndroidDevices,
    getIOSDevices,
  };
  
  return (
    <GlobalDeviceContext.Provider value={value}>
      {children}
    </GlobalDeviceContext.Provider>
  );
}

export function useGlobalDevices(): GlobalDeviceState {
  const context = useContext(GlobalDeviceContext);
  if (!context) {
    throw new Error('useGlobalDevices must be used within GlobalDeviceProvider');
  }
  return context;
}

/**
 * Hook to get a specific device by ID
 */
export function useDevice(deviceId: string | null): UnifiedDevice | null {
  const { getDeviceById } = useGlobalDevices();
  return deviceId ? getDeviceById(deviceId) || null : null;
}

/**
 * Hook to get flashable devices only
 */
export function useFlashableDevices(): UnifiedDevice[] {
  const { getFlashableDevices } = useGlobalDevices();
  return getFlashableDevices();
}

/**
 * Hook for device selection
 */
export function useDeviceSelection() {
  const { selectedDevice, selectDevice, devices } = useGlobalDevices();
  
  return {
    selectedDevice,
    selectDevice,
    hasSelection: selectedDevice !== null,
    clearSelection: () => selectDevice(null),
    selectFirst: () => {
      if (devices.length > 0) {
        selectDevice(devices[0].id);
      }
    },
  };
}
