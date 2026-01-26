/**
 * 🌌 Transcendent Legendary - API Hook
 * Enterprise desktop app integration with Autonomous AI, Neural Networks, Self-Evolution
 */

import { useState, useCallback } from 'react';
import { API_CONFIG, safeJsonFetch } from '@/lib/apiConfig';

async function fetchJson<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const { data, ok, status } = await safeJsonFetch<{ data?: T; error?: { message?: string } }>(endpoint, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) },
  });
  if (!ok) throw new Error((data?.error as any)?.message ?? (typeof data?.error === 'string' ? data.error : undefined) ?? `HTTP ${status}`);
  return (data as { data?: T })?.data ?? (data as T);
}

export interface AutonomousDecision {
  id: string;
  context: Record<string, unknown>;
  timestamp: string;
  confidence: number;
  action: string | null;
  reasoning: Array<{ type: string; issue: string; severity: string; recommendation?: string }>;
}

export interface AutonomousStatus {
  autonomousMode: boolean;
  decisionsCount: number;
  optimizationsCount: number;
  healingActionsCount: number;
}

export interface NeuralModel {
  id: string;
  type: string;
  layers: Array<{ type: string; size: number; activation?: string }>;
  accuracy: number;
  trainedAt: string;
  trainingEpochs: number;
  loss: number;
}

export interface EvolutionIndividual {
  id: string;
  genes: Record<string, number>;
  fitness: number;
  generation: number;
  createdAt: string;
}

export interface EvolutionStats {
  generations: number;
  populationSize: number;
  bestFitness: number;
  avgFitness: number;
}

export function useTranscendentApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const makeDecision = useCallback(
    async (context: { type?: string; context?: Record<string, unknown> }) => {
      setLoading(true);
      setError(null);
      try {
        return await fetchJson<AutonomousDecision>(
          '/api/v1/transcendent/autonomous/decision',
          { method: 'POST', body: JSON.stringify(context) }
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const selfHeal = useCallback(
    async (payload: { type?: string; service?: string }) => {
      setLoading(true);
      setError(null);
      try {
        return await fetchJson<{ id: string; type: string; action: string; timestamp: string }>(
          '/api/v1/transcendent/autonomous/heal',
          { method: 'POST', body: JSON.stringify(payload) }
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getAutonomousStatus = useCallback(async () => {
    setError(null);
    try {
      return await fetchJson<AutonomousStatus>(
        '/api/v1/transcendent/autonomous/status'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    }
  }, []);

  const setAutonomousMode = useCallback(async (enabled: boolean) => {
    setLoading(true);
    setError(null);
    try {
      return await fetchJson<{ autonomousMode: boolean; message: string }>(
        '/api/v1/transcendent/autonomous/mode',
        { method: 'PUT', body: JSON.stringify({ enabled }) }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const trainModel = useCallback(
    async (features: number[][], targets: number[][]) => {
      setLoading(true);
      setError(null);
      try {
        return await fetchJson<NeuralModel>(
          '/api/v1/transcendent/neural/train',
          { method: 'POST', body: JSON.stringify({ features, targets }) }
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const optimizeConfig = useCallback(
    async (currentConfig: Record<string, number>, metrics: Record<string, number>) => {
      setLoading(true);
      setError(null);
      try {
        return await fetchJson<{
          id: string;
          modelId: string;
          currentConfig: Record<string, number>;
          optimizedConfig: Record<string, number>;
          confidence: number;
          expectedImprovement: number;
          timestamp: string;
        }>('/api/v1/transcendent/neural/optimize', {
          method: 'POST',
          body: JSON.stringify({ currentConfig, metrics }),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getBestAction = useCallback(
    async (state: Record<string, unknown>, possibleActions: string[]) => {
      setLoading(true);
      setError(null);
      try {
        return await fetchJson<{ action: string; qValue: number }>(
          '/api/v1/transcendent/neural/best-action',
          { method: 'POST', body: JSON.stringify({ state, possibleActions }) }
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getModels = useCallback(async () => {
    setError(null);
    try {
      return await fetchJson<{ models: NeuralModel[]; count: number }>(
        '/api/v1/transcendent/neural/models'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    }
  }, []);

  const initializeEvolution = useCallback(async (size = 20) => {
    setLoading(true);
    setError(null);
    try {
      return await fetchJson<{ population: EvolutionIndividual[]; count: number }>(
        '/api/v1/transcendent/evolution/initialize',
        { method: 'POST', body: JSON.stringify({ size }) }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const evolve = useCallback(
    async (metrics: Record<string, number>) => {
      setLoading(true);
      setError(null);
      try {
        return await fetchJson<{
          generation: number;
          population: EvolutionIndividual[];
          bestFitness: number;
          avgFitness: number;
        }>('/api/v1/transcendent/evolution/evolve', {
          method: 'POST',
          body: JSON.stringify({ metrics }),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getBestConfig = useCallback(async () => {
    setError(null);
    try {
      return await fetchJson<EvolutionIndividual | null>(
        '/api/v1/transcendent/evolution/best'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    }
  }, []);

  const getEvolutionStats = useCallback(async () => {
    setError(null);
    try {
      return await fetchJson<EvolutionStats>(
        '/api/v1/transcendent/evolution/stats'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    }
  }, []);

  const resetEvolution = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      return await fetchJson<{ message: string }>(
        '/api/v1/transcendent/evolution/reset',
        { method: 'POST', body: JSON.stringify({}) }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    clearError,
    autonomous: {
      makeDecision,
      selfHeal,
      getStatus: getAutonomousStatus,
      setMode: setAutonomousMode,
    },
    neural: {
      train: trainModel,
      optimize: optimizeConfig,
      getBestAction,
      getModels,
    },
    evolution: {
      initialize: initializeEvolution,
      evolve,
      getBest: getBestConfig,
      getStats: getEvolutionStats,
      reset: resetEvolution,
    },
  };
}
