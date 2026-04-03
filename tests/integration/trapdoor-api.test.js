// Integration tests for Trapdoor API
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN_KEY = 'test-admin-key';
process.env.PANDORA_ROOM_PASSWORD = ADMIN_KEY;
process.env.SECRET_ROOM_PASSCODE = ADMIN_KEY;
process.env.TRAPDOOR_PASSCODE = ADMIN_KEY;

// Shared arrays to assert side effects
const shadowEntries = [];
const workflowExecutions = [];

vi.mock('../../core/tasks/workflow-engine.js', () => {
  class WorkflowEngineMock {
    async executeWorkflow(category, workflowId, payload) {
      workflowExecutions.push({ category, workflowId, payload });
      return {
        success: true,
        workflow: workflowId,
        results: [
          { stepId: 'step-1', success: true, output: 'ok' }
        ]
      };
    }

    async listWorkflows() {
      return {
        success: true,
        workflows: [
          { id: 'frp-bypass', name: 'FRP Bypass', category: 'bypass' },
          { id: 'fastboot-unlock', name: 'Bootloader Unlock', category: 'android' }
        ]
      };
    }
  }

  return { default: WorkflowEngineMock };
});

vi.mock('../../core/lib/shadow-logger.js', () => {
  class ShadowLoggerMock {
    async logShadow(entry) {
      shadowEntries.push({ ...entry, logType: 'shadow' });
      return { success: true };
    }

    async logPublic(entry) {
      shadowEntries.push({ ...entry, logType: 'public' });
      return { success: true };
    }

    async readShadowLogs() {
      return {
        success: true,
        date: 'today',
        entries: [...shadowEntries],
        count: shadowEntries.length
      };
    }
  }

  return { default: ShadowLoggerMock };
});

import trapdoorRouter from '../../core/api/trapdoor.js';

describe('Trapdoor API Integration', () => {
  let app;

  beforeEach(() => {
    shadowEntries.length = 0;
    workflowExecutions.length = 0;

    app = express();
    app.use(express.json());
    app.use('/api/trapdoor', trapdoorRouter);
  });

  it('rejects requests without API key', async () => {
    const res = await request(app)
      .post('/api/trapdoor/frp')
      .send({
        deviceSerial: 'demo-serial',
        authorization: { confirmed: true, userInput: 'I OWN THIS DEVICE' }
      });

    expect(res.status).toBe(403);  // 403 Forbidden for unauthorized access
    expect(res.body.error).toBe('Unauthorized');
  });

  it('executes FRP bypass workflow when authorized', async () => {
    const res = await request(app)
      .post('/api/trapdoor/frp')
      .set('X-Secret-Room-Passcode', ADMIN_KEY)
      .send({
        deviceSerial: 'demo-serial',
        authorization: { confirmed: true, userInput: 'I OWN THIS DEVICE' }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results?.length).toBeGreaterThan(0);
    expect(shadowEntries.find(entry => entry.operation === 'frp_bypass_completed')).toBeTruthy();
    expect(workflowExecutions[0]).toMatchObject({
      category: 'bypass',
      workflowId: 'frp-bypass'
    });
  });

  it('executes bootloader unlock workflow when authorized', async () => {
    const res = await request(app)
      .post('/api/trapdoor/unlock')
      .set('X-Secret-Room-Passcode', ADMIN_KEY)
      .send({
        deviceSerial: 'fastboot-123',
        authorization: { confirmed: true, userInput: 'UNLOCK' }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results?.length).toBeGreaterThan(0);
    expect(workflowExecutions[0]).toMatchObject({
      category: 'android',
      workflowId: 'fastboot-unlock'
    });
  });

  it('lists available workflows for admins', async () => {
    const res = await request(app)
      .get('/api/trapdoor/workflows')
      .set('X-Secret-Room-Passcode', ADMIN_KEY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.workflows)).toBe(true);
    expect(res.body.workflows.length).toBeGreaterThan(0);
  });

  it('retrieves shadow logs after operations', async () => {
    await request(app)
      .post('/api/trapdoor/frp')
      .set('X-Secret-Room-Passcode', ADMIN_KEY)
      .send({ deviceSerial: 'demo-serial', authorization: { confirmed: true, userInput: 'I OWN THIS DEVICE' } });

    const res = await request(app)
      .get('/api/trapdoor/logs/shadow')
      .set('X-Secret-Room-Passcode', ADMIN_KEY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.entries.length).toBeGreaterThan(0);
  });
});
