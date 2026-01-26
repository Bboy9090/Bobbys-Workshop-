/**
 * useWorkflows Hook
 * 
 * React hook for managing workflows
 * Uses the workflows API endpoints
 */

import { useState, useCallback, useEffect } from 'react';
import { useApiClient } from './use-api-client';
import type { ApiResponse } from '@/lib/api-envelope';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  required_gates?: string[];
  steps?: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  actions?: WorkflowAction[];
}

export interface WorkflowAction {
  id: string;
  action_id?: string;
  tool?: string;
  args?: string[];
  inputs?: string[];
  outputs?: string[];
}

export interface RunWorkflowRequest {
  userId?: string;
  parameters?: Record<string, any>;
  ownershipAttestation?: boolean;
  deviceAuthorization?: boolean;
  destructiveConfirm?: string;
}

export interface RunWorkflowResponse {
  job: {
    id: string;
    caseId: string;
    workflowId: string;
    userId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    createdAt: string;
    updatedAt: string;
    parameters?: Record<string, any>;
  };
  message: string;
}

/**
 * Fetches the list of available workflows from the server.
 *
 * Throws an Error if the HTTP request fails or the API payload indicates failure.
 *
 * @returns The array of Workflow objects returned by the API, or an empty array if none are present.
 * @throws Error when the network response is not ok or the API payload contains an error message.
 */
export async function loadWorkflows(): Promise<Workflow[]> {
  const response = await fetch('/api/v1/workflows');
  if (!response.ok) {
    throw new Error('Failed to load workflows');
  }
  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(payload.error?.message || 'Failed to load workflows');
  }
  return payload.data.workflows || [];
}

/**
 * Fetches available workflows from the API and stores them in the hook state.
 *
 * @returns The loaded array of `Workflow` objects; returns an empty array on failure.
 */

/**
 * Executes a workflow for a given case and updates hook error/loading state.
 *
 * @param caseId - The identifier of the case to run the workflow against.
 * @param workflowId - The identifier of the workflow to execute.
 * @param request - Execution options (e.g., `userId`, `parameters`, `ownershipAttestation`, `deviceAuthorization`, `destructiveConfirm`).
 * @returns The `RunWorkflowResponse` on success, or `null` if the run failed.
 */
export function useWorkflows() {
  const { get, post } = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  /**
   * Load available workflows
   */
  const loadWorkflows = useCallback(async (): Promise<Workflow[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await get<{ workflows: Workflow[] }>('/api/v1/workflows');

      if (!response.ok || 'error' in response) {
        const errorMessage = 'error' in response ? response.error.message : 'Failed to load workflows';
        setError(errorMessage);
        return [];
      }

      setWorkflows(response.data.workflows || []);
      return response.data.workflows || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load workflows';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [get]);

  /**
   * Run a workflow for a case
   */
  const runWorkflow = useCallback(async (
    caseId: string,
    workflowId: string,
    request: RunWorkflowRequest
  ): Promise<RunWorkflowResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await post<RunWorkflowResponse>(
        `/api/v1/cases/${caseId}/workflows/${workflowId}/run`,
        {
          userId: request.userId || 'anonymous',
          parameters: request.parameters || {},
          ownershipAttestation: request.ownershipAttestation,
          deviceAuthorization: request.deviceAuthorization,
          destructiveConfirm: request.destructiveConfirm,
        }
      );

      if (!response.ok || 'error' in response) {
        const errorMessage = 'error' in response ? response.error.message : 'Failed to run workflow';
        setError(errorMessage);
        return null;
      }

      return response.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run workflow';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [post]);

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  return {
    loading,
    error,
    workflows,
    loadWorkflows,
    runWorkflow,
  };
}