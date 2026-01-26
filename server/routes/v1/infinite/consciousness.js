/**
 * ♾️ Infinite Legendary - Consciousness AI API (Production-Grade)
 */

import express from 'express';
import consciousnessAI from '../../../utils/infinite/consciousness-ai.js';
import { validateInfiniteFeature, manageInfiniteResources } from '../../../middleware/infinite-validation.js';
import infiniteErrorHandler from '../../../utils/infinite/error-handler.js';
import infinitePerformanceMonitor from '../../../utils/infinite/performance-monitor.js';
import infiniteRateLimiter from '../../../middleware/infinite-rate-limit.js';

const router = express.Router();

// Apply production-grade middleware
router.use(manageInfiniteResources);
router.use(infiniteRateLimiter.createRateLimitMiddleware('consciousness'));

/**
 * POST /api/v1/infinite/consciousness/meta-cognize
 * Meta-cognition: thinking about thinking - Production-Grade
 */
router.post('/meta-cognize',
  validateInfiniteFeature('consciousness'),
  (req, res) => {
    const startTime = Date.now();
    try {
      const { question, context = {} } = req.body;
      
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'meta_cognize',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'Question is required and must be a non-empty string',
          },
        });
      }
      
      const reflection = consciousnessAI.metaCognize(question, context);
      
      // Record performance
      infinitePerformanceMonitor.recordOperation(
        'consciousness',
        'meta_cognize',
        Date.now() - startTime,
        true
      );
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'meta_cognize',
          mode: 'read',
          timestamp: new Date().toISOString(),
        },
        data: {
          ...reflection,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      const errorResponse = infiniteErrorHandler.handleError(error, {
        feature: 'consciousness',
        operation: 'meta_cognize',
      });

      infinitePerformanceMonitor.recordOperation(
        'consciousness',
        'meta_cognize',
        Date.now() - startTime,
        false
      );

      res.status(500).json({
        envelope: {
          version: '1.0',
          operation: 'meta_cognize',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

/**
 * POST /api/v1/infinite/consciousness/self-model
 * Build self-model - Production-Grade
 */
router.post('/self-model',
  validateInfiniteFeature('consciousness'),
  (req, res) => {
    const startTime = Date.now();
    try {
      const { observations } = req.body;
      
      if (!observations || !Array.isArray(observations) || observations.length === 0) {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'build_self_model',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'INVALID_INPUT',
            message: 'Observations is required and must be a non-empty array',
          },
        });
      }
      
      const model = consciousnessAI.buildSelfModel(observations);
      
      infinitePerformanceMonitor.recordOperation(
        'consciousness',
        'build_self_model',
        Date.now() - startTime,
        true
      );
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'build_self_model',
          mode: 'write',
          timestamp: new Date().toISOString(),
        },
        data: {
          ...model,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      const errorResponse = infiniteErrorHandler.handleError(error, {
        feature: 'consciousness',
        operation: 'build_self_model',
      });

      infinitePerformanceMonitor.recordOperation(
        'consciousness',
        'build_self_model',
        Date.now() - startTime,
        false
      );

      res.status(500).json({
        envelope: {
          version: '1.0',
          operation: 'build_self_model',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

/**
 * POST /api/v1/infinite/consciousness/theory-of-mind
 * Model other agent (theory of mind) - Production-Grade
 */
router.post('/theory-of-mind',
  validateInfiniteFeature('consciousness'),
  (req, res) => {
    const startTime = Date.now();
    try {
      const { agentId, observations } = req.body;
      
      if (!agentId || typeof agentId !== 'string') {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'model_other_agent',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'Agent ID is required and must be a string',
          },
        });
      }
      
      if (!observations || !Array.isArray(observations) || observations.length === 0) {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'model_other_agent',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'INVALID_INPUT',
            message: 'Observations is required and must be a non-empty array',
          },
        });
      }
      
      const model = consciousnessAI.modelOtherAgent(agentId, observations);
      
      infinitePerformanceMonitor.recordOperation(
        'consciousness',
        'model_other_agent',
        Date.now() - startTime,
        true
      );
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'model_other_agent',
          mode: 'write',
          timestamp: new Date().toISOString(),
        },
        data: {
          ...model,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      const errorResponse = infiniteErrorHandler.handleError(error, {
        feature: 'consciousness',
        operation: 'model_other_agent',
      });

      infinitePerformanceMonitor.recordOperation(
        'consciousness',
        'model_other_agent',
        Date.now() - startTime,
        false
      );

      res.status(500).json({
        envelope: {
          version: '1.0',
          operation: 'model_other_agent',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

/**
 * POST /api/v1/infinite/consciousness/reason
 * Advanced reasoning - Production-Grade
 */
router.post('/reason',
  validateInfiniteFeature('consciousness'),
  (req, res) => {
    const startTime = Date.now();
    try {
      const { problem, reasoningType = 'abductive' } = req.body;
      
      if (!problem || typeof problem !== 'string') {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'advanced_reason',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'Problem is required and must be a string',
          },
        });
      }
      
      const validTypes = ['abductive', 'analogical', 'counterfactual', 'temporal', 'spatial'];
      const validatedType = validTypes.includes(reasoningType) ? reasoningType : 'abductive';
      
      const result = consciousnessAI.advancedReason(problem, validatedType);
      
      infinitePerformanceMonitor.recordOperation(
        'consciousness',
        'advanced_reason',
        Date.now() - startTime,
        true
      );
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'advanced_reason',
          mode: 'read',
          timestamp: new Date().toISOString(),
        },
        data: {
          ...result,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      const errorResponse = infiniteErrorHandler.handleError(error, {
        feature: 'consciousness',
        operation: 'advanced_reason',
      });

      infinitePerformanceMonitor.recordOperation(
        'consciousness',
        'advanced_reason',
        Date.now() - startTime,
        false
      );

      res.status(500).json({
        envelope: {
          version: '1.0',
          operation: 'advanced_reason',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

/**
 * GET /api/v1/infinite/consciousness/awareness
 * Check self-awareness - Production-Grade
 */
router.get('/awareness', (req, res) => {
  const startTime = Date.now();
  try {
    const awareness = consciousnessAI.checkSelfAwareness();
    
    infinitePerformanceMonitor.recordOperation(
      'consciousness',
      'check_self_awareness',
      Date.now() - startTime,
      true
    );
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'check_self_awareness',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: {
        ...awareness,
        executionTime: Date.now() - startTime,
      },
    });
  } catch (error) {
    const errorResponse = infiniteErrorHandler.handleError(error, {
      feature: 'consciousness',
      operation: 'check_self_awareness',
    });

    infinitePerformanceMonitor.recordOperation(
      'consciousness',
      'check_self_awareness',
      Date.now() - startTime,
      false
    );

    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'check_self_awareness',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      ...errorResponse,
    });
  }
});

export default router;
