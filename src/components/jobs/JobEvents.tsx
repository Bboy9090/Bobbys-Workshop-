/**
 * JobEvents Component
 * 
 * Displays job audit events (execution log)
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useJobs, type JobEvent } from '@/hooks/use-jobs';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';

interface JobEventsProps {
  jobId: string | null;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function JobEvents({ jobId, autoRefresh = false, refreshInterval = 2000 }: JobEventsProps) {
  const { getJobEvents, loading } = useJobs();
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    if (!jobId) return;

    const loadedEvents = await getJobEvents(jobId);
    if (loadedEvents) {
      setEvents(loadedEvents);
      setError(null);
    } else {
      setError('Failed to load job events');
    }
  };

  useEffect(() => {
    if (jobId) {
      loadEvents();
    } else {
      setEvents([]);
    }
  }, [jobId]);

  useEffect(() => {
    if (!autoRefresh || !jobId) return;

    const interval = setInterval(loadEvents, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, jobId]);

  if (!jobId) {
    return (
      <Card className="bg-workbench-steel border border-panel">
        <CardContent className="p-6 text-center text-ink-muted">
          <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No job selected</p>
        </CardContent>
      </Card>
    );
  }

  if (loading && events.length === 0) {
    return <LoadingState message="Loading job events..." />;
  }

  if (error) {
    return <ErrorState title="Failed to load events" message={error} />;
  }

  return (
    <Card className="bg-workbench-steel border border-panel">
      <CardHeader>
        <CardTitle className="text-ink-primary flex items-center">
          <Activity className="w-4 h-4 mr-2" />
          Audit Events
        </CardTitle>
        <CardDescription className="text-ink-muted">
          Execution log for job {jobId}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-ink-muted">
            <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No events yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {events.map((event, index) => {
                const isSuccess = event.exitCode === 0;
                const hasPolicyGates = event.policyGates && event.policyGates.length > 0;
                const allGatesPassed = event.policyGates?.every((gate) => gate.passed) ?? true;

                return (
                  <div
                    key={index}
                    className={`border rounded p-3 ${
                      isSuccess
                        ? 'bg-midnight-room border-panel'
                        : 'bg-state-danger/10 border-state-danger/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isSuccess ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-state-danger" />
                        )}
                        <span className="font-semibold text-ink-primary text-sm">{event.actionId}</span>
                      </div>
                      <span className="text-xs text-ink-muted">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {event.action && (
                      <p className="text-xs text-ink-muted mb-2">{event.action}</p>
                    )}

                    {hasPolicyGates && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {event.policyGates!.map((gate, gateIndex) => (
                          <Badge
                            key={gateIndex}
                            variant={gate.passed ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {gate.gateId}: {gate.passed ? 'PASS' : 'FAIL'}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {event.stdout && (
                      <div className="mt-2">
                        <pre className="text-xs text-ink-muted bg-midnight-room p-2 rounded overflow-auto max-h-32">
                          {typeof event.stdout === 'string'
                            ? event.stdout
                            : JSON.stringify(event.stdout, null, 2)}
                        </pre>
                      </div>
                    )}

                    {event.stderr && (
                      <div className="mt-2">
                        <pre className="text-xs text-state-danger bg-state-danger/10 p-2 rounded overflow-auto max-h-32">
                          {typeof event.stderr === 'string'
                            ? event.stderr
                            : JSON.stringify(event.stderr, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-ink-muted">Exit Code: {event.exitCode}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
