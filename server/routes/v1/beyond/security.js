/**
 * 🚀 Beyond World Class - Advanced Security API
 */

import express from 'express';
import threatDetector from '../../../utils/beyond/threat-detector.js';

const router = express.Router();

/**
 * POST /api/v1/beyond/security/analyze-behavior
 * Analyze user behavior
 */
router.post('/analyze-behavior', (req, res) => {
  try {
    const { userId, action, context } = req.body;
    const behavior = threatDetector.analyzeBehavior(userId, action, context);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'analyze_behavior',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: behavior,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'analyze_behavior',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/beyond/security/detect-intrusion
 * Detect intrusion attempt
 */
router.post('/detect-intrusion', (req, res) => {
  try {
    const { ip, request } = req.body;
    const result = threatDetector.detectIntrusion(ip, request);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'detect_intrusion',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'detect_intrusion',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/beyond/security/risk-score/:userId
 * Get user risk score
 */
router.get('/risk-score/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const riskScore = threatDetector.getRiskScore(userId);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_risk_score',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: riskScore,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_risk_score',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/beyond/security/threats
 * Get active threats
 */
router.get('/threats', (req, res) => {
  try {
    const threats = threatDetector.getActiveThreats();
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_threats',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: { threats, count: threats.length },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_threats',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/beyond/security/threats/:threatId/resolve
 * Resolve threat
 */
router.post('/threats/:threatId/resolve', (req, res) => {
  try {
    const { threatId } = req.params;
    const { resolution } = req.body;
    const resolved = threatDetector.resolveThreat(threatId, resolution);
    
    if (resolved) {
      res.json({
        envelope: {
          version: '1.0',
          operation: 'resolve_threat',
          mode: 'write',
          timestamp: new Date().toISOString(),
        },
        data: { message: 'Threat resolved successfully' },
      });
    } else {
      res.status(404).json({
        envelope: {
          version: '1.0',
          operation: 'resolve_threat',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        error: { message: 'Threat not found' },
      });
    }
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'resolve_threat',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

export default router;
