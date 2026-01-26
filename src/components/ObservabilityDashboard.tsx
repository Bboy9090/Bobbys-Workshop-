/**
 * Universal Legend Status - Observability Dashboard
 * Real-time metrics, tracing, and logging visualization
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  CheckCircle2,
  RefreshCw,
  Search,
  Download,
  Filter
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface MetricData {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

interface TraceData {
  traceId: string;
  spanId: string;
  operation: string;
  duration: number;
  status: string;
  timestamp: number;
}

export function ObservabilityDashboard() {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [traces, setTraces] = useState<TraceData[]>([]);
  const [activeTab, setActiveTab] = useState('metrics');
  const [loading, setLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/v1/observability/metrics?format=json');
      const data = await response.json();
      if (data.ok && data.data?.metrics) {
        // Transform metrics for display
        const transformed: MetricData[] = [];
        for (const [name, metric] of Object.entries(data.data.metrics)) {
          if (metric.values && Array.isArray(metric.values)) {
            for (const value of metric.values) {
              transformed.push({
                name,
                value: value.value || 0,
                labels: value.labels,
                timestamp: Date.now()
              });
            }
          }
        }
        setMetrics(transformed);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  // Fetch traces
  const fetchTraces = async () => {
    try {
      const response = await fetch('/api/v1/observability/traces/active');
      const data = await response.json();
      if (data.ok && data.data?.traces) {
        setTraces(data.data.traces.map((trace: any) => ({
          traceId: trace.traceId,
          spanId: trace.spanId,
          operation: trace.tags?.['operation.name'] || 'unknown',
          duration: trace.duration || 0,
          status: trace.status || 'unknown',
          timestamp: trace.startTime || Date.now()
        })));
      }
    } catch (error) {
      console.error('Failed to fetch traces:', error);
    }
  };

  // Auto-refresh
  useEffect(() => {
    fetchMetrics();
    fetchTraces();
    
    const interval = setInterval(() => {
      fetchMetrics();
      fetchTraces();
    }, 5000); // Refresh every 5 seconds
    
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // Chart data preparation
  const chartData = metrics
    .filter(m => m.name.includes('duration') || m.name.includes('requests'))
    .slice(-20)
    .map((m, i) => ({
      name: `T${i}`,
      value: m.value,
      timestamp: m.timestamp || Date.now()
    }));

  const filteredTraces = traces.filter(trace => 
    trace.operation.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trace.traceId.includes(searchQuery)
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Universal Legend Status - Observability Dashboard
              </CardTitle>
              <CardDescription>
                Real-time metrics, distributed tracing, and system monitoring
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchMetrics();
                fetchTraces();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="metrics">
                <TrendingUp className="w-4 h-4 mr-2" />
                Metrics
              </TabsTrigger>
              <TabsTrigger value="traces">
                <Clock className="w-4 h-4 mr-2" />
                Traces
              </TabsTrigger>
              <TabsTrigger value="health">
                <Activity className="w-4 h-4 mr-2" />
                Health
              </TabsTrigger>
            </TabsList>

            <TabsContent value="metrics" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">HTTP Requests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metrics
                        .filter(m => m.name === 'http_requests_total')
                        .reduce((sum, m) => sum + m.value, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">Total requests</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Active Operations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metrics
                        .filter(m => m.name === 'operations_active')
                        .reduce((sum, m) => sum + m.value, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">Currently active</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      {metrics
                        .filter(m => m.name === 'errors_total')
                        .reduce((sum, m) => sum + m.value, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">Total errors</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Request Duration (ms)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="value" stroke="#8884d8" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Metrics Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {Array.from(new Set(metrics.map(m => m.name))).map(name => (
                        <div key={name} className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm font-medium">{name}</span>
                          <Badge variant="secondary">
                            {metrics.filter(m => m.name === name).length} values
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="traces" className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search traces..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Active Traces</CardTitle>
                  <CardDescription>
                    {filteredTraces.length} trace(s) found
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {filteredTraces.map((trace) => (
                        <Card key={trace.traceId} className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={trace.status === 'success' ? 'default' : 'destructive'}>
                                  {trace.status}
                                </Badge>
                                <span className="text-sm font-mono text-muted-foreground">
                                  {trace.traceId.substring(0, 16)}...
                                </span>
                              </div>
                              <p className="text-sm font-medium">{trace.operation}</p>
                              <p className="text-xs text-muted-foreground">
                                Duration: {trace.duration}ms
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="health" className="space-y-4 mt-4">
              <HealthStatusPanel />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthStatusPanel() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/v1/reliability/health');
        const data = await response.json();
        if (data.ok) {
          setHealth(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch health:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading health status...</div>;
  }

  if (!health) {
    return <div className="text-center py-8 text-destructive">Failed to load health status</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {health.overall?.status === 'healthy' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            Overall Health: {health.overall?.status || 'unknown'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health.overall?.issues && health.overall.issues.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Issues:</p>
              <ul className="list-disc list-inside space-y-1">
                {health.overall.issues.map((issue: string, i: number) => (
                  <li key={i} className="text-sm text-muted-foreground">{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Circuit Breakers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {health.circuitBreakers?.circuitBreakers && Object.entries(health.circuitBreakers.circuitBreakers).map(([name, breaker]: [string, any]) => (
              <div key={name} className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm font-medium">{name}</span>
                <Badge variant={breaker.state === 'closed' ? 'default' : 'destructive'}>
                  {breaker.state}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recovery Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {health.recovery && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Attempts:</span>
                <span className="font-medium">{health.recovery.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Successful:</span>
                <span className="font-medium text-green-500">{health.recovery.successful}</span>
              </div>
              <div className="flex justify-between">
                <span>Failed:</span>
                <span className="font-medium text-red-500">{health.recovery.failed}</span>
              </div>
              <div className="flex justify-between">
                <span>Success Rate:</span>
                <span className="font-medium">{health.recovery.successRate?.toFixed(1)}%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
