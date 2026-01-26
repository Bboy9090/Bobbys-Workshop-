/**
 * 🏆 Production-Grade Validation Middleware for Infinite Legendary Features
 */

import infiniteValidator from '../utils/infinite/validation.js';
import infiniteErrorHandler from '../utils/infinite/error-handler.js';

/**
 * Validation middleware factory
 */
export function validateInfiniteFeature(featureType) {
  return (req, res, next) => {
    try {
      let validation;

      switch (featureType) {
        case 'quantum':
          validation = infiniteValidator.validateQuantumOptimize(req.body);
          break;
        case 'forecast':
          validation = infiniteValidator.validateForecast(req.body);
          break;
        case 'swarm':
          validation = infiniteValidator.validateSwarm(req.body);
          break;
        case 'causal':
          validation = infiniteValidator.validateCausal(req.body);
          break;
        case 'consciousness':
          validation = infiniteValidator.validateConsciousness(req.body);
          break;
        case 'replicate':
          validation = infiniteValidator.validateSelfReplicating(req.body);
          break;
        case 'neuromorphic':
          validation = infiniteValidator.validateNeuromorphic(req.body);
          break;
        case 'simulation':
          validation = infiniteValidator.validateSimulation(req.body);
          break;
        case 'multi-optimize':
          validation = infiniteValidator.validateMultiOptimize(req.body);
          break;
        case 'blockchain':
          validation = infiniteValidator.validateBlockchain(req.body);
          break;
        default:
          return next();
      }

      if (!validation.valid) {
        return res.status(400).json({
          envelope: {
            version: '1.0',
            operation: req.path,
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            details: validation.errors,
          },
        });
      }

      // Replace body with sanitized input
      req.body = validation.sanitized;
      next();
    } catch (error) {
      const errorResponse = infiniteErrorHandler.handleError(error, {
        feature: featureType,
        operation: req.path,
      });

      return res.status(500).json({
        envelope: {
          version: '1.0',
          operation: req.path,
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    }
  };
}

/**
 * Resource management middleware
 */
import infiniteResourceManager from '../utils/infinite/resource-manager.js';

export function manageInfiniteResources(req, res, next) {
  const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const featureType = req.path.split('/').find(part => 
    ['quantum', 'forecast', 'swarm', 'causal', 'consciousness', 
     'replicate', 'neuromorphic', 'simulation', 'multi-optimize', 'blockchain']
      .includes(part)
  ) || 'default';

  // Acquire resource
  infiniteResourceManager.acquireResource(operationId, featureType)
    .then(resource => {
      req.infiniteResource = resource;
      req.infiniteOperationId = operationId;

      // Release on response finish
      res.on('finish', () => {
        infiniteResourceManager.releaseResource(operationId);
      });

      next();
    })
    .catch(error => {
      const errorResponse = infiniteErrorHandler.handleError(error, {
        feature: featureType,
        operation: req.path,
      });

      return res.status(503).json({
        envelope: {
          version: '1.0',
          operation: req.path,
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        ...errorResponse,
      });
    });
}

/**
 * Error handling middleware
 */
export function handleInfiniteErrors(err, req, res, next) {
  const errorResponse = infiniteErrorHandler.handleError(err, {
    feature: req.path.split('/').find(part => 
      ['quantum', 'forecast', 'swarm', 'causal', 'consciousness', 
       'replicate', 'neuromorphic', 'simulation', 'multi-optimize', 'blockchain']
        .includes(part)
    ) || 'unknown',
    operation: req.path,
  });

  res.status(err.statusCode || 500).json({
    envelope: {
      version: '1.0',
      operation: req.path,
      mode: 'error',
      timestamp: new Date().toISOString(),
    },
    ...errorResponse,
  });
}
