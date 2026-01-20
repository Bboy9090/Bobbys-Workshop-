/**
 * Universal Legend Status - Metrics API Endpoints
 * Enterprise-grade metrics API for real-time monitoring
 */

import express from 'express';
import metricsCollector from '../../utils/observability/metrics-collector.js';

const router = express.Router();

/**
 * GET /api/v1/observability/metrics
 * Get all metrics in Prometheus format
 */
router.get('/metrics', (req, res) => {
  try {
    const format = req.query.format || 'prometheus';
    
    if (format === 'prometheus') {
      res.set('Content-Type', 'text/plain');
      res.send(metricsCollector.getPrometheusFormat());
    } else if (format === 'json') {
      res.json(metricsCollector.getMetricsJSON());
    } else {
      res.status(400).json({ error: 'Invalid format. Use "prometheus" or "json"' });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/observability/metrics/summary
 * Get metrics summary
 */
router.get('/metrics/summary', (req, res) => {
  try {
    res.json(metricsCollector.getSummary());
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics summary',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/v1/observability/metrics/reset
 * Reset all metrics (admin only - use with caution)
 */
router.post('/metrics/reset', (req, res) => {
  try {
    // In production, add admin check here
    metricsCollector.reset();
    res.json({
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
