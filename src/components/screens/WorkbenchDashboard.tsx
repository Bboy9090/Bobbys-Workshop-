/**
 * WorkbenchDashboard
 * 
 * Apartment workbench overview + quick actions + system status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { WorkbenchQuickActions } from '../workbench/WorkbenchQuickActions';
import { WorkbenchSystemStatus } from '../workbench/WorkbenchSystemStatus';
import { TerminalLogStream, LogEntry } from '../core/TerminalLogStream';
import { OrnamentGraffitiTag } from '../ornaments/OrnamentGraffitiTag';
import { OrnamentStickyNote } from '../ornaments/OrnamentStickyNote';
import { useApp } from '@/lib/app-context';

export function WorkbenchDashboard() {
  const { backendAvailable } = useApp();
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toISOString(),
      level: 'info',
      message: '[SYSTEM] Workshop initialized',
      source: 'dashboard',
    },
  ]);

  // Add log entry helper
  const addLog = useCallback((level: LogEntry['level'], message: string, source = 'dashboard') => {
    setRecentLogs(prev => {
      const newLog: LogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        level,
        message,
        source,
      };
      // Keep only last 50 logs
      return [...prev, newLog].slice(-50);
    });
  }, []);

  // Log backend status on mount
  useEffect(() => {
    if (backendAvailable) {
      addLog('info', '[SYSTEM] Backend connected - real mode active');
    } else {
      addLog('warn', '[SYSTEM] Backend offline - running in demo mode');
    }
  }, [backendAvailable, addLog]);

  // Scan devices action
  const handleScanDevices = useCallback(async () => {
    addLog('info', '[ACTION] Scanning for connected devices...');
    
    if (!backendAvailable) {
      setTimeout(() => addLog('warn', '[SCAN] Backend offline - cannot scan'), 500);
      return;
    }

    try {
      const response = await fetch('/api/v1/adb/devices');
      const data = await response.json();
      
      if (data.ok && data.data?.devices) {
        const count = data.data.devices.length;
        addLog('info', `[SCAN] Found ${count} Android device(s)`);
        data.data.devices.forEach((d: { serial: string; state: string }) => {
          addLog('debug', `  → ${d.serial} (${d.state})`);
        });
      } else {
        addLog('info', '[SCAN] No Android devices found');
      }
    } catch (error) {
      addLog('error', `[SCAN] Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [backendAvailable, addLog]);

  // Flash device action (navigates to flashing tab)
  const handleFlashDevice = useCallback(() => {
    addLog('info', '[ACTION] Opening flash panel...');
  }, [addLog]);

  // Search firmware action
  const handleSearchFirmware = useCallback(() => {
    addLog('info', '[ACTION] Opening firmware search...');
  }, [addLog]);

  // Refresh action
  const handleRefresh = useCallback(() => {
    addLog('info', '[ACTION] Refreshing dashboard...');
    window.location.reload();
  }, [addLog]);

  return (
    <div className="space-y-6 relative">
      <OrnamentGraffitiTag text="WORKBENCH" position="top-right" />
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink-primary font-mono mb-2">
          Dashboard
        </h1>
        <p className="text-sm text-ink-muted">
          Apartment workbench overview
        </p>
      </div>

      {/* Quick Actions & System Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WorkbenchQuickActions
          onScanDevices={handleScanDevices}
          onFlashDevice={handleFlashDevice}
          onSearchFirmware={handleSearchFirmware}
          onRefresh={handleRefresh}
        />
        
        <WorkbenchSystemStatus />
      </div>

      {/* Recent Activity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-mono uppercase tracking-wider text-ink-muted">
            Recent Activity
          </h2>
        </div>
        
        <div className="h-48 rounded-lg border border-panel overflow-hidden">
          <TerminalLogStream
            logs={recentLogs}
            maxLines={10}
            autoScroll={false}
            className="h-full"
          />
        </div>
      </div>

      {/* Sticky Note Tip */}
      <div className="relative">
        <OrnamentStickyNote
          text="Use Quick Actions to jump into common operations. System Status shows backend health and catalog state."
          variant="tip"
          position="static"
        />
      </div>
    </div>
  );
}
