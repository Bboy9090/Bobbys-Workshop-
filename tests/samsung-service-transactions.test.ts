import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const hook = readFileSync('src/hooks/useSamsungServiceTransactions.ts', 'utf8');
const panel = readFileSync('src/components/SamsungServiceTransactionsPanel.tsx', 'utf8');
const commandCenter = readFileSync('src/components/RepairCommandCenter.tsx', 'utf8');

describe('Samsung service transaction UI contract', () => {
  it('isolates backend telemetry by transactionId and rejects stale mid-stream events', () => {
    expect(hook).toContain("listen<SamsungServiceProgressEvent>('samsung-service-progress'");
    expect(hook).toContain("payload.stage !== 'validating'");
    expect(hook).toContain('if (previous?.terminal) return current');
    expect(hook).toContain('trackedIds.current.has(transactionId)');
    expect(hook).toContain('normalizePercent(payload.percent)');
  });

  it('renders multiple independent transaction cards and exposes terminal cleanup', () => {
    expect(panel).toContain('orderedTransactions.map');
    expect(panel).toContain('transaction.transactionId');
    expect(panel).toContain('Clear completed');
    expect(panel).toContain('activeCount');
    expect(panel).toContain('removeTransaction(transaction.transactionId)');
  });

  it('is mounted in the Samsung repair workflow without introducing a start/bypass command', () => {
    expect(commandCenter).toContain('SamsungServiceTransactionsPanel');
    expect(hook).not.toContain('execute_one_click_bypass');
    expect(hook).not.toContain('user_setup_complete');
    expect(hook).not.toContain('frp');
  });
});
