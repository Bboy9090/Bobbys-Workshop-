/**
 * Cases API - Device case management
 * 
 * PRINCIPLE: All operations require ownership verification and audit logging
 */

import express from 'express';
import { randomUUID } from 'node:crypto';
import { getAuditLogger } from '../../utils/audit-logger.js';

const router = express.Router();

// In-memory case storage (replace with database in production)
const cases = new Map();

/**
 * POST /api/v1/cases
 * Create a new device case
 */
router.post('/', async (req, res) => {
  try {
    const caseId = randomUUID();
    const { title, notes, userId } = req.body;

    const newCase = {
      id: caseId,
      title: title || `Case ${caseId.substring(0, 8)}`,
      notes: notes || '',
      userId: userId || 'anonymous',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'open'
    };

    cases.set(caseId, newCase);

    // Log case creation
    const auditLogger = getAuditLogger();
    await auditLogger.logEvent({
      caseId,
      userId: newCase.userId,
      actionId: 'case.create',
      action: 'case_create',
      args: { title, notes },
      policyGates: [],
      exitCode: 0
    });

    res.sendEnvelope({
      case: newCase
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to create case', {
      error: error.message
    }, 500);
  }
});

/**
 * GET /api/v1/cases/:id
 * Get case details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = cases.get(id);

    if (!caseData) {
      return res.sendError('CASE_NOT_FOUND', 'Case not found', { caseId: id }, 404);
    }

    res.sendEnvelope({
      case: caseData
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to get case', {
      error: error.message,
      caseId: req.params.id
    }, 500);
  }
});

/**
 * POST /api/v1/cases/:id/intake
 * Device intake (read-only device information collection)
 */
router.post('/:id/intake', async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = cases.get(id);

    if (!caseData) {
      return res.sendError('CASE_NOT_FOUND', 'Case not found', { caseId: id }, 404);
    }

    const { platform, connectionState, deviceInfo } = req.body;

    // Create device passport (read-only)
    const devicePassport = {
      caseId: id,
      platform: platform || 'unknown',
      connectionState: connectionState || 'none',
      deviceInfo: deviceInfo || {},
      collectedAt: new Date().toISOString()
    };

    // Update case
    caseData.devicePassport = devicePassport;
    caseData.updatedAt = new Date().toISOString();
    cases.set(id, caseData);

    // Log device intake
    const auditLogger = getAuditLogger();
    await auditLogger.logEvent({
      caseId: id,
      userId: caseData.userId,
      actionId: 'device.intake',
      action: 'device_intake_readonly',
      args: { platform, connectionState },
      policyGates: [{ gateId: 'readonly', passed: true }],
      exitCode: 0
    });

    res.sendEnvelope({
      case: caseData,
      devicePassport
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to perform device intake', {
      error: error.message,
      caseId: req.params.id
    }, 500);
  }
});

/**
 * POST /api/v1/cases/:id/ownership
 * Ownership verification (proof collection)
 */
router.post('/:id/ownership', async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = cases.get(id);

    if (!caseData) {
      return res.sendError('CASE_NOT_FOUND', 'Case not found', { caseId: id }, 404);
    }

    const { 
      checkboxConfirmed, 
      typedPhrase, 
      proofOfPurchase 
    } = req.body;

    // Validate attestation
    if (!checkboxConfirmed) {
      return res.sendError('VALIDATION_ERROR', 'Checkbox confirmation required', {
        message: 'I own this device or have written permission to service it.'
      }, 400);
    }

    if (typedPhrase !== 'I CONFIRM AUTHORIZED SERVICE') {
      return res.sendError('VALIDATION_ERROR', 'Typed phrase must match exactly', {
        required: 'I CONFIRM AUTHORIZED SERVICE',
        provided: typedPhrase
      }, 400);
    }

    // Store ownership verification
    const ownershipVerification = {
      caseId: id,
      checkboxConfirmed,
      typedPhrase,
      proofOfPurchase: proofOfPurchase || {},
      verifiedAt: new Date().toISOString()
    };

    // Update case
    caseData.ownershipVerification = ownershipVerification;
    caseData.updatedAt = new Date().toISOString();
    cases.set(id, caseData);

    // Log ownership verification
    const auditLogger = getAuditLogger();
    await auditLogger.logEvent({
      caseId: id,
      userId: caseData.userId,
      actionId: 'ownership.verify',
      action: 'ownership_verification',
      args: { checkboxConfirmed, hasProof: !!proofOfPurchase },
      policyGates: [
        { gateId: 'ownership_attested', passed: true }
      ],
      confirmations: [
        { type: 'checkbox', provided: checkboxConfirmed },
        { type: 'typed_phrase', provided: !!typedPhrase }
      ],
      exitCode: 0
    });

    res.sendEnvelope({
      case: caseData,
      ownershipVerification
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to verify ownership', {
      error: error.message,
      caseId: req.params.id
    }, 500);
  }
});

/**
 * GET /api/v1/cases/:id/audit
 * Get audit log for a case
 */
router.get('/:id/audit', async (req, res) => {
  try {
    const { id } = req.params;
    const caseData = cases.get(id);

    if (!caseData) {
      return res.sendError('CASE_NOT_FOUND', 'Case not found', { caseId: id }, 404);
    }

    const auditLogger = getAuditLogger();
    const events = await auditLogger.getCaseEvents(id);
    const statistics = await auditLogger.getCaseStatistics(id);

    res.sendEnvelope({
      caseId: id,
      events,
      statistics
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to get audit log', {
      error: error.message,
      caseId: req.params.id
    }, 500);
  }
});

/**
 * POST /api/v1/cases/:id/workflows/:workflowId/run
 * Run a workflow for a case
 */
router.post('/:id/workflows/:workflowId/run', async (req, res) => {
  try {
    const { id: caseId, workflowId } = req.params;
    const { userId, parameters } = req.body;

    // Verify case exists
    const caseData = cases.get(caseId);
    if (!caseData) {
      return res.sendError('CASE_NOT_FOUND', 'Case not found', { caseId }, 404);
    }

    // Import jobs router functionality (avoid circular dependency)
    const { executeWorkflow } = await import('../../utils/workflow-executor.js');
    const { getAuditLogger } = await import('../../utils/audit-logger.js');
    const { randomUUID } = await import('node:crypto');
    
    // Get jobs Map (shared instance - in production, use database)
    const { jobs } = await import('./jobs.js');
    
    const jobId = randomUUID();
    const auditLogger = getAuditLogger();

    // Create job record
    const job = {
      id: jobId,
      caseId,
      workflowId,
      userId: userId || caseData.userId || 'anonymous',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parameters: parameters || {}
    };

    jobs.set(jobId, job);

    // Log job creation
    await auditLogger.logEvent({
      caseId,
      userId: job.userId,
      workflowId: jobId,
      actionId: 'workflow.run',
      action: 'workflow_execution_started',
      args: { workflowId, parameters },
      policyGates: [],
      exitCode: 0
    });

    // Execute workflow asynchronously
    job.status = 'running';
    job.updatedAt = new Date().toISOString();
    jobs.set(jobId, job);

    // Execute workflow in background
    executeWorkflow(workflowId, {
      caseId,
      userId: job.userId,
      jobId,
      parameters: job.parameters
    }).then(result => {
      job.status = result.success ? 'completed' : 'failed';
      job.result = result;
      job.updatedAt = new Date().toISOString();
      jobs.set(jobId, job);
    }).catch(error => {
      job.status = 'failed';
      job.error = error.message;
      job.updatedAt = new Date().toISOString();
      jobs.set(jobId, job);
    });

    res.sendEnvelope({
      job,
      message: 'Workflow execution started'
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to run workflow', {
      error: error.message
    }, 500);
  }
});

export default router;
