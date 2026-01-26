/**
 * ♾️ Infinite Legendary - Swarm Intelligence API (Production-Grade)
 */

import express from 'express';
import swarmIntelligence from '../../../utils/infinite/swarm-intelligence.js';
import { validateInfiniteFeature, manageInfiniteResources } from '../../../middleware/infinite-validation.js';
import infiniteErrorHandler from '../../../utils/infinite/error-handler.js';
import infinitePerformanceMonitor from '../../../utils/infinite/performance-monitor.js';
import infiniteRateLimiter from '../../../middleware/infinite-rate-limit.js';

const router = express.Router();

// Apply production-grade middleware
router.use(manageInfiniteResources);
router.use(infiniteRateLimiter.createRateLimitMiddleware('swarm'));

/**
 * POST /api/v1/infinite/swarm/agents
 * Create agent
 */
router.post('/agents', (req, res) => {
  try {
    const { agentId, config } = req.body;
    const agent = swarmIntelligence.createAgent(agentId, config);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'create_agent',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: agent,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'create_agent',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/infinite/swarm/swarms
 * Create swarm
 */
router.post('/swarms', (req, res) => {
  try {
    const { swarmId, agentIds, config } = req.body;
    const swarm = swarmIntelligence.createSwarm(swarmId, agentIds, config);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'create_swarm',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: swarm,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'create_swarm',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/infinite/swarm/message
 * Send message between agents
 */
router.post('/message', (req, res) => {
  try {
    const { from, to, message } = req.body;
    const messageObj = swarmIntelligence.sendMessage(from, to, message);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'send_message',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: messageObj,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'send_message',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/infinite/swarm/consensus
 * Reach consensus in swarm
 */
router.post('/consensus', async (req, res) => {
  try {
    const { swarmId, proposal } = req.body;
    const consensus = await swarmIntelligence.reachConsensus(swarmId, proposal);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'reach_consensus',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: consensus,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'reach_consensus',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/infinite/swarm/optimize
 * Particle Swarm Optimization - Production-Grade
 */
router.post('/optimize',
  validateInfiniteFeature('swarm'),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { objective, swarmSize = 20, iterations = 100 } = req.body;
      
      if (!objective || typeof objective !== 'string') {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'swarm_optimize',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'Objective function is required and must be a string',
          },
        });
      }

      // Security: Validate objective function
      const dangerousPatterns = [
        /require\(/,
        /import\(/,
        /eval\(/,
        /Function\(/,
        /process\./,
        /global\./,
        /__dirname/,
        /__filename/,
      ];

      if (dangerousPatterns.some(pattern => pattern.test(objective))) {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'swarm_optimize',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'INVALID_INPUT',
            message: 'Objective function contains potentially dangerous patterns',
          },
        });
      }
      
      // Create objective function (with error handling)
      let objectiveFunc;
      try {
        objectiveFunc = new Function('position', `return ${objective}`);
      } catch (error) {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'swarm_optimize',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'INVALID_OBJECTIVE',
            message: `Invalid objective function: ${error.message}`,
          },
        });
      }
      
      const result = await swarmIntelligence.particleSwarmOptimize(
        objectiveFunc,
        swarmSize,
        iterations
      );
      
      infinitePerformanceMonitor.recordOperation(
        'swarm',
        'particle_swarm_optimize',
        Date.now() - startTime,
        true
      );
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'swarm_optimize',
          mode: 'write',
          timestamp: new Date().toISOString(),
        },
        data: {
          ...result,
          executionTime: Date.now() - startTime,
        },
      });
    } catch (error) {
      const errorResponse = infiniteErrorHandler.handleError(error, {
        feature: 'swarm',
        operation: 'swarm_optimize',
      });

      infinitePerformanceMonitor.recordOperation(
        'swarm',
        'particle_swarm_optimize',
        Date.now() - startTime,
        false
      );

      res.status(500).json({
        envelope: {
          version: '1.0',
          operation: 'swarm_optimize',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

/**
 * GET /api/v1/infinite/swarm/stats/:swarmId
 * Get swarm statistics
 */
router.get('/stats/:swarmId', (req, res) => {
  try {
    const { swarmId } = req.params;
    const stats = swarmIntelligence.getSwarmStats(swarmId);
    
    if (!stats) {
      return res.status(404).json({
        envelope: {
          version: '1.0',
          operation: 'get_swarm_stats',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        error: { message: 'Swarm not found' },
      });
    }

    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_swarm_stats',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_swarm_stats',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

export default router;
