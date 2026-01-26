/**
 * useCases Hook
 * 
 * React hook for managing cases (device repair/service cases)
 * Uses the cases API endpoints
 */

import { useState, useCallback } from 'react';
import { useApiClient } from './use-api-client';
import type { ApiResponse } from '@/lib/api-envelope';

export interface Case {
  id: string;
  title: string;
  notes?: string;
  userId: string;
  status: 'open' | 'closed' | 'pending';
  createdAt: string;
  updatedAt: string;
  devicePassport?: DevicePassport;
  ownershipVerification?: OwnershipVerification;
}

export interface DevicePassport {
  platform: 'android' | 'ios' | 'unknown';
  connectionState: 'adb' | 'fastboot' | 'usb' | 'dfu' | 'recovery' | 'none';
  deviceInfo?: Record<string, any>;
  timestamp: string;
}

export interface OwnershipVerification {
  caseId: string;
  checkboxConfirmed: boolean;
  typedPhrase: string;
  proofOfPurchase?: Record<string, any>;
  verifiedAt: string;
}

export interface CreateCaseRequest {
  title: string;
  notes?: string;
  userId?: string;
}

export interface DeviceIntakeRequest {
  platform: 'android' | 'ios' | 'unknown';
  connectionState: 'adb' | 'fastboot' | 'usb' | 'dfu' | 'recovery' | 'none';
  deviceInfo?: Record<string, any>;
}

export interface OwnershipVerificationRequest {
  checkboxConfirmed: boolean;
  typedPhrase: string;
  proofOfPurchase?: Record<string, any>;
}

export function useCases() {
  const { get, post } = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Create a new case
   */
  const createCase = useCallback(async (request: CreateCaseRequest): Promise<Case | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await post<{ case: Case }>('/api/v1/cases', {
        title: request.title,
        notes: request.notes,
        userId: request.userId || 'anonymous'
      });

      if (!response.ok || 'error' in response) {
        const errorMessage = 'error' in response ? response.error.message : 'Failed to create case';
        setError(errorMessage);
        return null;
      }

      return response.data.case;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create case';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [post]);

  /**
   * Get a case by ID
   */
  const getCase = useCallback(async (caseId: string): Promise<Case | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await get<{ case: Case }>(`/api/v1/cases/${caseId}`);

      if (!response.ok || 'error' in response) {
        const errorMessage = 'error' in response ? response.error.message : 'Failed to get case';
        setError(errorMessage);
        return null;
      }

      return response.data.case;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get case';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [get]);

  /**
   * Create device intake (device passport)
   */
  const createDeviceIntake = useCallback(async (
    caseId: string,
    request: DeviceIntakeRequest
  ): Promise<DevicePassport | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await post<{ devicePassport: DevicePassport }>(
        `/api/v1/cases/${caseId}/intake`,
        request
      );

      if (!response.ok || 'error' in response) {
        const errorMessage = 'error' in response ? response.error.message : 'Failed to create device intake';
        setError(errorMessage);
        return null;
      }

      return response.data.devicePassport;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create device intake';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [post]);

  /**
   * Verify ownership
   */
  const verifyOwnership = useCallback(async (
    caseId: string,
    request: OwnershipVerificationRequest
  ): Promise<OwnershipVerification | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await post<{ ownershipVerification: OwnershipVerification }>(
        `/api/v1/cases/${caseId}/ownership`,
        request
      );

      if (!response.ok || 'error' in response) {
        const errorMessage = 'error' in response ? response.error.message : 'Failed to verify ownership';
        setError(errorMessage);
        return null;
      }

      return response.data.ownershipVerification;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify ownership';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [post]);

  /**
   * Get case audit log
   */
  const getCaseAudit = useCallback(async (caseId: string): Promise<any[] | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await get<{ events: any[] }>(`/api/v1/cases/${caseId}/audit`);

      if (!response.ok || 'error' in response) {
        const errorMessage = 'error' in response ? response.error.message : 'Failed to get audit log';
        setError(errorMessage);
        return null;
      }

      return response.data.events || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get audit log';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [get]);

  return {
    loading,
    error,
    createCase,
    getCase,
    createDeviceIntake,
    verifyOwnership,
    getCaseAudit,
  };
}
