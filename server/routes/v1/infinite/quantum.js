/**
 * ♾️ Infinite Legendary - Quantum Computing API (Production-Grade)
 */

import express from 'express';
import quantumOptimizer from '../../../utils/infinite/quantum-optimizer.js';
import { validateInfiniteFeature, manageInfiniteResources } from '../../../middleware/infinite-validation.js';
import infiniteErrorHandler from '../../../utils/infinite/error-handler.js';

const router = express.Router();

// Apply resource management to all routes
router.use(manageInfiniteResources);

/**
 * POST /api/v1/infinite/quantum/optimize
 * Quantum optimization (Production-Grade)
 */
router.post('/optimize', 
  validateInfiniteFeature('quantum'),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { problem, qubits = 4 } = req.body;
      
      // Validate required fields
      if (!problem) {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'quantum_optimize',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'Problem is required',
          },
        });
      }

      const result = await quantumOptimizer.quantumOptimize(problem, qubits);
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'quantum_optimize',
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
        feature: 'quantum',
        operation: 'quantum_optimize',
      });

      const statusCode = error.message.includes('not available') ? 503 : 500;
      
      res.status(statusCode).json({
        envelope: {
          version: '1.0',
          operation: 'quantum_optimize',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

/**
 * POST /api/v1/infinite/quantum/search
 * Quantum search (Grover's algorithm) - Production-Grade
 */
router.post('/search',
  validateInfiniteFeature('quantum'),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { database, target } = req.body;
      
      // Validate required fields
      if (!database || !Array.isArray(database)) {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'quantum_search',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'INVALID_INPUT',
            message: 'Database must be a non-empty array',
          },
        });
      }

      if (database.length === 0) {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'quantum_search',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'INVALID_INPUT',
            message: 'Database cannot be empty',
          },
        });
      }

      if (target === undefined || target === null) {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'quantum_search',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'Target is required',
          },
        });
      }

      const result = await quantumOptimizer.quantumSearch(database, target);
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'quantum_search',
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
        feature: 'quantum',
        operation: 'quantum_search',
      });

      const statusCode = error.message.includes('not available') ? 503 : 500;
      
      res.status(statusCode).json({
        envelope: {
          version: '1.0',
          operation: 'quantum_search',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

/**
 * POST /api/v1/infinite/quantum/hybrid
 * Hybrid classical-quantum optimization - Production-Grade
 */
router.post('/hybrid',
  validateInfiniteFeature('quantum'),
  async (req, res) => {
    const startTime = Date.now();
    try {
      const { problem } = req.body;
      
      if (!problem) {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: 'hybrid_optimize',
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'Problem is required',
          },
        });
      }

      const result = await quantumOptimizer.hybridOptimize(problem);
      
      res.json({
        envelope: {
          version: '1.0',
          operation: 'hybrid_optimize',
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
        feature: 'quantum',
        operation: 'hybrid_optimize',
      });

      res.status(500).json({
        envelope: {
          version: '1.0',
          operation: 'hybrid_optimize',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  }
);

/**
 * GET /api/v1/infinite/quantum/results
 * Get quantum computation results - Production-Grade
 */
router.get('/results', (req, res) => {
  try {
    // Validate and sanitize limit
    const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit) || 100));
    
    const results = quantumOptimizer.getQuantumResults(limit);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_quantum_results',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: { 
        results, 
        count: results.length,
        limit,
      },
    });
  } catch (error) {
    const errorResponse = infiniteErrorHandler.handleError(error, {
      feature: 'quantum',
      operation: 'get_quantum_results',
    });

    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_quantum_results',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      ...errorResponse,
    });
  }
});

export default router;
