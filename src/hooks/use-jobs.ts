/**
 * useJobs Hook
 * 
 * React hook for managing workflow jobs
 * Uses the jobs API endpoints
 */

import { useState, useCallback, useEffect } from 'react';
import { useApiClient } from './use-api-client';
import type { ApiResponse } from '@/lib/api-envelope';

export interface Job {
  id: string;
  caseId: string;
  workflowId: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  parameters?: Record<string, any>;
  result?: JobResult;
  error?: string;
}

export interface JobResult {
  success: boolean;
  workflowId: string;
  steps?: JobStepResult[];
  error?: string;
  policyResult?: any;
}

export interface JobStepResult {
  actionId: string;
  success: boolean;
  tool?: string;
  capabilityId?: string;
  result?: any;
  error?: string;
}

export interface JobEvent {
  actionId: string;
  action: string;
  args?: Record<string, any>;
  stdout?: string;
  stderr?: string;
  policyGates?: Array<{
    gateId: string;
    passed: boolean;
    message?: string;
  }>;
  exitCode: number;
  timestamp: string;
}

export function useJobs() {
  const { get } = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get a job by ID
   */
  const getJob = useCallback(async (jobId: string): Promise<Job | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await get<{ job: Job }>(`/api/v1/jobs/${jobId}`);

      if (!response.ok || 'error' in response) {
        const errorMessage = 'error' in response ? response.error.message : 'Failed to get job';
        setError(errorMessage);
        return null;
      }

      return response.data.job;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get job';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [get]);

  /**
   * Get job events (audit log)
   */
  const getJobEvents = useCallback(async (jobId: string): Promise<JobEvent[] | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await get<{ jobId: string; events: JobEvent[] }>(`/api/v1/jobs/${jobId}/events`);

      if (!response.ok || 'error' in response) {
        const errorMessage = 'error' in response ? response.error.message : 'Failed to get job events';
        setError(errorMessage);
        return null;
      }

      return response.data.events || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get job events';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [get]);

  return {
    loading,
    error,
    getJob,
    getJobEvents,
  };
}

/**
 * Hook to poll a job until it completes
 */
export function useJobPolling(jobId: string | null, pollInterval: number = 2000) {
  const { getJob } = useJobs();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    let intervalId: NodeJS.Timeout | null = null;

    const poll = async () => {
      setLoading(true);
      setError(null);

      try {
        const currentJob = await getJob(jobId);
        if (currentJob) {
          setJob(currentJob);

          // Stop polling if job is completed or failed
          if (currentJob.status === 'completed' || currentJob.status === 'failed') {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to poll job';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    // Initial poll
    poll();

    // Set up polling interval
    if (!job || (job.status !== 'completed' && job.status !== 'failed')) {
      intervalId = setInterval(poll, pollInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId, pollInterval, getJob]);

  return {
    job,
    loading,
    error,
  };
}
