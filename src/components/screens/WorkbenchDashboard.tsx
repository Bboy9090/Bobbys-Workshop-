/**
 * PHOENIX FORGE - Dashboard
 * 
 * Command center overview with real-time statistics,
 * quick actions, and system monitoring.
 * 
 * NO MOCKS - All data comes from real API endpoints.
 */

import { useState, useEffect, useCallback } from 'react';
import { WorkbenchQuickActions } from '../workbench/WorkbenchQuickActions';
import { WorkbenchSystemStatus } from '../workbench/WorkbenchSystemStatus';
import { TerminalLogStream, LogEntry } from '../core/TerminalLogStream';
import { useApp } from '@/lib/app-context';
import { StatCard, Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  Smartphone, 
  Zap, 
  Activity, 
  Flame,
  CheckCircle,
  Clock,
  TrendingUp,
  Loader2,
} from 'lucide-react';

interface DashboardStats {
  devicesRepaired: number | null;
  activeDevices: number;
  successRate: number | null;
  avgRepairTime: string | null;
  loading: boolean;
}

export function WorkbenchDashboard() {
  const { backendAvailable } = useApp();
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toISOString(),
      level: 'info',
      message: '[PHOENIX] Forge systems online',
      source: 'dashboard',
    },
  ]);

  // Real statistics from API - no mock data
  const [stats, setStats] = useState<DashboardStats>({
    devicesRepaired: null,
    activeDevices: 0,
    successRate: null,
    avgRepairTime: null,
    loading: true,
  });

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
      return [...prev, newLog].slice(-50);
    });
  }, []);

  // Fetch real statistics from API
  useEffect(() => {
    if (!backendAvailable) {
      setStats(prev => ({ ...prev, loading: false }));
      return;
    }

    let cancelled = false;

    async function fetchStats() {
      try {
        // Fetch active devices count
        const devicesResponse = await fetch('/api/v1/adb/devices');
        const devicesData = await devicesResponse.json();
        
        if (cancelled) return;

        const activeDevices = devicesData.ok && devicesData.data?.devices 
          ? devicesData.data.devices.length 
          : 0;

        // Fetch repair statistics from API (if available)
        let repairStats = { total: null, successRate: null, avgTime: null };
        try {
          const statsResponse = await fetch('/api/v1/stats/repairs');
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            if (statsData.ok && statsData.data) {
              repairStats = {
                total: statsData.data.totalRepairs ?? null,
                successRate: statsData.data.successRate ?? null,
                avgTime: statsData.data.avgRepairTime ?? null,
              };
            }
          }
        } catch {
          // Stats endpoint may not exist - that's okay, show null
        }

        // Fetch from cases API as fallback for completed repairs
        if (repairStats.total === null) {
          try {
            const casesResponse = await fetch('/api/v1/cases?status=completed');
            if (casesResponse.ok) {
              const casesData = await casesResponse.json();
              if (casesData.ok && casesData.data?.cases) {
                repairStats.total = casesData.data.cases.length;
              }
            }
          } catch {
            // Cases endpoint may not exist
          }
        }

        if (cancelled) return;

        setStats({
          devicesRepaired: repairStats.total,
          activeDevices,
          successRate: repairStats.successRate,
          avgRepairTime: repairStats.avgTime,
          loading: false,
        });

        addLog('info', `[STATS] Dashboard updated: ${activeDevices} active device(s)`);

      } catch (error) {
        if (cancelled) return;
        console.error('[Dashboard] Failed to fetch stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    }

    fetchStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backendAvailable, addLog]);

  // Log backend status on mount
  useEffect(() => {
    if (backendAvailable) {
      addLog('info', '[PHOENIX] Backend forge connected - full power mode');
    } else {
      addLog('warn', '[PHOENIX] Backend offline - limited functionality');
    }
  }, [backendAvailable, addLog]);

  // Action handlers
  const handleScanDevices = useCallback(async () => {
    addLog('info', '[SCAN] Detecting connected devices...');
    
    if (!backendAvailable) {
      setTimeout(() => addLog('warn', '[SCAN] Backend offline - cannot scan'), 500);
      return;
    }

    try {
      const response = await fetch('/api/v1/adb/devices');
      const data = await response.json();
      
      if (data.ok && data.data?.devices) {
        const count = data.data.devices.length;
        addLog('info', `[SCAN] Detected ${count} device(s)`);
        data.data.devices.forEach((d: { serial: string; state: string }) => {
          addLog('debug', `  → ${d.serial} (${d.state})`);
        });
        
        // Update active devices count
        setStats(prev => ({ ...prev, activeDevices: count }));
      } else {
        addLog('info', '[SCAN] No devices detected');
        setStats(prev => ({ ...prev, activeDevices: 0 }));
      }
    } catch (error) {
      addLog('error', `[SCAN] Detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [backendAvailable, addLog]);

  const handleFlashDevice = useCallback(() => {
    addLog('info', '[FORGE] Initializing flash sequence...');
  }, [addLog]);

  const handleSearchFirmware = useCallback(() => {
    addLog('info', '[FORGE] Opening firmware repository...');
  }, [addLog]);

  const handleRefresh = useCallback(() => {
    addLog('info', '[SYSTEM] Refreshing dashboard...');
    window.location.reload();
  }, [addLog]);

  // Format display value - show loading or actual value
  const formatStatValue = (value: number | string | null, suffix = ''): string => {
    if (stats.loading) return '...';
    if (value === null) return '--';
    return `${value}${suffix}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9] flex items-center gap-3">
            <Flame className="w-7 h-7 text-[#FF6B2C]" />
            Command Center
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Phoenix Forge operational dashboard
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {stats.loading && (
            <Badge variant="secondary" className="gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading
            </Badge>
          )}
          <Badge variant={backendAvailable ? 'success' : 'warning'}>
            {backendAvailable ? 'Forge Online' : 'Limited Mode'}
          </Badge>
        </div>
      </div>

      {/* Real Stats Grid - Data from API */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Repairs Completed"
          value={formatStatValue(stats.devicesRepaired)}
          icon={CheckCircle}
          description={stats.devicesRepaired !== null ? "From case records" : "No data available"}
          variant="phoenix"
        />
        
        <StatCard
          title="Active Devices"
          value={stats.activeDevices}
          icon={Smartphone}
          description="Currently connected"
          variant="cosmic"
        />
        
        <StatCard
          title="Success Rate"
          value={formatStatValue(stats.successRate, '%')}
          icon={TrendingUp}
          description={stats.successRate !== null ? "Calculated from records" : "No data available"}
          variant="success"
        />
        
        <StatCard
          title="Avg Repair Time"
          value={formatStatValue(stats.avgRepairTime)}
          icon={Clock}
          description={stats.avgRepairTime !== null ? "Per device average" : "No data available"}
          variant="default"
        />
      </div>

      {/* Main Grid - Actions & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WorkbenchQuickActions
          onScanDevices={handleScanDevices}
          onFlashDevice={handleFlashDevice}
          onSearchFirmware={handleSearchFirmware}
          onRefresh={handleRefresh}
        />
        
        <WorkbenchSystemStatus />
      </div>

      {/* Activity Log */}
      <Card variant="glass">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#06B6D4]" />
              Activity Stream
            </CardTitle>
            <Badge variant="ghost" size="sm">
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-48 rounded-lg bg-[#0A0A12] border border-white/5 overflow-hidden">
            <TerminalLogStream
              logs={recentLogs}
              maxLines={10}
              autoScroll={true}
              className="h-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card variant="phoenix" className="overflow-hidden">
        <div className="p-4 flex items-start gap-4">
          <div className="p-2 rounded-lg bg-[rgba(255,77,0,0.1)]">
            <Zap className="w-5 h-5 text-[#FF6B2C]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#F1F5F9] mb-1">Quick Tip</h3>
            <p className="text-sm text-[#94A3B8]">
              Use the Quick Actions panel to jump into common operations. The System Status card shows real-time backend health and catalog state.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
