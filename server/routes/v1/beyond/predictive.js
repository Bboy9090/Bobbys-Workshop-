/**
 * 🚀 Beyond World Class - Predictive Analytics API
 */

import express from 'express';
import predictiveAnalytics from '../../../utils/beyond/predictive-analytics.js';

const router = express.Router();

/**
 * POST /api/v1/beyond/predictive/trend
 * Predict trend for a metric
 */
router.post('/trend', (req, res) => {
  try {
    const { metric, windowSize = 10 } = req.body;
    const prediction = predictiveAnalytics.predictTrend(metric, windowSize);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'predict_trend',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: prediction,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'predict_trend',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/beyond/predictive/anomaly
 * Detect anomaly in metric value
 */
router.post('/anomaly', (req, res) => {
  try {
    const { metric, value } = req.body;
    const result = predictiveAnalytics.detectAnomaly(metric, value);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'detect_anomaly',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'detect_anomaly',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/beyond/predictive/scaling
 * Predict scaling needs
 */
router.get('/scaling', (req, res) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow) || 3600000;
    const prediction = predictiveAnalytics.predictScalingNeeds(timeWindow);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'predict_scaling',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: prediction,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'predict_scaling',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/beyond/predictive/failure
 * Predict system failure
 */
router.get('/failure', (req, res) => {
  try {
    const metrics = require('../../../utils/observability/metrics-collector.js').default.getMetricsJSON();
    const prediction = predictiveAnalytics.predictFailure(metrics);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'predict_failure',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: prediction,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'predict_failure',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/beyond/predictive/capacity
 * Capacity planning
 */
router.get('/capacity', (req, res) => {
  try {
    const timeHorizon = parseInt(req.query.timeHorizon) || 30;
    const plan = predictiveAnalytics.planCapacity(timeHorizon);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'plan_capacity',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: plan,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'plan_capacity',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/beyond/predictive/anomalies
 * Get detected anomalies
 */
router.get('/anomalies', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const anomalies = predictiveAnalytics.getAnomalies(limit);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_anomalies',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: { anomalies, count: anomalies.length },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_anomalies',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

export default router;
