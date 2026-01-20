/**
 * Universal Legend Status - Tracing API Endpoints
 * Enterprise-grade tracing API for distributed trace inspection
 */

import express from 'express';
import tracer from '../../utils/observability/tracing.js';

const router = express.Router();

/**
 * GET /api/v1/observability/traces/active
 * Get all active traces
 */
router.get('/traces/active', (req, res) => {
  try {
    const traces = tracer.getActiveTraces();
    res.json({
      count: traces.length,
      traces,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get active traces',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/observability/traces/:traceId
 * Get a specific trace by ID
 */
router.get('/traces/:traceId', (req, res) => {
  try {
    const { traceId } = req.params;
    const spans = tracer.getTrace(traceId);
    
    if (spans.length === 0) {
      res.status(404).json({
        error: 'Trace not found',
        traceId,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    res.json({
      traceId,
      spanCount: spans.length,
      spans: spans.map(span => span.toJSON()),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get trace',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/observability/traces/summary
 * Get tracing system summary
 */
router.get('/traces/summary', (req, res) => {
  try {
    res.json(tracer.getSummary());
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get trace summary',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
