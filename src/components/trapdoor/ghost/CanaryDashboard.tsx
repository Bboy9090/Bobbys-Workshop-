/**
 * Canary Dashboard
 * 
 * Display all triggered canary token alerts.
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, Clock, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/app-context';
import { toast } from 'sonner';

interface CanaryDashboardProps {
  passcode?: string;
}

interface Alert {
  token_id: string;
  triggered_at: string;
  ip_address: string;
  user_agent: string;
  referrer?: string;
}

export function CanaryDashboard({ passcode }: CanaryDashboardProps) {
  const { backendAvailable } = useApp();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');

  const FASTAPI_URL = process.env.VITE_FASTAPI_URL || 'http://127.0.0.1:8000';

  useEffect(() => {
    if (passcode && backendAvailable) {
      loadAlerts();
      // Refresh every 10 seconds
      const interval = setInterval(loadAlerts, 10000);
      return () => clearInterval(interval);
    }
  }, [passcode, backendAvailable]);

  const loadAlerts = async () => {
    if (!passcode) return;

    try {
      const response = await fetch(`${FASTAPI_URL}/api/v1/trapdoor/ghost/alerts`, {
        headers: {
          'X-Secret-Room-Passcode': passcode,
        },
      });

      const data = await response.json();
      if (data.ok && data.data?.alerts) {
        setAlerts(data.data.alerts);
      }
    } catch (error) {
      // Silent error - will retry on next interval
      // Only show error on first load failure
      if (alerts.length === 0) {
        toast.error('Failed to load alerts', {
          description: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    
    const alertDate = new Date(alert.triggered_at);
    const now = new Date();
    
    if (filter === 'today') {
      return alertDate.toDateString() === now.toDateString();
    }
    
    if (filter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return alertDate >= weekAgo;
    }
    
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-ink-muted">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-panel">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink-primary">Canary Alerts</h2>
            <p className="text-sm text-ink-muted">{filteredAlerts.length} alerts</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-4 py-2 rounded-lg bg-basement-concrete border border-panel text-ink-primary"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredAlerts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-ink-muted opacity-50" />
              <p className="text-ink-muted mb-2">No alerts triggered</p>
              <p className="text-sm text-ink-muted">Canary tokens will appear here when accessed</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAlerts.map((alert, idx) => (
              <div
                key={alert.token_id || idx}
                className="p-6 rounded-lg bg-workbench-steel border border-state-danger/30"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-state-danger/20 border border-state-danger/30 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-state-danger" />
                    </div>
                    <div>
                      <h3 className="font-medium text-ink-primary">Token Triggered</h3>
                      <p className="text-xs text-ink-muted font-mono">{alert.token_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    <Clock className="w-4 h-4" />
                    {new Date(alert.triggered_at).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-4 h-4 text-ink-muted" />
                      <span className="text-xs font-medium text-ink-muted">IP Address</span>
                    </div>
                    <p className="text-sm text-ink-primary font-mono">{alert.ip_address}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-ink-muted" />
                      <span className="text-xs font-medium text-ink-muted">User Agent</span>
                    </div>
                    <p className="text-sm text-ink-primary truncate">{alert.user_agent}</p>
                  </div>
                </div>

                {alert.referrer && (
                  <div className="mt-4 pt-4 border-t border-panel">
                    <span className="text-xs font-medium text-ink-muted">Referrer: </span>
                    <span className="text-xs text-ink-primary">{alert.referrer}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
