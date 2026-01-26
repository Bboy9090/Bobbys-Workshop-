/**
 * Operation Executor Component
 * 
 * Browse, execute, and simulate Trapdoor operations with dynamic forms
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { 
  Play, 
  Eye, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Shield,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

interface Operation {
  id: string;
  displayName: string;
  description: string;
  category: string;
  riskLevel: string;
  requiresConfirmation: boolean;
  requiredCapabilities: string[];
  parameters?: Record<string, any>;
}

interface OperationResult {
  envelope: {
    type: string;
    timestamp: string;
    correlationId: string;
  };
  operation: {
    id: string;
    status: string;
    error?: any;
  };
  data: any;
  metadata: any;
}

export const OperationExecutor: React.FC = () => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [params, setParams] = useState<Record<string, any>>({});
  const [result, setResult] = useState<OperationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  useEffect(() => {
    loadOperations();
  }, []);

  const loadOperations = async () => {
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || '';
      const response = await fetch('/api/v1/trapdoor/operations', {
        headers: {
          'X-Secret-Room-Passcode': passcode
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.operations) {
          setOperations(data.data.operations);
        }
      }
    } catch (error) {
      console.error('Failed to load operations:', error);
      toast.error('Failed to load operations');
    }
  };

  const handleOperationSelect = (operation: Operation) => {
    setSelectedOperation(operation);
    setResult(null);
    // Initialize params with defaults
    const initialParams: Record<string, any> = {};
    if (operation.parameters) {
      Object.entries(operation.parameters).forEach(([key, spec]: [string, any]) => {
        if (spec.default !== undefined) {
          initialParams[key] = spec.default;
        }
      });
    }
    setParams(initialParams);
  };

  const handleParamChange = (key: string, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSimulate = async () => {
    if (!selectedOperation) return;
    
    setIsSimulating(true);
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || '';
      const response = await fetch('/api/v1/trapdoor/simulate', {
        method: 'POST',
        headers: {
          'X-Secret-Room-Passcode': passcode,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: selectedOperation.id,
          params
        })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.operation.status === 'success') {
        toast.success('Simulation successful');
      } else {
        toast.error('Simulation failed');
      }
    } catch (error) {
      toast.error('Simulation error');
      console.error(error);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedOperation) return;
    
    // Check if confirmation required
    if (selectedOperation.requiresConfirmation) {
      const confirmed = window.confirm(
        `This operation requires confirmation. Risk level: ${selectedOperation.riskLevel.toUpperCase()}\n\nProceed?`
      );
      if (!confirmed) return;
    }
    
    setIsLoading(true);
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || '';
      const response = await fetch('/api/v1/trapdoor/execute', {
        method: 'POST',
        headers: {
          'X-Secret-Room-Passcode': passcode,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: selectedOperation.id,
          params,
          confirmation: selectedOperation.requiresConfirmation ? 'CONFIRMED' : undefined
        })
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.operation.status === 'success') {
        toast.success('Operation executed successfully');
      } else {
        toast.error(`Operation failed: ${data.operation.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Execution error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOperations = operations.filter(op => {
    const matchesSearch = op.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         op.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || op.category === filterCategory;
    const matchesRisk = filterRisk === 'all' || op.riskLevel === filterRisk;
    return matchesSearch && matchesCategory && matchesRisk;
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'destructive': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-[#141922]">
          <TabsTrigger value="browse">Browse Operations</TabsTrigger>
          <TabsTrigger value="execute">Execute Operation</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <Card className="bg-[#141922] border-[#2FD3FF]/20">
            <CardHeader>
              <CardTitle className="text-white">Operation Catalog</CardTitle>
              <CardDescription className="text-gray-400">
                Browse available operations for your role
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filters */}
              <div className="space-y-2">
                <Input
                  placeholder="Search operations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#0B0F14] border-[#2FD3FF]/50"
                />
                <div className="flex gap-2">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="flex-1 bg-[#0B0F14] border border-[#2FD3FF]/50 rounded p-2 text-white text-sm"
                  >
                    <option value="all">All Categories</option>
                    <option value="diagnostics">Diagnostics</option>
                    <option value="safe">Safe</option>
                    <option value="backup">Backup</option>
                    <option value="restore">Restore</option>
                    <option value="destructive">Destructive</option>
                  </select>
                  <select
                    value={filterRisk}
                    onChange={(e) => setFilterRisk(e.target.value)}
                    className="flex-1 bg-[#0B0F14] border border-[#2FD3FF]/50 rounded p-2 text-white text-sm"
                  >
                    <option value="all">All Risk Levels</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="destructive">Destructive</option>
                  </select>
                </div>
              </div>

              {/* Operations List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredOperations.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No operations found</p>
                ) : (
                  filteredOperations.map((op) => (
                    <div
                      key={op.id}
                      onClick={() => handleOperationSelect(op)}
                      className={`p-4 bg-[#0B0F14] rounded border cursor-pointer transition-all ${
                        selectedOperation?.id === op.id
                          ? 'border-[#2FD3FF] bg-[#2FD3FF]/10'
                          : 'border-[#2FD3FF]/20 hover:border-[#2FD3FF]/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-white font-semibold">{op.displayName}</h4>
                            <Badge className={getRiskColor(op.riskLevel)}>
                              {op.riskLevel}
                            </Badge>
                            {op.requiresConfirmation && (
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                                <Shield className="h-3 w-3 mr-1" />
                                Confirmation Required
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">{op.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-500">{op.category}</span>
                            {op.requiredCapabilities && op.requiredCapabilities.length > 0 && (
                              <>
                                <span className="text-xs text-gray-500">•</span>
                                <span className="text-xs text-gray-500">
                                  Requires: {op.requiredCapabilities.join(', ')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOperationSelect(op);
                          }}
                          className="bg-[#2FD3FF] hover:bg-[#2FD3FF]/80 text-black"
                        >
                          Select
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="execute" className="space-y-4">
          {selectedOperation ? (
            <>
              <Card className="bg-[#141922] border-[#2FD3FF]/20">
                <CardHeader>
                  <CardTitle className="text-white">{selectedOperation.displayName}</CardTitle>
                  <CardDescription className="text-gray-400">
                    {selectedOperation.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Parameters Form */}
                  {selectedOperation.parameters && Object.keys(selectedOperation.parameters).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(selectedOperation.parameters).map(([key, spec]: [string, any]) => (
                        <div key={key}>
                          <Label className="text-white mb-2 block">
                            {spec.description || key}
                            {spec.required && <span className="text-red-400 ml-1">*</span>}
                          </Label>
                          {spec.type === 'boolean' ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={params[key] || false}
                                onChange={(e) => handleParamChange(key, e.target.checked)}
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-gray-400">Enable</span>
                            </div>
                          ) : spec.type === 'string' && spec.enum ? (
                            <select
                              value={params[key] || ''}
                              onChange={(e) => handleParamChange(key, e.target.value)}
                              className="w-full bg-[#0B0F14] border border-[#2FD3FF]/50 rounded p-2 text-white"
                            >
                              {spec.enum.map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              type={spec.type === 'integer' ? 'number' : 'text'}
                              value={params[key] || ''}
                              onChange={(e) => handleParamChange(key, spec.type === 'integer' ? parseInt(e.target.value) : e.target.value)}
                              placeholder={spec.description || key}
                              required={spec.required}
                              className="bg-[#0B0F14] border-[#2FD3FF]/50"
                            />
                          )}
                          {spec.description && (
                            <p className="text-xs text-gray-500 mt-1">{spec.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400">No parameters required for this operation</p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleSimulate}
                      disabled={isSimulating || isLoading}
                      variant="outline"
                      className="border-[#2FD3FF]/50 text-[#2FD3FF] hover:bg-[#2FD3FF]/10"
                    >
                      {isSimulating ? (
                        <Loader2 className="animate-spin mr-2" />
                      ) : (
                        <Eye className="mr-2" />
                      )}
                      Simulate
                    </Button>
                    <Button
                      onClick={handleExecute}
                      disabled={isLoading || isSimulating}
                      className="bg-[#2FD3FF] hover:bg-[#2FD3FF]/80 text-black flex-1"
                    >
                      {isLoading ? (
                        <Loader2 className="animate-spin mr-2" />
                      ) : (
                        <Play className="mr-2" />
                      )}
                      Execute Operation
                    </Button>
                  </div>

                  {/* Warnings */}
                  {selectedOperation.requiresConfirmation && (
                    <Alert className="bg-yellow-500/10 border-yellow-500/50">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <AlertDescription className="text-yellow-400">
                        This operation requires explicit confirmation due to {selectedOperation.riskLevel} risk level.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Results */}
              {result && (
                <Card className="bg-[#141922] border-[#2FD3FF]/20">
                  <CardHeader>
                    <CardTitle className="text-white">Operation Result</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {result.operation.status === 'success' ? (
                          <CheckCircle className="text-green-400" />
                        ) : (
                          <XCircle className="text-red-400" />
                        )}
                        <span className="text-white font-semibold">
                          Status: {result.operation.status.toUpperCase()}
                        </span>
                      </div>
                      {result.operation.error && (
                        <Alert className="bg-red-500/10 border-red-500/50">
                          <AlertDescription className="text-red-400">
                            <strong>Error:</strong> {result.operation.error.message}
                            {result.operation.error.code && (
                              <span className="block text-sm mt-1">Code: {result.operation.error.code}</span>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}
                      {result.data && (
                        <div className="bg-[#0B0F14] p-4 rounded">
                          <pre className="text-sm text-gray-300 overflow-x-auto">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="bg-[#141922] border-[#2FD3FF]/20">
              <CardContent className="py-12 text-center">
                <p className="text-gray-400">Select an operation from the Browse tab to execute</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
