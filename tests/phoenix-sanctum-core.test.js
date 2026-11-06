/**
 * Phoenix Sanctum & Trapdoor Core Verification Suite (node:test)
 *
 * Verifies:
 * 1. ShadowLogger AES-256-GCM encryption, decryption, getShadowLogs, getAnalytics, getStats, and rotateLogs.
 * 2. PolicyEvaluator RBAC permission matrix across owner, admin, technician, and viewer roles + parameter validation.
 * 3. OperationLoader catalog resolution (`loadOperationSpec`, `listAllOperations`, `listOperationsForRole`).
 * 4. OperationEnvelope standardized inspect/execute/simulate/policy-deny/error envelopes and schema validation.
 * 5. Both `core/` and `src-tauri/resources/core/` parity.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ShadowLogger } from '../core/lib/shadow-logger.js';
import { ShadowLogger as ResourceShadowLogger } from '../src-tauri/resources/core/lib/shadow-logger.js';
import {
  evaluatePolicy,
  requiresConfirmation,
  validateParameters,
  ROLES,
  RISK_LEVELS
} from '../core/lib/policy-evaluator.js';
import {
  loadOperationSpec,
  listAllOperations,
  listOperationsForRole
} from '../core/catalog/operation-loader.js';
import {
  createInspectEnvelope,
  createExecuteEnvelope,
  createSimulateEnvelope,
  createPolicyDenyEnvelope,
  createErrorEnvelope,
  validateEnvelope,
  createAuditLogFromEnvelope
} from '../core/lib/operation-envelope.js';
import {
  executeHandler,
  simulateHandler,
  listOperationsHandler
} from '../src-tauri/resources/server/routes/v1/trapdoor/operations.js';
import {
  createSession,
  validateSession,
  revokeSession
} from '../src-tauri/resources/server/middleware/trapdoor-auth.js';

test('ShadowLogger encrypts, reads, computes real analytics, and rotates AES-256-GCM logs', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bobfw-shadow-test-'));
  const shadowDir = path.join(tmpDir, 'shadow');
  const publicDir = path.join(tmpDir, 'public');

  try {
    for (const LoggerClass of [ShadowLogger, ResourceShadowLogger]) {
      const logger = new LoggerClass({
        logsDir: shadowDir,
        publicLogsDir: publicDir,
        retentionDays: 30
      });

      const w1 = await logger.logShadow({
        operation: 'root_privilege_audit',
        deviceSerial: 'R58M999111',
        userId: 'operator-1',
        success: true,
        metadata: { executionTimeMs: 120, tier: 'adbd-root-shell' }
      });
      assert.equal(w1.success, true);
      assert.equal(w1.encrypted, true);

      const w2 = await logger.logShadow({
        operation: 'silicon_fuse_audit',
        deviceSerial: 'R58M999222',
        userId: 'operator-1',
        success: false,
        metadata: { executionTimeMs: 240 }
      });
      assert.equal(w2.success, true);

      const today = new Date().toISOString().split('T')[0];
      const readRes = await logger.readShadowLogs(today, 'operator-1');
      assert.equal(readRes.success, true);
      assert.ok(readRes.entries.length >= 2);

      const filtered = await logger.getShadowLogs({
        date: today,
        operation: 'root_privilege_audit',
        deviceSerial: 'R58M999111',
        limit: 10
      });
      assert.ok(filtered.length >= 1);
      assert.equal(filtered[0].deviceSerial, 'R58M999111');

      const analytics = await logger.getAnalytics({ startDate: today, endDate: today });
      assert.ok(analytics.totalOperations >= 2);
      assert.equal(analytics.devicesProcessed, 2);
      assert.ok(analytics.operationsByType.root_privilege_audit >= 1);
      assert.ok(analytics.operationsByType.silicon_fuse_audit >= 1);
      assert.ok(analytics.averageExecutionTime > 0);

      const stats = await logger.getStats();
      assert.equal(stats.success, true);
      assert.equal(stats.stats.encryptionAlgorithm, 'aes-256-gcm');
      assert.ok(stats.stats.shadowLogFiles >= 1);

      // Write an expired log file and verify rotateLogs cleans it up
      const expiredFile = path.join(shadowDir, 'shadow-2020-01-01.log');
      await fs.writeFile(expiredFile, 'expired\n', 'utf8');
      const rotated = await logger.rotateLogs();
      assert.equal(rotated.success, true);
      assert.ok(rotated.deletedCount >= 1);
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('PolicyEvaluator enforces RBAC role matrix, confirmation gates, and parameter validation', async () => {
  const factoryResetSpec = await loadOperationSpec('factory_reset');
  assert.ok(factoryResetSpec);

  // Viewer and Technician must be denied destructive factory_reset
  const viewerEval = evaluatePolicy(ROLES.VIEWER, factoryResetSpec);
  assert.equal(viewerEval.allowed, false);

  const techEval = evaluatePolicy(ROLES.TECHNICIAN, factoryResetSpec);
  assert.equal(techEval.allowed, false);

  // Admin and Owner are allowed, with confirmation required
  const adminEval = evaluatePolicy(ROLES.ADMIN, factoryResetSpec);
  assert.equal(adminEval.allowed, true);
  assert.equal(adminEval.requiresConfirmation, true);
  assert.equal(requiresConfirmation(ROLES.ADMIN, factoryResetSpec), true);

  const ownerEval = evaluatePolicy(ROLES.OWNER, factoryResetSpec);
  assert.equal(ownerEval.allowed, true);
  assert.equal(ownerEval.requiresConfirmation, true);

  // Parameter validation checks required fields and regex patterns
  const rebootSpec = await loadOperationSpec('reboot_device');
  assert.ok(rebootSpec);

  const missingSerial = validateParameters({ mode: 'recovery' }, rebootSpec);
  assert.equal(missingSerial.valid, false);
  assert.equal(missingSerial.errors[0].parameter, 'deviceSerial');

  const invalidPattern = validateParameters(
    { deviceSerial: 'R58M999111', mode: 'invalid_mode' },
    rebootSpec
  );
  assert.equal(invalidPattern.valid, false);

  const validParams = validateParameters(
    { deviceSerial: 'R58M999111', mode: 'bootloader' },
    rebootSpec
  );
  assert.equal(validParams.valid, true);
});

test('OperationLoader resolves catalog operations with hyphen/underscore normalization and role filtering', async () => {
  const specByUnderscore = await loadOperationSpec('device_info');
  const specByHyphen = await loadOperationSpec('device-info');
  assert.ok(specByUnderscore);
  assert.ok(specByHyphen);
  assert.equal(specByUnderscore.operation, 'device_info');
  assert.equal(specByHyphen.operation, 'device_info');

  const allOps = await listAllOperations();
  assert.ok(allOps.length >= 9);

  const viewerOps = await listOperationsForRole('viewer');
  const ownerOps = await listOperationsForRole('owner');
  assert.ok(ownerOps.length > viewerOps.length);
  assert.equal(
    viewerOps.some((op) => op.operation === 'factory_reset'),
    false
  );
  assert.equal(
    ownerOps.some((op) => op.operation === 'factory_reset'),
    true
  );
});

test('OperationEnvelope constructs schema-valid inspect, execute, simulate, policy-deny, and error envelopes', () => {
  const inspectEnv = createInspectEnvelope({
    operationId: 'device_info',
    available: true,
    details: { transport: 'adb' }
  });
  assert.equal(validateEnvelope(inspectEnv).valid, true);

  const execEnv = createExecuteEnvelope({
    operation: 'reboot_device',
    success: true,
    result: { mode: 'bootloader' }
  });
  assert.equal(validateEnvelope(execEnv).valid, true);

  const simEnv = createSimulateEnvelope({
    operation: 'factory_reset',
    wouldSucceed: true,
    simulation: { checks: ['adb_authorized'], requirements: ['confirmation'], warnings: ['wipes_userdata'] }
  });
  assert.equal(validateEnvelope(simEnv).valid, true);
  assert.equal(simEnv.data.dryRun, true);

  const denyEnv = createPolicyDenyEnvelope({
    operation: 'factory_reset',
    reason: 'Role viewer denied'
  });
  assert.equal(validateEnvelope(denyEnv).valid, true);
  assert.equal(denyEnv.operation.status, 'denied');

  const errEnv = createErrorEnvelope('flash_partition', 'DEVICE_NOT_FOUND', 'Target disconnected');
  assert.equal(validateEnvelope(errEnv).valid, true);
  assert.equal(errEnv.operation.status, 'failure');

  const auditRecord = createAuditLogFromEnvelope(execEnv, { role: 'owner' });
  assert.equal(auditRecord.operation, 'reboot_device');
  assert.equal(auditRecord.success, true);
  assert.equal(auditRecord.metadata.role, 'owner');
});

test('Trapdoor HTTP handlers (listOperationsHandler, simulateHandler, executeHandler) and session tokens work end-to-end', async () => {
  // 1. Session token lifecycle
  const session = createSession('workstation-test-client');
  assert.ok(session.token);
  assert.equal(validateSession(session.token).valid, true);
  assert.equal(revokeSession(session.token), true);
  assert.equal(validateSession(session.token).valid, false);

  // Helper mock response object (includes api-envelope helpers)
  function createMockRes() {
    return {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      sendEnvelope(data, status = 200) {
        this.statusCode = status;
        this.body = { ok: true, data };
        return this;
      },
      sendError(code, message, details = null, status = 400) {
        this.statusCode = status;
        this.body = { ok: false, error: { code, message, details } };
        return this;
      }
    };
  }

  // 2. listOperationsHandler as authenticated admin
  const listReq = {
    secretRoomAuth: { authenticated: true, clientId: 'test-admin' },
    ip: '127.0.0.1'
  };
  const listRes = createMockRes();
  await listOperationsHandler(listReq, listRes);
  assert.equal(listRes.statusCode, 200);
  const opsList = listRes.body?.data?.operations || listRes.body?.data?.result?.operations;
  assert.ok(Array.isArray(opsList));
  assert.ok(opsList.length >= 9);

  // 3. simulateHandler dry-run for reboot_device with valid parameters
  const simReq = {
    secretRoomAuth: { authenticated: true, clientId: 'test-admin' },
    ip: '127.0.0.1',
    body: {
      operation: 'reboot_device',
      params: { deviceSerial: 'R58M999111', mode: 'recovery' },
      correlationId: 'corr-sim-1'
    }
  };
  const simRes = createMockRes();
  await simulateHandler(simReq, simRes);
  assert.equal(simRes.statusCode, 200);
  assert.equal(simRes.body.envelope.type, 'simulate');
  assert.equal(simRes.body.data.wouldSucceed, true);
  assert.equal(simRes.body.data.dryRun, true);

  // 4. executeHandler policy denial when unauthenticated viewer requests factory_reset
  const denyReq = {
    secretRoomAuth: { authenticated: false },
    ip: '127.0.0.1',
    body: {
      operation: 'factory_reset',
      params: { deviceSerial: 'R58M999111' },
      correlationId: 'corr-deny-1'
    }
  };
  const denyRes = createMockRes();
  await executeHandler(denyReq, denyRes);
  assert.equal(denyRes.statusCode, 403);
  assert.equal(denyRes.body.envelope.type, 'policy-deny');
  assert.equal(denyRes.body.operation.status, 'denied');
});

