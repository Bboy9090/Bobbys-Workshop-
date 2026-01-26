/**
 * TrapdoorToolArsenal
 * 
 * The Tool Arsenal - Secret Room for managing trapdoor tools
 * - Tool inventory display
 * - Hash verification status
 * - Tool execution interface
 * - Hash management
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, ShieldCheck, ShieldAlert, Terminal, Hash, 
  Play, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Loader2, FileKey, Eye, EyeOff, Save, Upload, Download, Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  listTools, 
  verifyTool, 
  executeTool, 
  updateToolHash,
  getToolInfo,
  type Tool,
  type ToolInfo
} from '@/lib/trapdoor-tools-api';
import { 
  getTrapdoorWebSocket,
  type ToolOutputMessage 
} from '@/lib/trapdoor-tools-websocket';
import { TerminalLogStream, LogEntry } from '../core/TerminalLogStream';

interface TrapdoorToolArsenalProps {
  passcode?: string;
  className?: string;
}

export function TrapdoorToolArsenal({
  passcode,
  className,
}: TrapdoorToolArsenalProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [toolInfo, setToolInfo] = useState<ToolInfo | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showHash, setShowHash] = useState<Record<string, boolean>>({});
  const [newHash, setNewHash] = useState<string>('');
  const [updatingHash, setUpdatingHash] = useState<string | null>(null);
  const [useWebSocket, setUseWebSocket] = useState<boolean>(true);
  const [executionSessionId, setExecutionSessionId] = useState<string | null>(null);
  const [toolOutput, setToolOutput] = useState<LogEntry[]>([]);

  // Load tools on mount
  useEffect(() => {
    loadTools();
    
    // Connect WebSocket
    const ws = getTrapdoorWebSocket();
    if (!ws.isConnected()) {
      ws.connect().catch(err => {
        console.error('Failed to connect WebSocket:', err);
        setError('WebSocket connection failed. Real-time output disabled.');
      });
    }
    
    return () => {
      // Cleanup on unmount
      ws.disconnect();
    };
  }, [passcode]);

  // Listen for tool output when session is active
  useEffect(() => {
    if (!executionSessionId) return;
    
    const ws = getTrapdoorWebSocket();
    if (!ws.isConnected()) {
      ws.connect().then(() => {
        ws.joinSession(executionSessionId);
      }).catch(console.error);
    } else {
      ws.joinSession(executionSessionId);
    }
    
    const unsubscribe = ws.onToolOutput(executionSessionId, (message: ToolOutputMessage) => {
      const logEntry: LogEntry = {
        id: `${Date.now()}_${Math.random()}`,
        timestamp: new Date(),
        level: message.type === 'error' ? 'error' : 
               message.type === 'end' ? (message.exit_code === 0 ? 'success' : 'error') : 'info',
        message: message.message,
        source: 'tool_execution'
      };
      
      setToolOutput(prev => [...prev, logEntry]);
      setLogs(prev => [...prev, logEntry]);
      
      if (message.type === 'end' || message.type === 'error') {
        setExecuting(null);
        setExecutionSessionId(null);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [executionSessionId]);

  // Load tool info when selected
  useEffect(() => {
    if (selectedTool) {
      loadToolInfo(selectedTool);
      setNewHash(''); // Reset hash input when tool changes
    }
  }, [selectedTool, passcode]);

  async function loadTools() {
    setLoading(true);
    setError(null);
    try {
      const toolsList = await listTools(passcode);
      setTools(toolsList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setLoading(false);
    }
  }

  async function loadToolInfo(toolKey: string) {
    try {
      const info = await getToolInfo(toolKey, passcode);
      setToolInfo(info);
    } catch (err) {
      console.error('Failed to load tool info:', err);
    }
  }

  async function handleVerify(toolKey: string) {
    setVerifying(toolKey);
    setLogs(prev => [...prev, {
      id: Date.now().toString(),
      timestamp: new Date(),
      level: 'info',
      message: `Verifying hash for ${toolKey}...`
    }]);

    try {
      const result = await verifyTool(toolKey, passcode);
      
      setLogs(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        timestamp: new Date(),
        level: result.hash_valid ? 'success' : 'error',
        message: result.hash_valid 
          ? `✓ Hash verified for ${toolKey}`
          : `✗ Hash verification failed: ${result.error}`
      }]);

      // Reload tools to update status
      await loadTools();
    } catch (err) {
      setLogs(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        timestamp: new Date(),
        level: 'error',
        message: `Verification error: ${err instanceof Error ? err.message : 'Unknown error'}`
      }]);
    } finally {
      setVerifying(null);
    }
  }

  async function handleExecute(toolKey: string) {
    setExecuting(toolKey);
    setToolOutput([]);
    
    const sessionId = useWebSocket ? getTrapdoorWebSocket().createSession() : null;
    setExecutionSessionId(sessionId);
    
    setLogs(prev => [...prev, {
      id: Date.now().toString(),
      timestamp: new Date(),
      level: 'info',
      message: `Executing ${toolKey}${useWebSocket ? ' (real-time output enabled)' : ''}...`
    }]);

    try {
      const result = await executeTool(
        toolKey,
        {
          confirmation: 'EXECUTE',
          use_websocket: useWebSocket,
          session_id: sessionId,
        },
        passcode
      );

      if (!useWebSocket) {
        // Legacy mode - no real-time output
        setLogs(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          timestamp: new Date(),
          level: result.success ? 'success' : 'error',
          message: result.success 
            ? `✓ Execution requested: ${result.message}`
            : `✗ Execution failed: ${result.error}`
        }]);
        setExecuting(null);
        setExecutionSessionId(null);
      } else {
        // WebSocket mode - output will come via WebSocket
        setLogs(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          timestamp: new Date(),
          level: 'info',
          message: `Execution started. Output streaming via WebSocket...`
        }]);
      }
    } catch (err) {
      setLogs(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        timestamp: new Date(),
        level: 'error',
        message: `Execution error: ${err instanceof Error ? err.message : 'Unknown error'}`
      }]);
      setExecuting(null);
      setExecutionSessionId(null);
    }
  }

  function getStatusIcon(tool: Tool) {
    switch (tool.status) {
      case 'verified':
        return <ShieldCheck className="w-4 h-4 text-green-500" />;
      case 'hash_mismatch':
        return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case 'unverified':
        return <Shield className="w-4 h-4 text-yellow-500" />;
      case 'not_found':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Shield className="w-4 h-4 text-gray-400" />;
    }
  }

  function getStatusBadge(tool: Tool) {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      verified: 'default',
      hash_mismatch: 'destructive',
      unverified: 'secondary',
      not_found: 'outline',
      unknown: 'outline',
    };

    return (
      <Badge variant={variants[tool.status] || 'outline'}>
        {tool.status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  }

  return (
    <div className={cn("h-full flex flex-col bg-basement-concrete", className)}>
      <div className="p-6 border-b border-panel">
        <div className="flex items-center gap-3 mb-2">
          <FileKey className="w-6 h-6 text-spray-magenta" />
          <h1 className="text-2xl font-bold text-ink-primary">The Tool Arsenal</h1>
        </div>
        <p className="text-sm text-ink-muted">
          Manage trapdoor tools with SHA256 hash verification
        </p>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Tools List */}
        <div className="w-80 border-r border-panel overflow-y-auto">
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-ink-primary">Tools</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadTools}
                disabled={loading}
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
            </div>

            {loading && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-spray-magenta" />
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!loading && tools.length === 0 && (
              <div className="text-center p-8 text-ink-muted">
                <p>No tools found</p>
                <p className="text-xs mt-2">Ensure trapdoor_api.py is running</p>
              </div>
            )}

            {tools.map((tool) => (
              <Card
                key={tool.key}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedTool === tool.key && "border-spray-magenta bg-workbench-steel"
                )}
                onClick={() => setSelectedTool(tool.key)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(tool)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-ink-primary truncate">
                          {tool.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(tool)}
                        <span className="text-xs text-ink-muted">{tool.type}</span>
                      </div>
                      {!tool.exists && (
                        <p className="text-xs text-state-danger">File not found</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Tool Details */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedTool ? (
            <div className="flex items-center justify-center h-full text-ink-muted">
              <div className="text-center">
                <FileKey className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a tool to view details</p>
              </div>
            </div>
          ) : toolInfo ? (
            <Tabs defaultValue="info" className="space-y-4">
              <TabsList>
                <TabsTrigger value="info">Information</TabsTrigger>
                <TabsTrigger value="verify">Verification</TabsTrigger>
                <TabsTrigger value="hash">Hash Management</TabsTrigger>
                <TabsTrigger value="execute">Execution</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{toolInfo.name}</CardTitle>
                    <CardDescription>Tool Details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Path</Label>
                      <p className="text-sm font-mono text-ink-muted bg-basement-concrete p-2 rounded">
                        {toolInfo.path}
                      </p>
                    </div>
                    <div>
                      <Label>Type</Label>
                      <p className="text-sm text-ink-muted">{toolInfo.type}</p>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(toolInfo)}
                        {getStatusBadge(toolInfo)}
                      </div>
                    </div>
                    {toolInfo.args.length > 0 && (
                      <div>
                        <Label>Default Arguments</Label>
                        <p className="text-sm font-mono text-ink-muted">
                          {toolInfo.args.join(' ')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Hash Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="w-5 h-5" />
                      Hash Verification
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Hash Configured</Label>
                      <p className="text-sm text-ink-muted">
                        {toolInfo.has_hash_configured ? 'Yes' : 'No'}
                      </p>
                    </div>
                    {toolInfo.expected_hash && (
                      <div>
                        <Label className="flex items-center gap-2">
                          Expected Hash (SHA256)
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowHash(prev => ({
                              ...prev,
                              [toolInfo.key]: !prev[toolInfo.key]
                            }))}
                          >
                            {showHash[toolInfo.key] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        </Label>
                        <p className="text-xs font-mono text-ink-muted bg-basement-concrete p-2 rounded break-all">
                          {showHash[toolInfo.key] ? toolInfo.expected_hash : '••••••••'}
                        </p>
                      </div>
                    )}
                    {toolInfo.current_hash && (
                      <div>
                        <Label>Current File Hash</Label>
                        <p className="text-xs font-mono text-ink-muted bg-basement-concrete p-2 rounded break-all">
                          {toolInfo.current_hash}
                        </p>
                      </div>
                    )}
                    {toolInfo.hash_valid !== undefined && (
                      <div>
                        <Label>Verification Result</Label>
                        <div className="flex items-center gap-2">
                          {toolInfo.hash_valid ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-green-500">Hash matches</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-red-500" />
                              <span className="text-sm text-red-500">Hash mismatch</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="verify" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Hash Verification</CardTitle>
                    <CardDescription>
                      Verify the tool's SHA256 hash matches the expected value
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => handleVerify(toolInfo.key)}
                      disabled={verifying === toolInfo.key || !toolInfo.exists}
                      className="w-full"
                    >
                      {verifying === toolInfo.key ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          Verify Hash
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hash" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="w-5 h-5" />
                      Hash Management
                    </CardTitle>
                    <CardDescription>
                      Update or set the SHA256 hash for this tool
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {toolInfo.current_hash && (
                      <div>
                        <Label>Current File Hash</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs font-mono text-ink-muted bg-basement-concrete p-2 rounded flex-1 break-all">
                            {toolInfo.current_hash}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(toolInfo.current_hash || '');
                              setLogs(prev => [...prev, {
                                id: Date.now().toString(),
                                timestamp: new Date(),
                                level: 'success',
                                message: 'Hash copied to clipboard'
                              }]);
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-ink-muted mt-1">
                          Use this hash to update the expected hash below
                        </p>
                      </div>
                    )}

                    <div>
                      <Label>Expected Hash (SHA256)</Label>
                      <Input
                        type="text"
                        placeholder="Enter 64-character hex hash"
                        value={newHash || toolInfo.expected_hash || ''}
                        onChange={(e) => setNewHash(e.target.value)}
                        className="font-mono text-xs mt-1"
                        maxLength={64}
                      />
                      <p className="text-xs text-ink-muted mt-1">
                        Must be exactly 64 hexadecimal characters
                      </p>
                    </div>

                    {toolInfo.expected_hash && (
                      <div>
                        <Label>Current Expected Hash</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs font-mono text-ink-muted bg-basement-concrete p-2 rounded flex-1 break-all">
                            {showHash[toolInfo.key] ? toolInfo.expected_hash : '••••••••'}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowHash(prev => ({
                              ...prev,
                              [toolInfo.key]: !prev[toolInfo.key]
                            }))}
                          >
                            {showHash[toolInfo.key] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setNewHash(toolInfo.expected_hash || '');
                            }}
                          >
                            Use Current
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-panel">
                      <Button
                        onClick={async () => {
                          const hashToUpdate = newHash || toolInfo.current_hash || '';
                          if (!hashToUpdate || hashToUpdate.length !== 64) {
                            setLogs(prev => [...prev, {
                              id: Date.now().toString(),
                              timestamp: new Date(),
                              level: 'error',
                              message: 'Invalid hash format. Must be 64 hex characters.'
                            }]);
                            return;
                          }

                          setUpdatingHash(toolInfo.key);
                          setLogs(prev => [...prev, {
                            id: Date.now().toString(),
                            timestamp: new Date(),
                            level: 'info',
                            message: `Updating hash for ${toolInfo.key}...`
                          }]);

                          try {
                            const result = await updateToolHash(toolInfo.key, hashToUpdate, passcode);
                            setLogs(prev => [...prev, {
                              id: (Date.now() + 1).toString(),
                              timestamp: new Date(),
                              level: result.matches ? 'success' : 'warning',
                              message: result.matches 
                                ? `✓ Hash updated and matches file`
                                : `⚠ Hash updated but doesn't match current file`
                            }]);
                            setNewHash('');
                            await loadToolInfo(toolInfo.key);
                            await loadTools();
                          } catch (err) {
                            setLogs(prev => [...prev, {
                              id: (Date.now() + 1).toString(),
                              timestamp: new Date(),
                              level: 'error',
                              message: `Failed to update hash: ${err instanceof Error ? err.message : 'Unknown error'}`
                            }]);
                          } finally {
                            setUpdatingHash(null);
                          }
                        }}
                        disabled={updatingHash === toolInfo.key || (!newHash && !toolInfo.current_hash)}
                        className="flex-1"
                      >
                        {updatingHash === toolInfo.key ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Update Hash
                          </>
                        )}
                      </Button>

                      {toolInfo.current_hash && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setNewHash(toolInfo.current_hash || '');
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Use File Hash
                        </Button>
                      )}
                    </div>

                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>Note:</strong> Hash updates are stored in memory. To persist changes, 
                        update the hash in <code className="bg-basement-concrete px-1 rounded">python/app/trapdoor.py</code> 
                        and restart the Python API server.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="execute" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Execute Tool</CardTitle>
                    <CardDescription>
                      Execute the tool with hash verification and real-time output
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Tool execution requires confirmation. Ensure you trust the tool and have verified its hash.
                      </AlertDescription>
                    </Alert>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="use-websocket"
                        checked={useWebSocket}
                        onChange={(e) => setUseWebSocket(e.target.checked)}
                        className="rounded border-panel"
                      />
                      <Label htmlFor="use-websocket" className="text-sm cursor-pointer">
                        Enable real-time output (WebSocket)
                      </Label>
                    </div>

                    <Button
                      onClick={() => handleExecute(toolInfo.key)}
                      disabled={executing === toolInfo.key || !toolInfo.exists}
                      variant="destructive"
                      className="w-full"
                    >
                      {executing === toolInfo.key ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Execute Tool
                        </>
                      )}
                    </Button>

                    {executing === toolInfo.key && useWebSocket && toolOutput.length > 0 && (
                      <div className="mt-4">
                        <Label className="text-xs text-ink-muted mb-2 block">
                          Real-time Output
                        </Label>
                        <div className="h-64 rounded-lg border border-panel overflow-hidden bg-basement-concrete">
                          <TerminalLogStream
                            logs={toolOutput}
                            maxLines={1000}
                            autoScroll={true}
                            className="h-full"
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Execution Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TerminalLogStream logs={logs} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-spray-magenta" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
