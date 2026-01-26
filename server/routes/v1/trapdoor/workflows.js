/**
 * The Workflow Engine - Secret Room #6
 * 
 * Automated workflow execution:
 * - Custom workflow execution
 * - Conditional logic
 * - Parallel execution
 * - Error recovery
 * - Workflow templates
 * 
 * @module trapdoor-workflows
 */

import express from 'express';
import ShadowLogger from '../../../../core/lib/shadow-logger.js';
import { randomUUID } from 'node:crypto';
import { executeWorkflow, listWorkflows } from '../../../utils/workflow-executor.js';

const router = express.Router();
const shadowLogger = new ShadowLogger();

/**
 * POST /api/v1/trapdoor/workflows/execute
 * Execute a workflow (from trapdoor API)
 */
router.post('/execute', async (req, res) => {
  const { workflowId, devices, parameters } = req.body;

  if (!workflowId) {
    return res.sendError('VALIDATION_ERROR', 'Workflow ID is required', null, 400);
  }

  try {
    const jobId = randomUUID();

    // Log to shadow
    await shadowLogger.logShadow({
      operation: 'workflow_execute',
      deviceSerial: devices ? devices.join(',') : 'multiple',
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: false,
      metadata: {
        workflowId,
        jobId,
        deviceCount: devices ? devices.length : 0,
        parameters
      }
    });

    // Execute real workflow engine (manifest-driven, policy-gated)
    const result = await executeWorkflow(workflowId, {
      caseId: 'trapdoor',
      userId: req.ip,
      jobId,
      parameters: parameters || {},
      devices: devices || []
    });

    // Log success
    await shadowLogger.logShadow({
      operation: 'workflow_execute',
      deviceSerial: devices ? devices.join(',') : 'multiple',
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: !!result?.success,
      metadata: {
        workflowId,
        jobId,
        result
      }
    });

    res.sendEnvelope({
      success: !!result?.success,
      message: result?.success ? 'Workflow execution completed' : 'Workflow execution blocked or failed',
      jobId,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to execute workflow', {
      error: error.message,
      workflowId
    }, 500);
  }
});

/**
 * GET /api/v1/trapdoor/workflows/templates
 * Get available workflow templates
 */
router.get('/templates', async (req, res) => {
  try {
    const workflows = await listWorkflows();
    const templates = (workflows || []).map(w => ({
      id: w.id,
      name: w.name || w.id,
      // Keep legacy fields expected by the UI
      platform: Array.isArray(w.tags) && w.tags.includes('ios')
        ? 'ios'
        : (Array.isArray(w.tags) && w.tags.includes('android')
          ? 'android'
          : (Array.isArray(w.tags) && w.tags.includes('windows')
            ? 'windows'
            : 'universal')),
      category: Array.isArray(w.tags) && w.tags.length > 0 ? w.tags[0] : 'general',
      riskLevel: w.risk_level || (Array.isArray(w.tags) && w.tags.includes('readonly') ? 'low' : 'medium'),
      description: w.description || null,

      // Extra metadata (ignored by older UIs, useful for newer ones)
      tags: w.tags || [],
      requiredGates: w.required_gates || []
    }));

    res.sendEnvelope({
      templates,
      count: templates.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to get workflow templates', {
      error: error.message
    }, 500);
  }
});

export default router;

