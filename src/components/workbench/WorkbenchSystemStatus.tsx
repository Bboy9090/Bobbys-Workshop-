/**
 * PHOENIX FORGE - System Status Panel
 * 
 * Real-time system status indicators:
 * - Backend health
 * - Catalog loaded
 * - Device locks
 * - Active operations
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Loader2, Shield, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/app-context';
import { useBackendHealth } from '@/lib/backend-health';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

interface StatusItem {
  id: string;
  label: string;
  status: 'ready' | 'warning' | 'error' | 'checking';
  message?: string;
}

interface WorkbenchSystemStatusProps {
  showCatalog?: boolean;
  showLocks?: boolean;
  showActiveOps?: boolean;
}

interface CatalogStatus {
  loaded: boolean;
  checking: boolean;
  error?: string;
}

export function WorkbenchSystemStatus({
  showCatalog = true,
  showLocks = true,
  showActiveOps = true,
}: WorkbenchSystemStatusProps) {
  const { backendAvailable } = useApp();
  const backendHealth = useBackendHealth(30000);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>({
    loaded: false,
    checking: true,
  });
  const [activeLocks, setActiveLocks] = useState<number | null>(null);
  const [activeOps, setActiveOps] = useState<number | null>(null);

  // Check catalog status from API
  useEffect(() => {
    if (!backendAvailable || !showCatalog) {
      setCatalogStatus({ loaded: false, checking: false });
      return;
    }

    let cancelled = false;

    async function checkCatalog() {
      setCatalogStatus(prev => ({ ...prev, checking: true }));
      
      try {
        const response = await fetch('/api/v1/catalog', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (cancelled) return;

        if (!response.ok) {
          setCatalogStatus({
            loaded: false,
            checking: false,
            error: `HTTP ${response.status}`,
          });
          return;
        }

        const envelope = await response.json();
        
        if (cancelled) return;

        if (envelope.ok && envelope.data?.available) {
          setCatalogStatus({ loaded: true, checking: false });
        } else {
          setCatalogStatus({
            loaded: false,
            checking: false,
            error: envelope.error?.message || 'Catalog unavailable',
          });
        }
      } catch (error) {
        if (cancelled) return;
        console.error('[WorkbenchSystemStatus] Catalog check failed:', error);
        setCatalogStatus({
          loaded: false,
          checking: false,
          error: error instanceof Error ? error.message : 'Network error',
        });
      }
    }

    checkCatalog();

    return () => {
      cancelled = true;
    };
  }, [backendAvailable, showCatalog]);

  // Check device locks from API
  useEffect(() => {
    if (!backendAvailable || !showLocks) {
      setActiveLocks(null);
      return;
    }

    let cancelled = false;

    async function checkLocks() {
      try {
        const response = await fetch('/api/v1/locks', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (cancelled) return;

        if (!response.ok) {
          setActiveLocks(null);
          return;
        }

        const envelope = await response.json();
        
        if (cancelled) return;

        if (envelope.ok && typeof envelope.data?.count === 'number') {
          setActiveLocks(envelope.data.count);
        } else {
          setActiveLocks(null);
        }
      } catch {
        if (cancelled) return;
        setActiveLocks(null);
      }
    }

    checkLocks();
    const interval = setInterval(checkLocks, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backendAvailable, showLocks]);

  // Check active operations from API
  useEffect(() => {
    if (!backendAvailable || !showActiveOps) {
      setActiveOps(null);
      return;
    }

    let cancelled = false;

    async function checkOps() {
      try {
        const response = await fetch('/api/v1/operations/active', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (cancelled) return;

        if (!response.ok) {
          setActiveOps(null);
          return;
        }

        const envelope = await response.json();
        
        if (cancelled) return;

        if (envelope.ok && typeof envelope.data?.count === 'number') {
          setActiveOps(envelope.data.count);
        } else {
          setActiveOps(null);
        }
      } catch {
        if (cancelled) return;
        setActiveOps(null);
      }
    }

    checkOps();
    const interval = setInterval(checkOps, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backendAvailable, showActiveOps]);

  const statusItems: StatusItem[] = [
    {
      id: 'backend',
      label: 'Backend Forge',
      status: backendHealth.isHealthy ? 'ready' : 'error',
      message: backendHealth.isHealthy ? 'Connected' : 'Offline',
    },
    ...(showCatalog ? [{
      id: 'catalog',
      label: 'Firmware Catalog',
      status: catalogStatus.checking
        ? 'checking'
        : catalogStatus.loaded
        ? 'ready'
        : catalogStatus.error
        ? 'error'
        : 'warning',
      message: catalogStatus.checking
        ? 'Loading...'
        : catalogStatus.loaded
        ? 'Loaded'
        : catalogStatus.error || 'Unavailable',
    }] : []),
    ...(showLocks ? [{
      id: 'locks',
      label: 'Device Locks',
      status: activeLocks === null ? 'checking' : activeLocks > 0 ? 'warning' : 'ready',
      message: activeLocks === null ? 'Unknown' : activeLocks > 0 ? `${activeLocks} active` : 'None',
    }] : []),
    ...(showActiveOps ? [{
      id: 'ops',
      label: 'Operations',
      status: activeOps === null ? 'checking' : activeOps > 0 ? 'warning' : 'ready',
      message: activeOps === null ? 'Unknown' : activeOps > 0 ? `${activeOps} running` : 'Idle',
    }] : []),
  ];

  const getStatusIcon = (status: StatusItem['status']) => {
    switch (status) {
      case 'ready':
        return <CheckCircle2 className="w-4 h-4 text-[#10B981]" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-[#F59E0B]" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-[#F43F5E]" />;
      case 'checking':
        return <Loader2 className="w-4 h-4 text-[#64748B] animate-spin" />;
    }
  };

  const getStatusColor = (status: StatusItem['status']) => {
    switch (status) {
      case 'ready':
        return 'text-[#34D399]';
      case 'warning':
        return 'text-[#FCD34D]';
      case 'error':
        return 'text-[#FB7185]';
      case 'checking':
        return 'text-[#64748B]';
    }
  };

  return (
    <Card variant="cosmic">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#A78BFA]" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {statusItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.05]"
            >
              <div className="flex items-center gap-2.5">
                {getStatusIcon(item.status)}
                <span className="text-sm text-[#F1F5F9]">{item.label}</span>
              </div>
              {item.message && (
                <span className={cn(
                  "text-xs font-mono",
                  getStatusColor(item.status)
                )}>
                  {item.message}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
