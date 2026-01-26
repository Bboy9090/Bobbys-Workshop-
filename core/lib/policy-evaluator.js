/**
 * Policy Evaluator
 * 
 * Role-based authorization engine for Trapdoor operations.
 * Evaluates operation requests against role permissions and risk levels.
 * 
 * @module core/lib/policy-evaluator
 */

/**
 * Role hierarchy (highest to lowest privilege)
 */
const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  TECHNICIAN: 'technician',
  VIEWER: 'viewer'
};

/**
 * Risk levels for operations
 */
const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  DESTRUCTIVE: 'destructive'
};

/**
 * Permission matrix: role -> operation category -> allowed
 */
const PERMISSION_MATRIX = {
  [ROLES.OWNER]: {
    diagnostics: true,
    safe: true,
    backup: true,
    restore: true,
    destructive: true,
    administrative: true
  },
  [ROLES.ADMIN]: {
    diagnostics: true,
    safe: true,
    backup: true,
    restore: true,
    destructive: true, // Requires confirmation
    administrative: false // Cannot modify system settings
  },
  [ROLES.TECHNICIAN]: {
    diagnostics: true,
    safe: true,
    backup: true, // Requires confirmation
    restore: true, // Requires confirmation
    destructive: false,
    administrative: false
  },
  [ROLES.VIEWER]: {
    diagnostics: true,
    safe: false,
    backup: false,
    restore: false,
    destructive: false,
    administrative: false
  }
};

/**
 * Evaluate if a role is allowed to perform an operation
 * 
 * @param {string} role - User role (owner, admin, technician, viewer)
 * @param {Object} operationSpec - Operation specification from allowlist
 * @returns {Object} Evaluation result with allowed, reason, requiresConfirmation
 */
export function evaluatePolicy(role, operationSpec) {
  // Validate role
  if (!Object.values(ROLES).includes(role)) {
    return {
      allowed: false,
      reason: `Invalid role: ${role}`,
      requiresConfirmation: false
    };
  }

  // Check if role is in allowedRoles
  if (!operationSpec.allowedRoles || !operationSpec.allowedRoles.includes(role)) {
    return {
      allowed: false,
      reason: `Role '${role}' is not authorized for operation '${operationSpec.operation}'. Allowed roles: ${operationSpec.allowedRoles?.join(', ') || 'none'}`,
      requiresConfirmation: false,
      policy: {
        matchedRule: 'role_not_in_allowed_list',
        allowedRoles: operationSpec.allowedRoles || [],
        currentRole: role
      }
    };
  }

  // Check category permission
  const category = operationSpec.category || 'safe';
  const categoryPermission = PERMISSION_MATRIX[role]?.[category];

  if (categoryPermission === false) {
    return {
      allowed: false,
      reason: `Role '${role}' does not have permission for '${category}' operations`,
      requiresConfirmation: false,
      policy: {
        matchedRule: 'category_permission_denied',
        category,
        currentRole: role
      }
    };
  }

  // Check risk level
  const riskLevel = operationSpec.riskLevel || RISK_LEVELS.LOW;
  let requiresConfirmation = false;

  // Destructive operations require confirmation for admin
  if (riskLevel === RISK_LEVELS.DESTRUCTIVE && role === ROLES.ADMIN) {
    requiresConfirmation = true;
  }

  // High risk operations require confirmation for technician
  if (riskLevel === RISK_LEVELS.HIGH && role === ROLES.TECHNICIAN) {
    requiresConfirmation = true;
  }

  // Check operation-specific confirmation requirement
  if (operationSpec.requiresConfirmation === true) {
    requiresConfirmation = true;
  }

  return {
    allowed: true,
    reason: null,
    requiresConfirmation,
    policy: {
      matchedRule: 'allow',
      role,
      category,
      riskLevel
    }
  };
}

/**
 * Check if operation requires explicit confirmation
 * 
 * @param {string} role - User role
 * @param {Object} operationSpec - Operation specification
 * @returns {boolean}
 */
export function requiresConfirmation(role, operationSpec) {
  const evaluation = evaluatePolicy(role, operationSpec);
  return evaluation.requiresConfirmation || false;
}

/**
 * Get risk level for an operation
 * 
 * @param {Object} operationSpec - Operation specification
 * @returns {string} Risk level
 */
export function getRiskLevel(operationSpec) {
  return operationSpec.riskLevel || RISK_LEVELS.LOW;
}

/**
 * Validate operation parameters against schema
 * 
 * @param {Object} params - Operation parameters
 * @param {Object} operationSpec - Operation specification with parameter schema
 * @returns {Object} Validation result
 */
export function validateParameters(params, operationSpec) {
  const errors = [];
  const schema = operationSpec.parameters || {};

  // Check required parameters
  for (const [paramName, paramSpec] of Object.entries(schema)) {
    if (paramSpec.required && (params[paramName] === undefined || params[paramName] === null)) {
      errors.push({
        parameter: paramName,
        error: 'Required parameter missing'
      });
      continue;
    }

    // Type validation
    if (params[paramName] !== undefined && paramSpec.type) {
      const actualType = typeof params[paramName];
      const expectedType = paramSpec.type === 'integer' ? 'number' : paramSpec.type;
      
      if (actualType !== expectedType) {
        errors.push({
          parameter: paramName,
          error: `Expected type '${paramSpec.type}', got '${actualType}'`
        });
      }
    }

    // Pattern validation (for strings)
    if (params[paramName] !== undefined && paramSpec.pattern && typeof params[paramName] === 'string') {
      const regex = new RegExp(paramSpec.pattern);
      if (!regex.test(params[paramName])) {
        errors.push({
          parameter: paramName,
          error: `Parameter does not match required pattern: ${paramSpec.pattern}`
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export { ROLES, RISK_LEVELS, PERMISSION_MATRIX };
