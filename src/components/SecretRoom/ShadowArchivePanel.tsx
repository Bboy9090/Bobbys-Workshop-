/**
 * Shadow Archive Panel - Secret Room #7
 * 
 * Complete operation history (shadow logs, operation history, analytics)
 * Risk Level: Admin (Jordan Concord - Blue/White)
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { FileText, AlertTriangle, Loader2, Download, Search, Calendar, Database, TrendingUp } from 'lucide-react';
import { ShadowLogsViewer } from '../ShadowLogsViewer';

interface ShadowArchivePanelProps {
  deviceSerial?: string;
}

export const ShadowArchivePanel: React.FC<ShadowArchivePanelProps> = ({ deviceSerial: initialDeviceSerial }) => {
  const [deviceSerial, setDeviceSerial] = useState(initialDeviceSerial || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      
      const response = await fetch('/api/v1/trapdoor/logs/shadow/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Room-Passcode': passcode,
        },
        body: JSON.stringify({
          deviceSerial: deviceSerial || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shadow-logs-${Date.now()}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card-jordan bg-[#141922] border-[#2FD3FF]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#2FD3FF]/20 rounded-lg">
                <FileText className="h-6 w-6 text-[#2FD3FF]" />
              </div>
              <div>
                <CardTitle className="text-legendary text-2xl font-display uppercase text-white">
                  Shadow Archive
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Complete operation history - Every action, logged and encrypted
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              ADMIN ACCESS
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-[#0B0F14] border-[#2FD3FF]/50">
            <Database className="h-4 w-4 text-[#2FD3FF]" />
            <AlertDescription className="text-gray-300">
              <strong className="text-[#2FD3FF]">Shadow Archive:</strong> Encrypted, immutable audit logs. 
              Complete device operation timeline with correlation tracking and analytics.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-[#0B0F14] border-[#2FD3FF]/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#2FD3FF]" />
                  <CardTitle className="text-white text-sm">Shadow Logs</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-xs">
                  Encrypted, immutable audit logs
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0B0F14] border-[#2FD3FF]/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#2FD3FF]" />
                  <CardTitle className="text-white text-sm">Analytics</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-xs">
                  Visualize your operations
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0B0F14] border-[#2FD3FF]/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#2FD3FF]" />
                  <CardTitle className="text-white text-sm">Correlation</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 text-xs">
                  Link operations across devices
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Device Serial (optional)
                </label>
                <Input
                  value={deviceSerial}
                  onChange={(e) => setDeviceSerial(e.target.value)}
                  placeholder="Filter by device"
                  className="bg-[#0B0F14] border-[#2FD3FF]/50 text-white"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-[#0B0F14] border-[#2FD3FF]/50 text-white"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-[#0B0F14] border-[#2FD3FF]/50 text-white"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleExport}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Logs
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#141922] border-[#2FD3FF]/20">
        <CardHeader>
          <CardTitle className="text-white">Shadow Logs Viewer</CardTitle>
          <CardDescription className="text-gray-400">
            Complete operation history with search and filter capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShadowLogsViewer />
        </CardContent>
      </Card>
    </div>
  );
};
