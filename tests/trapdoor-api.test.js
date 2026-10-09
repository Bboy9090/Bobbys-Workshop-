// Test suite for Trapdoor API
// Tests admin authentication, throttling, batch workflows, and monitoring

import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert';
import express from 'express';
import trapdoorRouter from '../core/api/trapdoor.js';

// Test server setup
let server;
let API_BASE;
const ADMIN_KEY = 'test-admin-key';

beforeAll(async () => {
  // Set test environment variables
  process.env.ADMIN_API_KEY = ADMIN_KEY;
process.env.PANDORA_ROOM_PASSWORD = ADMIN_KEY;
  process.env.SECRET_ROOM_PASSCODE = ADMIN_KEY;
  process.env.TRAPDOOR_PASSCODE = ADMIN_KEY;
  process.env.SHADOW_LOG_KEY = 'deadbeef'.repeat(8); // 32 bytes for AES-256
  
  // Create test server
  const app = express();
  app.use(express.json());
  app.use('/api/trapdoor', trapdoorRouter);
  
  // Start server on random available port
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      API_BASE = `http://localhost:${port}/api/trapdoor`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('Trapdoor API Tests', () => {

  describe('Authentication', () => {
    it('should reject requests without password', async () => {
      const response = await fetch(`${API_BASE}/workflows`);
      assert.strictEqual(response.status, 403);  // 403 Forbidden for missing auth
      const data = await response.json();
      assert.strictEqual(data.error, 'Unauthorized');
    });

    it('should reject requests with invalid password', async () => {
      const response = await fetch(`${API_BASE}/workflows`, {
        headers: { 'x-api-key': 'invalid-password' }
      });
      assert.strictEqual(response.status, 403);
    });

    it('should accept requests with valid password', async () => {
      const response = await fetch(`${API_BASE}/workflows`, {
        headers: { 'x-api-key': ADMIN_KEY }
      });
      assert.ok(response.status === 200);
    });
  });

  describe('Workflow Execution', () => {
    it('should list available workflows', async () => {
      const response = await fetch(`${API_BASE}/workflows`, {
        headers: { 'x-api-key': ADMIN_KEY }
      });
      
      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok(data.success);
      assert.ok(Array.isArray(data.workflows));
    });

    it('should validate workflow parameters', async () => {
      const response = await fetch(`${API_BASE}/workflow/execute`, {
        method: 'POST',
        headers: {
          'x-api-key': ADMIN_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing required parameters
          category: 'android'
        })
      });

      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error);
    });
  });

  describe('Batch Workflows', () => {
    it('should reject empty batch', async () => {
      const response = await fetch(`${API_BASE}/batch/execute`, {
        method: 'POST',
        headers: {
          'x-api-key': ADMIN_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workflows: []
        })
      });

      assert.strictEqual(response.status, 400);
    });

    it('should enforce batch size limit', async () => {
      const workflows = Array(15).fill({
        category: 'android',
        workflowId: 'adb-diagnostics',
        deviceSerial: 'test-device'
      });

      const response = await fetch(`${API_BASE}/batch/execute`, {
        method: 'POST',
        headers: {
          'x-api-key': ADMIN_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ commands: workflows, deviceSerial: 'test-device' })
      });

      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.ok(data.error.includes('limit'));
    });
  });

  describe('Monitoring', () => {
    it('should reject the unsupported monitoring endpoint', async () => {
      const response = await fetch(`${API_BASE}/monitoring/stats`, {
        headers: { 'x-api-key': ADMIN_KEY }
      });

      assert.strictEqual(response.status, 404);
    });
  });

  describe('Shadow Logs', () => {
    it('should retrieve shadow logs', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${API_BASE}/logs/shadow?date=${today}`, {
        headers: { 'x-api-key': ADMIN_KEY }
      });

      // May not have logs yet, but should not error
      assert.ok(response.status === 200 || response.status === 404);
    });

    it('should reject the unsupported cleanup endpoint', async () => {
      const response = await fetch(`${API_BASE}/logs/cleanup`, {
        method: 'POST',
        headers: { 'x-api-key': ADMIN_KEY }
      });

      assert.strictEqual(response.status, 404);
    });
  });

  describe('Throttling', () => {
    it('enforces the actual trapdoor middleware limit', async () => {
      const { rateLimiter } = await import('../src-tauri/resources/server/middleware/rate-limiter.js');
      const middleware = rateLimiter('trapdoor');
      let allowed = 0, status, payload;
      const response = { status(code) { status = code; return this; }, json(body) { payload = body; } };
      for (let i = 0; i < 6; i++) middleware({ ip: 'rate-contract-test' }, response, () => allowed++);
      assert.strictEqual(allowed, 5);
      assert.strictEqual(status, 429);
      assert.strictEqual(payload.error.code, 'RATE_LIMIT_EXCEEDED');
      assert.strictEqual(payload.error.details.limit, 5);
    });
  });
});
