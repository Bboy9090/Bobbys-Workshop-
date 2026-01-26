/**
 * BackendServicesPanel
 * 
 * Management panel for backend services (Python API, etc.)
 */

import React, { useState, useEffect } from 'react';
import { 
  Server, Play, Square, RefreshCw, AlertCircle, CheckCircle2, 
  Loader2, Settings, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface BackendService {
  id: string;
  name: string;
  description: string;
  defaultPort: number;
  url: string;
  status: 'unknown' | 'running' | 'stopped' | 'error';
  lastChecked?: Date;
}

const TRAPDOOR_API_URL = process.env.TRAPDOOR_API_URL || 'http://localhost:5001';

export function BackendServicesPanel() {
  const [services, setServices] = useState<BackendService[]>([
    {
      id: 'trapdoor-api',
      name: 'Trapdoor Tools API',
      description: 'Python Flask API for trapdoor tool management and hash verification',
      defaultPort: 5001,
      url: TRAPDOOR_API_URL,
      status: 'unknown',
    },
  ]);
  const [checking, setChecking] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Check service status on mount and periodically
  useEffect(() => {
    checkAllServices();
    const interval = setInterval(checkAllServices, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  async function checkServiceStatus(service: BackendService): Promise<'running' | 'stopped' | 'error'> {
    setChecking(prev => ({ ...prev, [service.id]: true }));
    
    try {
      const response = await fetch(`${service.url}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        return 'running';
      } else {
        return 'stopped';
      }
    } catch (err) {
      return 'error';
    } finally {
      setChecking(prev => ({ ...prev, [service.id]: false }));
    }
  }

  async function checkAllServices() {
    setError(null);
    const updatedServices = await Promise.all(
      services.map(async (service) => {
        const status = await checkServiceStatus(service);
        return {
          ...service,
          status,
          lastChecked: new Date(),
        };
      })
    );
    setServices(updatedServices);
  }

  function getStatusBadge(status: BackendService['status']) {
    switch (status) {
      case 'running':
        return (
          <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Running
          </Badge>
        );
      case 'stopped':
        return (
          <Badge variant="secondary" className="bg-gray-500/20 text-gray-500 border-gray-500/30">
            <Square className="w-3 h-3 mr-1" />
            Stopped
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Checking...
          </Badge>
        );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink-primary mb-2">Backend Services</h2>
        <p className="text-sm text-ink-muted">
          Manage Python backend services for trapdoor tools and other features
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {services.map((service) => (
          <Card key={service.id} className="bg-workbench-steel border-panel">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-spray-cyan" />
                  <div>
                    <CardTitle className="text-ink-primary">{service.name}</CardTitle>
                    <CardDescription className="text-ink-muted">
                      {service.description}
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(service.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-ink-muted">Service URL</Label>
                  <p className="text-sm font-mono text-ink-primary bg-basement-concrete p-2 rounded mt-1">
                    {service.url}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-ink-muted">Port</Label>
                  <p className="text-sm font-mono text-ink-primary bg-basement-concrete p-2 rounded mt-1">
                    {service.defaultPort}
                  </p>
                </div>
              </div>

              {service.lastChecked && (
                <div>
                  <Label className="text-xs text-ink-muted">Last Checked</Label>
                  <p className="text-xs text-ink-muted mt-1">
                    {service.lastChecked.toLocaleTimeString()}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-panel">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => checkServiceStatus(service).then(status => {
                    setServices(prev => prev.map(s => 
                      s.id === service.id 
                        ? { ...s, status, lastChecked: new Date() }
                        : s
                    ));
                  })}
                  disabled={checking[service.id]}
                >
                  {checking[service.id] ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Check Status
                    </>
                  )}
                </Button>

                {service.status === 'running' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(service.url, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open API
                  </Button>
                )}

                <div className="flex-1" />

                <Alert variant={service.status === 'running' ? 'default' : 'destructive'} className="py-2 px-3">
                  <AlertDescription className="text-xs">
                    {service.status === 'running' 
                      ? 'Service is running and responding'
                      : service.status === 'stopped'
                      ? 'Service is not responding. Start it manually or check if it\'s running.'
                      : 'Unable to connect to service. Check URL and port configuration.'}
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-basement-concrete border-panel">
        <CardHeader>
          <CardTitle className="text-sm text-ink-primary">How to Start Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-ink-muted">
          <p><strong>Trapdoor Tools API:</strong></p>
          <code className="block bg-workbench-steel p-2 rounded font-mono text-xs mt-1">
            cd python/app && python trapdoor_api.py
          </code>
          <p className="mt-3 text-xs">
            Or set <code className="bg-workbench-steel px-1 rounded">TRAPDOOR_API_PORT</code> environment variable for custom port.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
