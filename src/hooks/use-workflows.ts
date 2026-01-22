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
 * Load workflows from manifest
 * This is a helper function that could load from workflows-v2.json
 * For now, we'll define the workflows inline or load from an API endpoint
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
