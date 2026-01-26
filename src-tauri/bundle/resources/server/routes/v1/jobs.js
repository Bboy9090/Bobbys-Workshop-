/**
 * Jobs API - Workflow execution and job management
 * 
 * PRINCIPLE: All workflow executions require policy gates and audit logging
 */

import express from 'express';
import { randomUUID } from 'node:crypto';
import { getAuditLogger } from '../../utils/audit-logger.js';

const router = express.Router();

// In-memory job storage (replace with database in production)
// Export jobs Map so cases.js can access it
export const jobs = new Map();

/**
 * GET /api/v1/jobs/:id
 * Get job status
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const job = jobs.get(id);

    if (!job) {
      return res.sendError('JOB_NOT_FOUND', 'Job not found', { jobId: id }, 404);
    }

    res.sendEnvelope({
      job
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to get job', {
      error: error.message,
      jobId: req.params.id
    }, 500);
  }
});

/**
 * GET /api/v1/jobs/:id/events
 * Get audit events for a job
 */
router.get('/:id/events', async (req, res) => {
  try {
    const { id } = req.params;
    const job = jobs.get(id);

    if (!job) {
      return res.sendError('JOB_NOT_FOUND', 'Job not found', { jobId: id }, 404);
    }

    const auditLogger = getAuditLogger();
    const events = await auditLogger.getJobEvents(id);

    res.sendEnvelope({
      jobId: id,
      events
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to get job events', {
      error: error.message,
      jobId: req.params.id
    }, 500);
  }
});

export default router;
