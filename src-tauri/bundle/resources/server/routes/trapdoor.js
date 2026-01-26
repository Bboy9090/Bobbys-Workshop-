/**
 * Trapdoor API Routes
 * 
 * Admin operation endpoints for privileged device operations.
 * All endpoints require admin authentication via requireAdmin middleware.
 * 
 * @module server/routes/trapdoor
 */

import express from 'express';
import { requireAdmin, getUserRole } from '../middleware/requireAdmin.js';
import { evaluatePolicy, validateParameters } from '../../core/lib/policy-evaluator.js';
import { 
  createExecuteEnvelope, 
  createPolicyDenyEnvelope, 
  createErrorEnvelope,
  createSimulateEnvelope 
} from '../../core/lib/operation-envelope.js';
import { logShadow } from '../../core/lib/shadow-logger.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for Trapdoor API
const trapdoorLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please wait before retrying.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.headers['x-secret-room-passcode'] || req.ip;
  }
});

// Apply rate limiting to all trapdoor routes
router.use(trapdoorLimiter);

// Apply admin authentication to all routes
router.use(requireAdmin);

/**
 * POST /api/trapdoor/execute
 * 
 * Execute a privileged operation with policy enforcement
 */
router.post('/execute', async (req, res) => {
  try {
    const { operation, params = {}, correlationId } = req.body;
    const role = getUserRole(req);

    if (!operation) {
      return res.status(400).json({
        error: 'Operation required',
        message: 'Please specify the operation to execute'
      });
    }

    // Load operation specification from catalog
    // TODO: Load from core/catalog/operations/{operation}.json
    const operationSpec = await loadOperationSpec(operation);
    
    if (!operationSpec) {
      return res.status(404).json(
        createErrorEnvelope(
          operation,
          'OPERATION_NOT_FOUND',
          `Operation '${operation}' not found in catalog`,
          {},
          correlationId
        )
      );
    }

    // Log operation request
    await logShadow({
      operation: `${operation}_requested`,
      userId: req.user?.role || 'unknown',
      ipAddress: req.ip,
      role,
      authorization: 'ADMIN',
      success: true,
      metadata: {
        timestamp: new Date().toISOString(),
        params: sanitizeParams(params)
      }
    });

    // Evaluate policy
    const policyResult = evaluatePolicy(role, operationSpec);

    if (!policyResult.allowed) {
      const denyEnvelope = createPolicyDenyEnvelope({
        operation,
        reason: policyResult.reason,
        policy: policyResult.policy,
        metadata: {
          requestedRole: role,
          requiredRoles: operationSpec.allowedRoles
        },
        correlationId
      });

      await logShadow({
        operation: `${operation}_denied`,
        userId: req.user?.role || 'unknown',
        ipAddress: req.ip,
        role,
        authorization: 'ADMIN',
        success: false,
        metadata: {
          reason: policyResult.reason,
          policy: policyResult.policy
        }
      });

      return res.status(403).json(denyEnvelope);
    }

    // Validate parameters
    const validation = validateParameters(params, operationSpec);
    if (!validation.valid) {
      return res.status(400).json(
        createErrorEnvelope(
          operation,
          'INVALID_PARAMETERS',
          'Parameter validation failed',
          { errors: validation.errors },
          correlationId
        )
      );
    }

    // Check if confirmation required
    if (policyResult.requiresConfirmation && !req.body.confirmation) {
      return res.status(400).json(
        createErrorEnvelope(
          operation,
          'CONFIRMATION_REQUIRED',
          'This operation requires explicit confirmation',
          {
            riskLevel: operationSpec.riskLevel,
            requiresConfirmation: true
          },
          correlationId
        )
      );
    }

    // Execute operation
    // TODO: Route to appropriate operation handler
    const result = await executeOperation(operation, params, operationSpec);

    // Log completion
    await logShadow({
      operation: `${operation}_completed`,
      userId: req.user?.role || 'unknown',
      ipAddress: req.ip,
      role,
      authorization: 'ADMIN',
      success: result.operation.status === 'success',
      metadata: {
        timestamp: new Date().toISOString(),
        result: result.data.result
      }
    });

    return res.json(result);

  } catch (error) {
    console.error('Trapdoor execute error:', error);
    return res.status(500).json(
      createErrorEnvelope(
        req.body.operation || 'unknown',
        'INTERNAL_ERROR',
        error.message,
        {},
        req.body.correlationId
      )
    );
  }
});

/**
 * POST /api/trapdoor/simulate
 * 
 * Simulate/dry-run an operation without executing it
 */
router.post('/simulate', async (req, res) => {
  try {
    const { operation, params = {}, correlationId } = req.body;
    const role = getUserRole(req);

    if (!operation) {
      return res.status(400).json({
        error: 'Operation required'
      });
    }

    // Load operation specification
    const operationSpec = await loadOperationSpec(operation);
    
    if (!operationSpec) {
      return res.status(404).json(
        createErrorEnvelope(
          operation,
          'OPERATION_NOT_FOUND',
          `Operation '${operation}' not found`,
          {},
          correlationId
        )
      );
    }

    // Evaluate policy
    const policyResult = evaluatePolicy(role, operationSpec);

    // Validate parameters
    const validation = validateParameters(params, operationSpec);

    // Build simulation result
    const checks = [
      {
        name: 'policy_evaluation',
        passed: policyResult.allowed,
        details: policyResult
      },
      {
        name: 'parameter_validation',
        passed: validation.valid,
        details: validation
      }
    ];

    const wouldSucceed = policyResult.allowed && validation.valid;

    const simulateEnvelope = createSimulateEnvelope({
      operation,
      wouldSucceed,
      simulation: {
        checks,
        requirements: operationSpec.requiredCapabilities || [],
        warnings: policyResult.requiresConfirmation ? ['Confirmation required for execution'] : []
      },
      metadata: {
        role,
        riskLevel: operationSpec.riskLevel,
        requiresConfirmation: policyResult.requiresConfirmation
      },
      correlationId
    });

    return res.json(simulateEnvelope);

  } catch (error) {
    console.error('Trapdoor simulate error:', error);
    return res.status(500).json(
      createErrorEnvelope(
        req.body.operation || 'unknown',
        'INTERNAL_ERROR',
        error.message,
        {},
        req.body.correlationId
      )
    );
  }
});

/**
 * GET /api/trapdoor/operations
 * 
 * List all available operations for the current role
 */
router.get('/operations', async (req, res) => {
  try {
    const role = getUserRole(req);
    
    // TODO: Load all operations from catalog and filter by role
    const operations = await listAvailableOperations(role);

    return res.json({
      envelope: {
        type: 'inspect',
        version: '1.0',
        timestamp: new Date().toISOString(),
        correlationId: `list-${Date.now()}`
      },
      operation: {
        id: 'list_operations',
        status: 'success'
      },
      data: {
        operations,
        role
      },
      metadata: {
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Trapdoor list operations error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Helper functions

import { loadOperationSpec, listOperationsForRole } from '../../core/catalog/operation-loader.js';

/**
 * Load operation specification from catalog
 * (Re-exported from operation-loader for convenience)
 */

/**
 * Execute an operation
 * 
 * @param {string} operation - Operation identifier
 * @param {Object} params - Operation parameters
 * @param {Object} operationSpec - Operation specification
 * @returns {Promise<Object>} Execute envelope
 */
async function executeOperation(operation, params, operationSpec) {
  // TODO: Route to appropriate handler based on operation type
  // This will call workflow engine or direct provider methods
  
  return createErrorEnvelope(
    operation,
    'NOT_IMPLEMENTED',
    'Operation execution not yet implemented',
    { operation, params }
  );
}

/**
 * List available operations for a role
 * 
 * @param {string} role - User role
 * @returns {Promise<Array>} List of available operations
 */
async function listAvailableOperations(role) {
  return await listOperationsForRole(role);
}

/**
 * Sanitize parameters for logging (remove sensitive data)
 * 
 * @param {Object} params - Parameters to sanitize
 * @returns {Object} Sanitized parameters
 */
function sanitizeParams(params) {
  const sanitized = { ...params };
  const sensitiveKeys = ['password', 'passcode', 'apiKey', 'token', 'secret'];
  
  for (const key of sensitiveKeys) {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

export default router;
