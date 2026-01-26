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
  // TODO: Load from /api/v1/workflows endpoint or workflows-v2.json
  // For now, return empty array - workflows should be loaded from API
  return [];
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
      // TODO: Replace with actual API endpoint when available
      // For now, return empty array
      // const response = await get<{ workflows: Workflow[] }>('/api/v1/workflows');
      
      // Placeholder: Load from workflows-v2.json or define inline
      // This should be replaced with an API endpoint
      const workflows: Workflow[] = [
        {
          id: 'universal_device_scan_v1',
          name: 'Universal Device Scan',
          description: 'Scan for all connected devices (Android ADB, Fastboot, iOS)',
          tags: ['scan', 'detection'],
          required_gates: [],
          steps: []
        },
        {
          id: 'apple_access_recovery_v1',
          name: 'Orchard Gate — Apple Access & Recovery',
          description: 'Diagnostics + ownership verification + official Apple recovery hand-off. No bypass actions.',
          tags: ['ios', 'recovery', 'guidance'],
          required_gates: ['GATE_OWNERSHIP_ATTESTATION', 'GATE_NO_CIRCUMVENTION', 'GATE_TOOL_ALLOWLIST'],
          steps: []
        },
      ];

      setWorkflows(workflows);
      return workflows;
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
