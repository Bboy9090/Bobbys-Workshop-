/**
 * Ultimate Operations Panel
 * 
 * GOD MODE: Complete interface for all secret room operations.
 * Beautiful, powerful, and unstoppable.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Lock, 
  Unlock,
  Smartphone,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  Flame,
  Zap,
  Skull,
  Eye,
  Key,
  Download,
  Upload,
  RefreshCw,
  Terminal,
  FileCode,
  Database,
  Cpu
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  OPERATIONS,
  OperationType,
  OperationDefinition,
  RiskLevel,
  executeOperation,
  OperationResult,
  OperationStep
} from '@/lib/secret-operations';

interface UltimateOperationsPanelProps {
  passcode: string;
  deviceSerial?: string;
  devicePlatform?: 'android' | 'ios';
  deviceMode?: string;
}

// Risk level colors and icons
const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; icon: React.ReactNode }> = {
  safe: { color: 'text-green-400', bg: 'bg-green-500/20', icon: <CheckCircle className="w-4 h-4" /> },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: <Eye className="w-4 h-4" /> },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: <AlertTriangle className="w-4 h-4" /> },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20', icon: <Flame className="w-4 h-4" /> },
  critical: { color: 'text-red-400', bg: 'bg-red-500/20', icon: <Zap className="w-4 h-4" /> },
  destructive: { color: 'text-red-600', bg: 'bg-red-600/30', icon: <Skull className="w-4 h-4" /> },
};

// Category icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  bypass: <Unlock className="w-5 h-5" />,
  bootloader: <Key className="w-5 h-5" />,
  root: <Terminal className="w-5 h-5" />,
  recovery: <RefreshCw className="w-5 h-5" />,
  jailbreak: <Zap className="w-5 h-5" />,
  check: <Eye className="w-5 h-5" />,
  flash: <Download className="w-5 h-5" />,
  backup: <Database className="w-5 h-5" />,
  repair: <Cpu className="w-5 h-5" />,
};

export function UltimateOperationsPanel({
  passcode,
  deviceSerial,
  devicePlatform = 'android',
  deviceMode = 'normal'
}: UltimateOperationsPanelProps) {
  const [selectedOperation, setSelectedOperation] = useState<OperationType | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');

  // Group operations by category
  const operationCategories = {
    all: Object.values(OPERATIONS),
    bypass: Object.values(OPERATIONS).filter(op => 
      ['frp_bypass', 'mdm_remove'].includes(op.type)
    ),
    bootloader: Object.values(OPERATIONS).filter(op => 
      ['bootloader_unlock', 'bootloader_relock', 'oem_unlock'].includes(op.type)
    ),
    root: Object.values(OPERATIONS).filter(op => 
      ['root_install', 'root_remove'].includes(op.type)
    ),
    jailbreak: Object.values(OPERATIONS).filter(op => 
      ['checkra1n_jailbreak', 'palera1n_jailbreak', 'dfu_restore'].includes(op.type)
    ),
    flash: Object.values(OPERATIONS).filter(op => 
      ['recovery_flash', 'custom_rom_flash', 'stock_restore'].includes(op.type)
    ),
    check: Object.values(OPERATIONS).filter(op => 
      ['icloud_check', 'imei_check', 'carrier_check'].includes(op.type)
    ),
    backup: Object.values(OPERATIONS).filter(op => 
      ['partition_backup', 'partition_restore', 'nand_dump'].includes(op.type)
    ),
    repair: Object.values(OPERATIONS).filter(op => 
      ['emmc_repair'].includes(op.type)
    ),
  };

  const filteredOperations = operationCategories[activeCategory as keyof typeof operationCategories] || [];

  // Execute operation
  const handleExecute = useCallback(async () => {
    if (!selectedOperation || !deviceSerial) return;

    const operation = OPERATIONS[selectedOperation];
    
    // Verify confirmation
    if (operation.requiresConfirmation) {
      if (confirmationInput.toUpperCase() !== operation.confirmationText?.toUpperCase()) {
        toast.error(`Type "${operation.confirmationText}" to confirm`);
        return;
      }
    }

    setIsExecuting(true);
    setCurrentStep(0);
    setResult(null);

    try {
      const result = await executeOperation(
        selectedOperation,
        deviceSerial,
        passcode,
        (step) => {
          setCurrentStep(prev => prev + 1);
        }
      );

      setResult(result);

      if (result.success) {
        toast.success(`${operation.name} completed successfully`);
      } else {
        toast.error(`${operation.name} failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Operation failed unexpectedly');
    } finally {
      setIsExecuting(false);
      setConfirmationInput('');
    }
  }, [selectedOperation, deviceSerial, passcode, confirmationInput]);

  const selectedOp = selectedOperation ? OPERATIONS[selectedOperation] : null;

  return (
    <div className="h-full flex bg-basement-concrete">
      {/* Left: Operation List */}
      <div className="w-80 border-r border-panel bg-workbench-steel flex flex-col">
        <div className="p-4 border-b border-panel">
          <h2 className="text-lg font-bold text-ink-primary font-mono flex items-center gap-2">
            <Shield className="w-5 h-5 text-spray-cyan" />
            SECRET OPERATIONS
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            {deviceSerial ? `Device: ${deviceSerial}` : 'No device selected'}
          </p>
        </div>

        {/* Category Tabs */}
        <div className="p-2 border-b border-panel">
          <ScrollArea className="w-full">
            <div className="flex gap-1 pb-2">
              {Object.keys(operationCategories).map((cat) => (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    "text-xs whitespace-nowrap",
                    activeCategory === cat && "bg-spray-cyan/20 text-spray-cyan"
                  )}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Operation List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <AnimatePresence>
              {filteredOperations.map((op) => {
                const risk = RISK_CONFIG[op.riskLevel];
                const isSelected = selectedOperation === op.type;
                const isSupported = op.supportedPlatforms.includes(devicePlatform);

                return (
                  <motion.div
                    key={op.type}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      onClick={() => setSelectedOperation(op.type)}
                      disabled={!isSupported}
                      className={cn(
                        "w-full p-3 rounded-lg border text-left transition-all",
                        isSelected
                          ? "border-spray-cyan bg-spray-cyan/10"
                          : "border-panel hover:border-spray-cyan/50 bg-basement-concrete",
                        !isSupported && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("shrink-0", risk.color)}>
                              {risk.icon}
                            </span>
                            <span className="font-medium text-ink-primary text-sm truncate">
                              {op.name}
                            </span>
                          </div>
                          <p className="text-xs text-ink-muted mt-1 line-clamp-1">
                            {op.description}
                          </p>
                        </div>
                        <ChevronRight className={cn(
                          "w-4 h-4 text-ink-muted shrink-0 transition-transform",
                          isSelected && "rotate-90 text-spray-cyan"
                        )} />
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Badge 
                          variant="outline" 
                          className={cn("text-[10px] py-0", risk.bg, risk.color)}
                        >
                          {op.riskLevel}
                        </Badge>
                        {op.supportedPlatforms.map(p => (
                          <Badge 
                            key={p} 
                            variant="outline" 
                            className="text-[10px] py-0"
                          >
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>

      {/* Right: Operation Details */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedOp ? (
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-ink-primary font-mono flex items-center gap-3">
                    <span className={RISK_CONFIG[selectedOp.riskLevel].color}>
                      {RISK_CONFIG[selectedOp.riskLevel].icon}
                    </span>
                    {selectedOp.name}
                  </h1>
                  <p className="text-sm text-ink-muted mt-2">
                    {selectedOp.description}
                  </p>
                </div>
                <Badge 
                  className={cn(
                    "text-sm py-1 px-3",
                    RISK_CONFIG[selectedOp.riskLevel].bg,
                    RISK_CONFIG[selectedOp.riskLevel].color
                  )}
                >
                  {selectedOp.riskLevel.toUpperCase()} RISK
                </Badge>
              </div>

              {/* Warnings */}
              {selectedOp.warnings.length > 0 && (
                <Alert className="border-yellow-500/50 bg-yellow-500/10">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {selectedOp.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Legal Notice */}
              <Alert className="border-red-500/30 bg-red-500/5">
                <Shield className="w-4 h-4 text-red-400" />
                <AlertDescription className="text-xs text-ink-muted">
                  <strong className="text-red-400">LEGAL NOTICE:</strong>{' '}
                  {selectedOp.legalNotice}
                </AlertDescription>
              </Alert>

              {/* Steps Preview */}
              <Card className="bg-workbench-steel border-panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono">Operation Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2">
                    {selectedOp.steps.map((step, i) => (
                      <li 
                        key={i}
                        className={cn(
                          "flex items-center gap-3 text-sm",
                          isExecuting && i < currentStep && "text-green-400",
                          isExecuting && i === currentStep && "text-spray-cyan",
                          isExecuting && i > currentStep && "text-ink-muted"
                        )}
                      >
                        <span className={cn(
                          "w-6 h-6 rounded-full border flex items-center justify-center text-xs font-mono shrink-0",
                          isExecuting && i < currentStep && "bg-green-500/20 border-green-500",
                          isExecuting && i === currentStep && "bg-spray-cyan/20 border-spray-cyan",
                          !isExecuting && "border-panel"
                        )}>
                          {isExecuting && i < currentStep ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : isExecuting && i === currentStep ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            i + 1
                          )}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              {/* Confirmation */}
              {selectedOp.requiresConfirmation && !result && (
                <Card className="bg-workbench-steel border-red-500/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-mono text-red-400">
                      Confirmation Required
                    </CardTitle>
                    <CardDescription>
                      Type <span className="font-mono text-red-400">{selectedOp.confirmationText}</span> to proceed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Input
                      value={confirmationInput}
                      onChange={(e) => setConfirmationInput(e.target.value)}
                      placeholder={selectedOp.confirmationText}
                      className="font-mono text-center text-lg tracking-widest"
                      disabled={isExecuting}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Result */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className={cn(
                    "border-2",
                    result.success 
                      ? "border-green-500/50 bg-green-500/10" 
                      : "border-red-500/50 bg-red-500/10"
                  )}>
                    <CardHeader className="pb-3">
                      <CardTitle className={cn(
                        "flex items-center gap-2",
                        result.success ? "text-green-400" : "text-red-400"
                      )}>
                        {result.success ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                        {result.success ? 'Operation Successful' : 'Operation Failed'}
                      </CardTitle>
                      <CardDescription>
                        Completed in {(result.duration / 1000).toFixed(2)}s
                      </CardDescription>
                    </CardHeader>
                    {result.error && (
                      <CardContent>
                        <pre className="text-xs font-mono text-red-400 bg-black/30 p-3 rounded overflow-auto max-h-32">
                          {result.error}
                        </pre>
                      </CardContent>
                    )}
                  </Card>
                </motion.div>
              )}

              {/* Execute Button */}
              <div className="flex gap-3">
                <Button
                  onClick={handleExecute}
                  disabled={
                    isExecuting || 
                    !deviceSerial ||
                    (selectedOp.requiresConfirmation && 
                      confirmationInput.toUpperCase() !== selectedOp.confirmationText?.toUpperCase())
                  }
                  className={cn(
                    "flex-1 h-12 font-mono text-lg",
                    selectedOp.riskLevel === 'destructive' 
                      ? "bg-red-600 hover:bg-red-700" 
                      : "bg-spray-cyan hover:bg-spray-cyan/80"
                  )}
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      EXECUTING...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      EXECUTE OPERATION
                    </>
                  )}
                </Button>
                
                {result && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResult(null);
                      setConfirmationInput('');
                    }}
                    className="h-12"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-ink-muted">
              <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-mono">Select an operation from the list</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UltimateOperationsPanel;
