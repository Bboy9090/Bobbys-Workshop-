/**
 * Batch Operations Panel
 * 
 * GOD MODE: UI for managing multi-device operations.
 * Real-time progress tracking, cancellation, and reporting.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Layers,
  Play,
  Pause,
  X,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Smartphone,
  AlertTriangle,
  BarChart3,
  FileText,
  Download,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  BatchOperation,
  BatchDeviceOperation,
  batchOperations,
  BatchStatus,
} from '@/lib/batch-operations';
import { UnifiedDevice } from '@/hooks/use-ultimate-device-manager';
import { OPERATIONS, OperationType } from '@/lib/secret-operations';
import { createRepairReport, downloadReport } from '@/lib/repair-reports';

interface BatchOperationsPanelProps {
  devices: UnifiedDevice[];
  onClose?: () => void;
}

// Status colors
const STATUS_CONFIG: Record<BatchStatus, { color: string; icon: React.ReactNode }> = {
  pending: { color: 'text-gray-400', icon: <Clock className="w-4 h-4" /> },
  running: { color: 'text-blue-400', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  completed: { color: 'text-green-400', icon: <CheckCircle className="w-4 h-4" /> },
  failed: { color: 'text-red-400', icon: <XCircle className="w-4 h-4" /> },
  cancelled: { color: 'text-yellow-400', icon: <AlertTriangle className="w-4 h-4" /> },
};

export function BatchOperationsPanel({ devices, onClose }: BatchOperationsPanelProps) {
  const [activeBatch, setActiveBatch] = useState<BatchOperation | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<OperationType | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [passcode, setPasscode] = useState('');
  
  // Subscribe to batch updates
  useEffect(() => {
    const unsubBatch = batchOperations.onBatchUpdate((batch) => {
      if (activeBatch && batch.id === activeBatch.id) {
        setActiveBatch({ ...batch });
      }
    });
    
    return () => {
      unsubBatch();
    };
  }, [activeBatch]);
  
  // Toggle device selection
  const toggleDevice = useCallback((deviceId: string) => {
    setSelectedDevices(prev => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  }, []);
  
  // Select all devices
  const selectAll = useCallback(() => {
    setSelectedDevices(new Set(devices.map(d => d.id)));
  }, [devices]);
  
  // Deselect all
  const deselectAll = useCallback(() => {
    setSelectedDevices(new Set());
  }, []);
  
  // Start batch
  const startBatch = useCallback(async () => {
    if (!selectedOperation || selectedDevices.size === 0) {
      toast.error('Select an operation and at least one device');
      return;
    }
    
    const selectedDeviceList = devices.filter(d => selectedDevices.has(d.id));
    
    const batch = batchOperations.createBatch(
      selectedOperation,
      selectedDeviceList,
      {
        maxConcurrent: 3,
        continueOnError: true,
      }
    );
    
    setActiveBatch(batch);
    
    // Execute
    batchOperations.executeBatch(batch.id, passcode).then(() => {
      toast.success('Batch operation completed');
    }).catch((error) => {
      toast.error(`Batch failed: ${error.message}`);
    });
    
  }, [selectedOperation, selectedDevices, devices, passcode]);
  
  // Cancel batch
  const cancelBatch = useCallback(() => {
    if (activeBatch) {
      batchOperations.cancelBatch(activeBatch.id);
      toast.info('Batch operation cancelled');
    }
  }, [activeBatch]);
  
  // Export report
  const exportBatchReport = useCallback(() => {
    if (!activeBatch) return;
    
    // Create mock device for report
    const mockDevice = {
      id: 'batch',
      serial: 'BATCH-' + activeBatch.id,
      platform: 'android' as const,
      mode: 'batch' as const,
      displayName: `Batch: ${activeBatch.devices.length} devices`,
      connectionType: 'usb' as const,
      isFlashable: false,
      lastSeen: Date.now(),
      connectionHealth: 'excellent' as const,
      capabilities: [],
    };
    
    const operations = activeBatch.devices
      .filter(d => d.result)
      .map(d => d.result!);
    
    const report = createRepairReport(mockDevice, operations);
    downloadReport(report, 'html');
    toast.success('Report downloaded');
  }, [activeBatch]);
  
  // Get available operations
  const availableOperations = Object.values(OPERATIONS).filter(op => 
    op.supportedPlatforms.includes('android') || op.supportedPlatforms.includes('ios')
  );
  
  // Calculate overall progress
  const overallProgress = activeBatch
    ? activeBatch.devices.reduce((sum, d) => sum + d.progress, 0) / activeBatch.devices.length
    : 0;

  return (
    <div className="h-full flex flex-col bg-basement-concrete">
      {/* Header */}
      <div className="p-4 border-b border-panel bg-workbench-steel flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="w-6 h-6 text-spray-cyan" />
          <div>
            <h2 className="text-lg font-bold text-ink-primary font-mono">
              BATCH OPERATIONS
            </h2>
            <p className="text-xs text-ink-muted">
              Execute operations on multiple devices simultaneously
            </p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Configuration */}
        {!activeBatch && (
          <div className="w-80 border-r border-panel p-4 space-y-4 overflow-auto">
            {/* Operation Selection */}
            <div>
              <label className="text-sm font-mono text-ink-muted mb-2 block">
                SELECT OPERATION
              </label>
              <ScrollArea className="h-48">
                <div className="space-y-1 pr-3">
                  {availableOperations.map(op => (
                    <button
                      key={op.type}
                      onClick={() => setSelectedOperation(op.type)}
                      className={cn(
                        "w-full p-2 rounded text-left text-sm transition-colors",
                        selectedOperation === op.type
                          ? "bg-spray-cyan/20 text-spray-cyan border border-spray-cyan"
                          : "bg-basement-concrete hover:bg-workbench-steel border border-panel"
                      )}
                    >
                      <div className="font-medium">{op.name}</div>
                      <div className="text-xs text-ink-muted truncate">
                        {op.description}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Device Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-mono text-ink-muted">
                  SELECT DEVICES ({selectedDevices.size}/{devices.length})
                </label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={selectAll}>All</Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>None</Button>
                </div>
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-1 pr-3">
                  {devices.map(device => (
                    <button
                      key={device.id}
                      onClick={() => toggleDevice(device.id)}
                      className={cn(
                        "w-full p-2 rounded text-left text-sm transition-colors flex items-center gap-2",
                        selectedDevices.has(device.id)
                          ? "bg-spray-cyan/20 border border-spray-cyan"
                          : "bg-basement-concrete hover:bg-workbench-steel border border-panel"
                      )}
                    >
                      <Smartphone className="w-4 h-4 text-ink-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{device.displayName}</div>
                        <div className="text-xs text-ink-muted truncate">
                          {device.serial} • {device.mode}
                        </div>
                      </div>
                      {selectedDevices.has(device.id) && (
                        <CheckCircle className="w-4 h-4 text-spray-cyan shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Passcode */}
            <div>
              <label className="text-sm font-mono text-ink-muted mb-2 block">
                SECRET ROOM PASSCODE
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full p-2 rounded bg-basement-concrete border border-panel text-ink-primary font-mono"
                placeholder="Enter passcode..."
              />
            </div>

            {/* Start Button */}
            <Button
              onClick={startBatch}
              disabled={!selectedOperation || selectedDevices.size === 0 || !passcode}
              className="w-full h-12 bg-spray-cyan hover:bg-spray-cyan/80 text-black font-mono"
            >
              <Play className="w-5 h-5 mr-2" />
              START BATCH ({selectedDevices.size} devices)
            </Button>
          </div>
        )}

        {/* Right: Progress / Results */}
        <div className="flex-1 p-4 overflow-auto">
          {activeBatch ? (
            <div className="space-y-4">
              {/* Overall Progress */}
              <Card className="bg-workbench-steel border-panel">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-mono flex items-center gap-2">
                      <span className={STATUS_CONFIG[activeBatch.status].color}>
                        {STATUS_CONFIG[activeBatch.status].icon}
                      </span>
                      {activeBatch.operationName}
                    </CardTitle>
                    <Badge className={cn(
                      "font-mono",
                      activeBatch.status === 'completed' && "bg-green-500/20 text-green-400",
                      activeBatch.status === 'running' && "bg-blue-500/20 text-blue-400",
                      activeBatch.status === 'failed' && "bg-red-500/20 text-red-400"
                    )}>
                      {activeBatch.status.toUpperCase()}
                    </Badge>
                  </div>
                  <CardDescription>
                    {activeBatch.summary.completed}/{activeBatch.summary.total} devices completed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={overallProgress} className="h-2" />
                  
                  <div className="grid grid-cols-5 gap-2 mt-4 text-center text-xs">
                    <div>
                      <div className="text-2xl font-bold text-ink-primary">
                        {activeBatch.summary.total}
                      </div>
                      <div className="text-ink-muted">Total</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-400">
                        {activeBatch.summary.completed}
                      </div>
                      <div className="text-ink-muted">Success</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-400">
                        {activeBatch.summary.failed}
                      </div>
                      <div className="text-ink-muted">Failed</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-400">
                        {activeBatch.summary.running}
                      </div>
                      <div className="text-ink-muted">Running</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-400">
                        {activeBatch.summary.pending}
                      </div>
                      <div className="text-ink-muted">Pending</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    {activeBatch.status === 'running' && (
                      <Button 
                        variant="destructive" 
                        onClick={cancelBatch}
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                    {(activeBatch.status === 'completed' || activeBatch.status === 'failed') && (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={() => setActiveBatch(null)}
                          className="flex-1"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          New Batch
                        </Button>
                        <Button 
                          onClick={exportBatchReport}
                          className="flex-1"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export Report
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Device Progress List */}
              <div className="space-y-2">
                <h3 className="text-sm font-mono text-ink-muted">DEVICE PROGRESS</h3>
                <AnimatePresence>
                  {activeBatch.devices.map((device, index) => (
                    <motion.div
                      key={device.deviceId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className={cn(
                        "bg-basement-concrete border-panel",
                        device.status === 'running' && "border-blue-500/50",
                        device.status === 'completed' && "border-green-500/30",
                        device.status === 'failed' && "border-red-500/30"
                      )}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={STATUS_CONFIG[device.status].color}>
                                {STATUS_CONFIG[device.status].icon}
                              </span>
                              <span className="font-medium text-ink-primary">
                                {device.deviceName}
                              </span>
                              <span className="text-xs text-ink-muted">
                                {device.deviceSerial}
                              </span>
                            </div>
                            <span className="text-xs text-ink-muted">
                              {device.progress}%
                            </span>
                          </div>
                          <Progress 
                            value={device.progress} 
                            className={cn(
                              "h-1",
                              device.status === 'failed' && "bg-red-500/20"
                            )}
                          />
                          {device.error && (
                            <p className="text-xs text-red-400 mt-2">
                              {device.error.userMessage}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-ink-muted">
                <Zap className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="font-mono text-lg">Configure Batch Operation</p>
                <p className="text-sm mt-2">
                  Select an operation and devices to begin
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BatchOperationsPanel;
