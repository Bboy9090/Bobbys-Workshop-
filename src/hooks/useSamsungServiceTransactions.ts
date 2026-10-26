import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

export type SamsungServiceStage =
  | 'idle'
  | 'validating'
  | 'staging'
  | 'waiting_usb'
  | 'verifying_adb'
  | 'applying_service_change'
  | 'committing_csc'
  | 'verifying'
  | 'complete'
  | 'failed';

export type SamsungServiceProgressEvent = {
  transactionId: string;
  stage: SamsungServiceStage;
  percent: number;
  detail: string;
};

export type SamsungServiceTransaction = SamsungServiceProgressEvent & {
  serial?: string;
  targetCsc?: string;
  startedAt: number;
  updatedAt: number;
  terminal: boolean;
};

export type SamsungServiceTransactionSeed = {
  transactionId: string;
  serial?: string;
  targetCsc?: string;
  detail?: string;
};

function isTerminal(stage: SamsungServiceStage): boolean {
  return stage === 'complete' || stage === 'failed';
}

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function useSamsungServiceTransactions() {
  const [transactions, setTransactions] = useState<Record<string, SamsungServiceTransaction>>({});
  const trackedIds = useRef(new Set<string>());

  const registerTransaction = useCallback((seed: SamsungServiceTransactionSeed) => {
    const transactionId = seed.transactionId.trim();
    if (!transactionId) return false;

    const now = Date.now();
    trackedIds.current.add(transactionId);
    setTransactions((current) => ({
      ...current,
      [transactionId]: {
        transactionId,
        serial: seed.serial?.trim() || undefined,
        targetCsc: seed.targetCsc?.trim().toUpperCase() || undefined,
        stage: 'idle',
        percent: 0,
        detail: seed.detail || 'Registered and waiting for backend telemetry.',
        startedAt: current[transactionId]?.startedAt ?? now,
        updatedAt: now,
        terminal: false,
      },
    }));
    return true;
  }, []);

  const removeTransaction = useCallback((transactionId: string) => {
    trackedIds.current.delete(transactionId);
    setTransactions((current) => {
      if (!(transactionId in current)) return current;
      const next = { ...current };
      delete next[transactionId];
      return next;
    });
  }, []);

  const clearTerminalTransactions = useCallback(() => {
    setTransactions((current) => {
      const next: Record<string, SamsungServiceTransaction> = {};
      trackedIds.current.clear();
      for (const [id, transaction] of Object.entries(current)) {
        if (!transaction.terminal) {
          next[id] = transaction;
          trackedIds.current.add(id);
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<SamsungServiceProgressEvent>('samsung-service-progress', (event) => {
      if (disposed) return;

      const payload = event.payload;
      const transactionId = payload.transactionId?.trim();
      if (!transactionId) return;

      const alreadyTracked = trackedIds.current.has(transactionId);

      // An unknown transaction may enter only at the backend's first validating milestone.
      // Mid-stream events for unknown IDs are ignored so stale events from prior runs cannot
      // attach themselves to a newer UI session.
      if (!alreadyTracked && payload.stage !== 'validating') return;

      if (!alreadyTracked) trackedIds.current.add(transactionId);

      setTransactions((current) => {
        const previous = current[transactionId];
        if (previous?.terminal) return current;

        const now = Date.now();
        return {
          ...current,
          [transactionId]: {
            transactionId,
            serial: previous?.serial,
            targetCsc: previous?.targetCsc,
            stage: payload.stage,
            percent: normalizePercent(payload.percent),
            detail: payload.detail,
            startedAt: previous?.startedAt ?? now,
            updatedAt: now,
            terminal: isTerminal(payload.stage),
          },
        };
      });
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const orderedTransactions = useMemo(
    () => Object.values(transactions).sort((a, b) => b.updatedAt - a.updatedAt),
    [transactions],
  );

  const activeCount = useMemo(
    () => orderedTransactions.filter((transaction) => !transaction.terminal).length,
    [orderedTransactions],
  );

  return {
    transactions,
    orderedTransactions,
    activeCount,
    registerTransaction,
    removeTransaction,
    clearTerminalTransactions,
  };
}
