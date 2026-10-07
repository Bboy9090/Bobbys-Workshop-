import { describe, it, expect } from 'vitest';
import { acquireDeviceLock, releaseDeviceLock } from '../src-tauri/resources/server/locks.js';
const base = process.env.API_BASE_URL || 'http://127.0.0.1:3001';
const get = async p => { const response = await fetch(base + p); return { response, data: await response.json() }; };

describe('Packaged server smoke contracts', () => {
  it('health uses the current envelope', async () => {
    const { response, data } = await get('/api/v1/health');
    expect(response.status).toBe(200); expect(data.ok).toBe(true); expect(data.meta.apiVersion).toBe('v1');
  });
  it('readiness provides current feature flags', async () => {
    const { response, data } = await get('/api/v1/ready');
    expect(response.status).toBe(200); expect(data.data).toHaveProperty('featureFlags');
  });
  it('catalog loads actual packaged manifests', async () => {
    const { response, data } = await get('/api/catalog');
    expect(response.status).toBe(200); expect(data.ok).toBe(true); expect(data.data.data.details.tools.length).toBeGreaterThan(0);
  });
  for (const [name, route, body] of [
    ['unlock missing confirmation', 'unlock', { serial: 'test-only-no-device' }],
    ['unlock missing serial', 'unlock', { confirmation: 'UNLOCK' }],
    ['erase missing confirmation', 'erase', { serial: 'test-only-no-device', partition: 'cache' }],
  ]) it(name + ' fails closed', async () => {
    const response = await fetch(base + '/api/v1/fastboot/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    expect([400, 503]).toContain(response.status); expect(data.ok).toBe(false);
    expect(['VALIDATION_ERROR', 'TOOL_NOT_AVAILABLE']).toContain(data.error.code);
  });
  it('actual lock manager denies a second owner and releases deterministically', () => {
    const serial = 'contract-lock-test';
    const first = acquireDeviceLock(serial, 'first');
    try { expect(first.acquired).toBe(true); expect(acquireDeviceLock(serial, 'second').reason).toBe('DEVICE_LOCKED'); }
    finally { releaseDeviceLock(serial, first.lockId); }
    const next = acquireDeviceLock(serial, 'third');
    try { expect(next.acquired).toBe(true); } finally { releaseDeviceLock(serial, next.lockId); }
  });
  for (const [route, method] of [['monitor/live', 'GET'], ['tests/run', 'POST']]) it(route + ' declares unavailable truthfully', async () => {
    const response = await fetch(base + '/api/v1/' + route, { method });
    const data = await response.json();
    expect(response.status).toBe(503); expect(data.ok).toBe(false); expect(data.error.code).toBe('NOT_IMPLEMENTED');
  });
});
