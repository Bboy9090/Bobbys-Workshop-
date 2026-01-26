/**
 * 🌌 Transcendent Legendary - Self-Evolution API
 */

import express from 'express';
import selfEvolving from '../../../utils/transcendent/self-evolving.js';

const router = express.Router();

/**
 * POST /api/v1/transcendent/evolution/initialize
 * Initialize evolution population
 */
router.post('/initialize', (req, res) => {
  try {
    const size = parseInt(req.body.size) || 20;
    const population = selfEvolving.initializePopulation(size);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'initialize_evolution',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: { population, count: population.length },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'initialize_evolution',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/transcendent/evolution/evolve
 * Evolve to next generation
 */
router.post('/evolve', async (req, res) => {
  try {
    const metrics = req.body.metrics || {};
    const result = await selfEvolving.evolve(metrics);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'evolve',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'evolve',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/transcendent/evolution/best
 * Get best configuration
 */
router.get('/best', (req, res) => {
  try {
    const best = selfEvolving.getBestConfiguration();
    if (!best) {
      return res.status(404).json({
        envelope: {
          version: '1.0',
          operation: 'get_best_configuration',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        error: { message: 'No configuration found. Initialize evolution first.' },
      });
    }

    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_best_configuration',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: best,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_best_configuration',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/transcendent/evolution/stats
 * Get evolution statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = selfEvolving.getEvolutionStats();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_evolution_stats',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_evolution_stats',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/transcendent/evolution/reset
 * Reset evolution
 */
router.post('/reset', (req, res) => {
  try {
    selfEvolving.reset();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'reset_evolution',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: { message: 'Evolution reset successfully' },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'reset_evolution',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

export default router;
