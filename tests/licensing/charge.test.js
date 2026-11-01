import { describe, expect, it, vi } from 'vitest';
import { chargeDiagnostic, chargeDiagnosticFromPool, connectionIsUnusable, InsufficientCreditsError } from '../../server/licensing/charge.js';
import { licenseKeyLookup } from '../../server/licensing/lookup.js';

const REQUEST = { userId: 'user-1', deviceSerial: 'R58T1234ABC', clientIp: '203.0.113.9', creditCost: 2 };
const PEPPER = 'p'.repeat(40);

// Fake pg client. `script` maps a SQL prefix to a result or an error to throw.
function fakeClient(script = {}) {
  const sent = [];
  const client = {
    sent,
    query: vi.fn(async (sql) => {
      sent.push(sql.trim().split(/\s+/).slice(0, 2).join(' '));
      for (const [prefix, outcome] of Object.entries(script)) {
        if (sql.trim().startsWith(prefix)) {
          if (typeof outcome === 'function') return outcome();
          if (outcome instanceof Error) throw outcome;
          return outcome;
        }
      }
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  return client;
}

const HAPPY = {
  'SELECT available_credits': { rows: [{ available_credits: 5 }] },
};

describe('chargeDiagnostic', () => {
  it('commits the deduction, ledger entry, and audit row together', async () => {
    const client = fakeClient(HAPPY);
    await expect(chargeDiagnostic(client, REQUEST)).resolves.toBe(true);
    expect(client.sent).toEqual([
      'BEGIN',
      'SELECT available_credits',
      'UPDATE users',
      'INSERT INTO',
      'INSERT INTO',
      'COMMIT',
    ]);
  });

  it('returns false and rolls back when balance is insufficient', async () => {
    const client = fakeClient({ 'SELECT available_credits': { rows: [{ available_credits: 1 }] } });
    await expect(chargeDiagnostic(client, REQUEST)).resolves.toBe(false);
    expect(client.sent.at(-1)).toBe('ROLLBACK');
    expect(client.sent).not.toContain('UPDATE users');
  });

  it('rethrows the original error after a clean rollback', async () => {
    const original = new Error('audit insert failed');
    const client = fakeClient({
      ...HAPPY,
      'INSERT INTO service_audit_log': original,
    });
    const thrown = await chargeDiagnostic(client, REQUEST).catch((e) => e);
    expect(thrown).toBe(original);
    expect(client.sent).toContain('ROLLBACK');
    expect(connectionIsUnusable(thrown)).toBe(false);
  });

  it('keeps the original error when ROLLBACK itself fails, and marks the connection unusable', async () => {
    const original = new Error('deadlock detected');
    const client = fakeClient({
      ...HAPPY,
      'UPDATE users': original,
      ROLLBACK: new Error('connection reset'),
    });
    const thrown = await chargeDiagnostic(client, REQUEST).catch((e) => e);
    expect(thrown).toBe(original);
    expect(thrown.message).toBe('deadlock detected');
    expect(connectionIsUnusable(thrown)).toBe(true);
  });

  it('reports a rollback failure on an insufficient-credits path as an error, not false', async () => {
    const client = fakeClient({
      'SELECT available_credits': { rows: [{ available_credits: 0 }] },
      ROLLBACK: new Error('connection reset'),
    });
    const thrown = await chargeDiagnostic(client, REQUEST).catch((e) => e);
    expect(thrown).toBeInstanceOf(InsufficientCreditsError);
    expect(connectionIsUnusable(thrown)).toBe(true);
  });

  it('fails closed for an unknown user without writing anything', async () => {
    const client = fakeClient({ 'SELECT available_credits': { rows: [] } });
    await expect(chargeDiagnostic(client, REQUEST)).rejects.toThrow('user record not found');
    expect(client.sent).toContain('ROLLBACK');
    expect(client.sent).not.toContain('UPDATE users');
  });

  it('rejects invalid requests before opening a transaction', async () => {
    for (const bad of [
      { ...REQUEST, creditCost: 0 },
      { ...REQUEST, creditCost: 1.5 },
      { ...REQUEST, creditCost: 5000 },
      { ...REQUEST, userId: '' },
      { ...REQUEST, clientIp: 'x'.repeat(46) },
      undefined,
    ]) {
      const client = fakeClient(HAPPY);
      await expect(chargeDiagnostic(client, bad)).rejects.toThrow(TypeError);
      expect(client.query).not.toHaveBeenCalled();
    }
  });
});

describe('chargeDiagnosticFromPool', () => {
  const poolWith = (client) => ({ connect: vi.fn(async () => client) });

  it('releases a healthy connection to the pool without an error', async () => {
    const client = fakeClient(HAPPY);
    await chargeDiagnosticFromPool(poolWith(client), REQUEST);
    expect(client.release).toHaveBeenCalledWith(undefined);
  });

  it('destroys a connection whose rollback failed, passing the original error to release', async () => {
    const original = new Error('deadlock detected');
    const client = fakeClient({ ...HAPPY, 'UPDATE users': original, ROLLBACK: new Error('reset') });
    await expect(chargeDiagnosticFromPool(poolWith(client), REQUEST)).rejects.toBe(original);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release.mock.calls[0][0]).toBe(original);
  });

  it('returns a connection to the pool after an ordinary, rolled-back failure', async () => {
    const client = fakeClient({ ...HAPPY, 'UPDATE users': new Error('transient') });
    await expect(chargeDiagnosticFromPool(poolWith(client), REQUEST)).rejects.toThrow('transient');
    expect(client.release).toHaveBeenCalledWith(undefined);
  });
});

describe('licenseKeyLookup', () => {
  it('produces a 64-character keyed digest that depends on the pepper', () => {
    const a = licenseKeyLookup('LIC-AAAA-BBBB', PEPPER);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(licenseKeyLookup('LIC-AAAA-BBBB', PEPPER)).toBe(a);
    expect(licenseKeyLookup('LIC-AAAA-BBBB', 'q'.repeat(40))).not.toBe(a);
  });

  it('is not the bare SHA-256 of the key', async () => {
    const { createHash } = await import('node:crypto');
    const bare = createHash('sha256').update('LIC-AAAA-BBBB').digest('hex');
    expect(licenseKeyLookup('LIC-AAAA-BBBB', PEPPER)).not.toBe(bare);
  });

  it('refuses short peppers and empty keys', () => {
    expect(() => licenseKeyLookup('LIC', 'short')).toThrow(TypeError);
    expect(() => licenseKeyLookup('', PEPPER)).toThrow(TypeError);
  });
});
