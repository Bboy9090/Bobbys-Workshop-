/**
 * 🌟 World Class Universal Legend - Alerting API
 * 
 * Alert management and monitoring endpoints
 */

import express from 'express';
import alertingEngine from '../../../utils/world-class/alerting-engine.js';

const router = express.Router();

/**
 * GET /api/v1/world-class/alerts/rules
 * Get all alert rules
 */
router.get('/rules', (req, res) => {
  try {
    const rules = alertingEngine.getRules();
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_alert_rules',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: {
        rules,
        count: rules.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_alert_rules',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: {
        message: error.message,
        code: 'ALERT_RULES_ERROR',
      },
    });
  }
});

/**
 * POST /api/v1/world-class/alerts/rules
 * Create a new alert rule
 */
router.post('/rules', (req, res) => {
  try {
    const rule = req.body;
    alertingEngine.addRule(rule);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'create_alert_rule',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: {
        message: 'Alert rule created successfully',
        rule,
      },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'create_alert_rule',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: {
        message: error.message,
        code: 'CREATE_ALERT_RULE_ERROR',
      },
    });
  }
});

/**
 * GET /api/v1/world-class/alerts/active
 * Get active alerts
 */
router.get('/active', (req, res) => {
  try {
    const alerts = alertingEngine.getActiveAlerts();
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_active_alerts',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: {
        alerts,
        count: alerts.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_active_alerts',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: {
        message: error.message,
        code: 'ACTIVE_ALERTS_ERROR',
      },
    });
  }
});

/**
 * GET /api/v1/world-class/alerts/history
 * Get alert history
 */
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = alertingEngine.getAlertHistory(limit);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_alert_history',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: {
        alerts: history,
        count: history.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_alert_history',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: {
        message: error.message,
        code: 'ALERT_HISTORY_ERROR',
      },
    });
  }
});

export default router;
