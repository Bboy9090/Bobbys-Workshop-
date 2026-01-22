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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';
import { executeWorkflow } from '../../../utils/workflow-executor-enhanced.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const shadowLogger = new ShadowLogger();

/**
 * POST /api/v1/trapdoor/workflows/execute
 * Execute a workflow (from trapdoor API)
 */
router.post('/execute', async (req, res) => {
  const { workflowId, parameters, caseId, ownershipAttestation, deviceAuthorization, destructiveConfirm } = req.body;

  if (!workflowId) {
    return res.sendError('VALIDATION_ERROR', 'Workflow ID is required', null, 400);
  }

  try {
    // Log to shadow
    await shadowLogger.logShadow({
      operation: 'workflow_execute',
      deviceSerial: 'multiple',
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: false,
      metadata: {
        workflowId,
        parameters
      }
    });

    const jobId = randomUUID();
    const executionResult = await executeWorkflow(workflowId, {
      caseId: caseId || `trapdoor-${workflowId}`,
      userId: req.ip,
      jobId,
      parameters: parameters || {},
      ownershipAttestation,
      deviceAuthorization,
      destructiveConfirm
    });

    // Log success
    await shadowLogger.logShadow({
      operation: 'workflow_execute',
      deviceSerial: 'multiple',
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: executionResult.success === true,
      metadata: {
        workflowId,
        executionResult
      }
    });

    res.sendEnvelope({
      success: executionResult.success === true,
      message: executionResult.success ? 'Workflow executed' : 'Workflow execution failed',
      execution: executionResult,
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
    const workflowsDir = path.join(__dirname, '../../../../workflows');
    const templates = [];

    if (fs.existsSync(workflowsDir)) {
      const files = fs.readdirSync(workflowsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const workflow = JSON.parse(fs.readFileSync(path.join(workflowsDir, file), 'utf8'));
            templates.push({
              id: workflow.id || file.replace('.json', ''),
              name: workflow.name || file.replace('.json', ''),
              platform: workflow.platform || 'unknown',
              category: workflow.category || 'general',
              riskLevel: workflow.risk_level || 'medium',
              description: workflow.description || null
            });
          } catch (error) {
            // Skip invalid JSON files
            console.warn(`[Trapdoor] Invalid workflow file: ${file}`, error);
          }
        }
      }
    }

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

