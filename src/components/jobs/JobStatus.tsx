/**
 * JobStatus Component
 * 
 * Displays job execution status
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useJobPolling } from '@/hooks/use-jobs';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import React from 'react';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';

interface JobStatusProps {
  jobId: string | null;
  onStatusChange?: (status: string) => void;
}

export function JobStatus({ jobId, onStatusChange }: JobStatusProps) {
  const { job, loading, error } = useJobPolling(jobId);

  // Notify parent of status changes
  React.useEffect(() => {
    if (job && onStatusChange) {
      onStatusChange(job.status);
    }
  }, [job?.status, onStatusChange]);

  if (!jobId) {
    return (
      <Card className="bg-workbench-steel border border-panel">
        <CardContent className="p-6 text-center text-ink-muted">
          <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No job selected</p>
        </CardContent>
      </Card>
    );
  }

  if (loading && !job) {
    return <LoadingState message="Loading job status..." />;
  }

  if (error) {
    return <ErrorState title="Failed to load job" message={error} />;
  }

  if (!job) {
    return <ErrorState title="Job not found" message={`Job ${jobId} not found`} />;
  }

  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'text-ink-muted',
      bg: 'bg-ink-muted/20',
      label: 'Pending',
    },
    running: {
      icon: Loader2,
      color: 'text-spray-cyan',
      bg: 'bg-spray-cyan/20',
      label: 'Running',
    },
    completed: {
      icon: CheckCircle2,
      color: 'text-green-500',
      bg: 'bg-green-500/20',
      label: 'Completed',
    },
    failed: {
      icon: XCircle,
      color: 'text-state-danger',
      bg: 'bg-state-danger/20',
      label: 'Failed',
    },
  };

  const config = statusConfig[job.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <Card className="bg-workbench-steel border border-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-ink-primary">Job Status</CardTitle>
          <Badge
            variant={
              job.status === 'completed'
                ? 'default'
                : job.status === 'failed'
                ? 'destructive'
                : 'outline'
            }
            className={`${config.bg} ${config.color}`}
          >
            {job.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {config.label}
          </Badge>
        </div>
        <CardDescription className="text-ink-muted">Job ID: {job.id}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-muted">Workflow:</span>
            <span className="text-ink-primary font-mono text-xs">{job.workflowId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Case:</span>
            <span className="text-ink-primary font-mono text-xs">{job.caseId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Created:</span>
            <span className="text-ink-primary">
              {new Date(job.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Updated:</span>
            <span className="text-ink-primary">
              {new Date(job.updatedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {job.error && (
          <div className="bg-state-danger/20 border border-state-danger/50 rounded p-3">
            <p className="text-sm font-semibold text-state-danger mb-1">Error</p>
            <p className="text-sm text-ink-muted">{job.error}</p>
          </div>
        )}

        {job.result && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink-primary">Result</p>
            <div className="bg-midnight-room border border-panel rounded p-3">
              <pre className="text-xs text-ink-muted overflow-auto">
                {JSON.stringify(job.result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
