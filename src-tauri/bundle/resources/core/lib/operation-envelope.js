/**
 * Operation Envelope Utilities
 * 
 * Standardized response format for all Trapdoor operations.
 * Provides envelope creation, validation, and audit log conversion.
 * 
 * @module core/lib/operation-envelope
 */

import { randomUUID } from 'crypto';

/**
 * Create a correlation ID for request tracking
 * 
 * @returns {string} Unique correlation ID
 */
export function createCorrelationId() {
  return randomUUID();
}

/**
 * Create an inspect envelope
 * 
 * @param {Object} options
 * @param {string} options.operationId - Operation identifier
 * @param {boolean} options.available - Whether tool/device is available
 * @param {Object} options.details - Inspection details
 * @param {string} [options.correlationId] - Optional correlation ID
 * @returns {Object} Inspect envelope
 */
export function createInspectEnvelope({ operationId, available, details, correlationId }) {
  return {
    envelope: {
      type: 'inspect',
      version: '1.0',
      timestamp: new Date().toISOString(),
      correlationId: correlationId || createCorrelationId()
    },
    operation: {
      id: operationId,
      status: available ? 'success' : 'failure'
    },
    data: {
      available,
      details: details || {}
    },
    metadata: {
      processedAt: new Date().toISOString(),
      inspectionType: 'availability_check'
    }
  };
}

/**
 * Create an execute envelope
 * 
 * @param {Object} options
 * @param {string} options.operation - Operation identifier
 * @param {boolean} options.success - Whether operation succeeded
 * @param {Object} [options.result] - Operation result data
 * @param {Object} [options.error] - Error details if failed
 * @param {Object} [options.metadata] - Additional metadata
 * @param {string} [options.correlationId] - Optional correlation ID
 * @returns {Object} Execute envelope
 */
export function createExecuteEnvelope({ operation, success, result, error, metadata, correlationId }) {
  const envelope = {
    envelope: {
      type: 'execute',
      version: '1.0',
      timestamp: new Date().toISOString(),
      correlationId: correlationId || createCorrelationId()
    },
    operation: {
      id: operation,
      status: success ? 'success' : 'failure'
    },
    data: {
      success
    },
    metadata: {
      processedAt: new Date().toISOString(),
      executionType: 'real_operation',
      ...metadata
    }
  };

  if (success && result) {
    envelope.data.result = result;
  }

  if (!success) {
    envelope.operation.error = error || {
      message: 'Operation failed',
      code: 'OPERATION_FAILED'
    };
    envelope.data.result = null;
  }

  return envelope;
}

/**
 * Create a simulate envelope (dry-run)
 * 
 * @param {Object} options
 * @param {string} options.operation - Operation identifier
 * @param {boolean} options.wouldSucceed - Whether operation would succeed
 * @param {Object} options.simulation - Simulation details (checks, requirements, warnings)
 * @param {Object} [options.metadata] - Additional metadata
 * @param {string} [options.correlationId] - Optional correlation ID
 * @returns {Object} Simulate envelope
 */
export function createSimulateEnvelope({ operation, wouldSucceed, simulation, metadata, correlationId }) {
  return {
    envelope: {
      type: 'simulate',
      version: '1.0',
      timestamp: new Date().toISOString(),
      correlationId: correlationId || createCorrelationId()
    },
    operation: {
      id: operation,
      status: wouldSucceed ? 'success' : 'failure'
    },
    data: {
      wouldSucceed,
      simulation: simulation || {
        checks: [],
        requirements: [],
        warnings: []
      },
      dryRun: true
    },
    metadata: {
      processedAt: new Date().toISOString(),
      executionType: 'simulation',
      simulationType: 'dry_run',
      ...metadata
    }
  };
}

/**
 * Create a policy-deny envelope
 * 
 * @param {Object} options
 * @param {string} options.operation - Operation identifier
 * @param {string} options.reason - Denial reason
 * @param {Object} options.policy - Policy details (matchedRule, allowedRoles, etc.)
 * @param {Object} [options.metadata] - Additional metadata
 * @param {string} [options.correlationId] - Optional correlation ID
 * @returns {Object} Policy-deny envelope
 */
export function createPolicyDenyEnvelope({ operation, reason, policy, metadata, correlationId }) {
  return {
    envelope: {
      type: 'policy-deny',
      version: '1.0',
      timestamp: new Date().toISOString(),
      correlationId: correlationId || createCorrelationId()
    },
    operation: {
      id: operation,
      status: 'denied'
    },
    data: {
      denied: true,
      reason,
      policy: policy || {}
    },
    metadata: {
      processedAt: new Date().toISOString(),
      denialType: 'policy_enforcement',
      ...metadata
    }
  };
}

/**
 * Create an error envelope
 * 
 * @param {string} operation - Operation identifier
 * @param {string} errorCode - Error code
 * @param {string} errorMessage - Error message
 * @param {Object} [errorDetails] - Additional error details
 * @param {string} [correlationId] - Optional correlation ID
 * @returns {Object} Execute envelope with error
 */
export function createErrorEnvelope(operation, errorCode, errorMessage, errorDetails, correlationId) {
  return createExecuteEnvelope({
    operation,
    success: false,
    error: {
      message: errorMessage,
      code: errorCode,
      details: errorDetails || {}
    },
    correlationId
  });
}

/**
 * Validate envelope structure
 * 
 * @param {Object} envelope - Envelope to validate
 * @returns {Object} Validation result
 */
export function validateEnvelope(envelope) {
  const errors = [];

  // Check required top-level fields
  if (!envelope.envelope) {
    errors.push('Missing envelope field');
  } else {
    if (!envelope.envelope.type) {
      errors.push('Missing envelope.type');
    } else {
      const validTypes = ['inspect', 'execute', 'simulate', 'policy-deny'];
      if (!validTypes.includes(envelope.envelope.type)) {
        errors.push(`Invalid envelope.type: ${envelope.envelope.type}. Must be one of: ${validTypes.join(', ')}`);
      }
    }

    if (!envelope.envelope.version) {
      errors.push('Missing envelope.version');
    }

    if (!envelope.envelope.timestamp) {
      errors.push('Missing envelope.timestamp');
    }

    if (!envelope.envelope.correlationId) {
      errors.push('Missing envelope.correlationId');
    }
  }

  if (!envelope.operation) {
    errors.push('Missing operation field');
  } else {
    if (!envelope.operation.id) {
      errors.push('Missing operation.id');
    }

    if (!envelope.operation.status) {
      errors.push('Missing operation.status');
    } else {
      const validStatuses = ['success', 'failure', 'denied', 'partial'];
      if (!validStatuses.includes(envelope.operation.status)) {
        errors.push(`Invalid operation.status: ${envelope.operation.status}. Must be one of: ${validStatuses.join(', ')}`);
      }
    }
  }

  if (!envelope.data) {
    errors.push('Missing data field');
  }

  if (!envelope.metadata) {
    errors.push('Missing metadata field');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Convert envelope to audit log entry
 * 
 * @param {Object} envelope - Operation envelope
 * @param {Object} context - Additional context (userId, ipAddress, etc.)
 * @returns {Object} Audit log entry
 */
export function createAuditLogFromEnvelope(envelope, context = {}) {
  return {
    auditId: `audit-${envelope.envelope.correlationId}`,
    timestamp: envelope.envelope.timestamp,
    envelopeType: envelope.envelope.type,
    operation: envelope.operation.id,
    status: envelope.operation.status,
    success: envelope.operation.status === 'success',
    data: envelope.data,
    metadata: {
      ...envelope.metadata,
      ...context
    },
    correlationId: envelope.envelope.correlationId
  };
}
