/**
 * ♾️ Infinite Legendary - Multi-Dimensional Optimization API (Production-Grade)
 */

import express from 'express';
import multiOptimizer from '../../../utils/infinite/multi-dimensional-optimizer.js';
import { validateInfiniteFeature, manageInfiniteResources } from '../../../middleware/infinite-validation.js';
import infiniteErrorHandler from '../../../utils/infinite/error-handler.js';
import infinitePerformanceMonitor from '../../../utils/infinite/performance-monitor.js';
import infiniteRateLimiter from '../../../middleware/infinite-rate-limit.js';

const router = express.Router();

// Apply production-grade middleware
router.use(manageInfiniteResources);
router.use(infiniteRateLimiter.createRateLimitMiddleware('multi-optimize'));

/**
 * POST /api/v1/infinite/multi-optimize/pareto
 * Pareto optimization (multi-objective)
 */
router.post('/pareto', (req, res) => {
  try {
    const { objectives, constraints = [], iterations = 100 } = req.body;
    
    // Convert objective strings to functions
    const objFunctions = objectives.map(obj => {
      if (typeof obj === 'function') return obj;
      return new Function('x', `return ${obj}`);
    });
    
    const result = multiOptimizer.paretoOptimize(objFunctions, constraints, iterations);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'pareto_optimize',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'pareto_optimize',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/infinite/multi-optimize/bayesian
 * Bayesian optimization
 */
router.post('/bayesian', (req, res) => {
  try {
    const { objective, bounds, iterations = 50 } = req.body;
    
    // Convert objective to function
    const objFunction = typeof objective === 'function' 
      ? objective 
      : new Function('x', `return ${objective}`);
    
    const result = multiOptimizer.bayesianOptimize(objFunction, bounds, iterations);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'bayesian_optimize',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'bayesian_optimize',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/infinite/multi-optimize/constrained
 * Constraint optimization
 */
router.post('/constrained', (req, res) => {
  try {
    const { objective, constraints, bounds, method = 'penalty' } = req.body;
    
    // Convert to functions
    const objFunction = typeof objective === 'function'
      ? objective
      : new Function('x', `return ${objective}`);
    
    const constraintFunctions = constraints.map(c => 
      typeof c === 'function' ? c : new Function('x', `return ${c}`)
    );
    
    const result = multiOptimizer.constrainedOptimize(
      objFunction,
      constraintFunctions,
      bounds,
      method
    );
    res.json({
      envelope: {
        version: '1.0',
        operation: 'constrained_optimize',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'constrained_optimize',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/infinite/multi-optimize/weighted
 * Weighted multi-objective optimization
 */
router.post('/weighted', (req, res) => {
  try {
    const { objectives, weights, constraints = [] } = req.body;
    
    const objFunctions = objectives.map(obj =>
      typeof obj === 'function' ? obj : new Function('x', `return ${obj}`)
    );
    
    const constraintFunctions = constraints.map(c =>
      typeof c === 'function' ? c : new Function('x', `return ${c}`)
    );
    
    const result = multiOptimizer.weightedOptimize(objFunctions, weights, constraintFunctions);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'weighted_optimize',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'weighted_optimize',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

export default router;
