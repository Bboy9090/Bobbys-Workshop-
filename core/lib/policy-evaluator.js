/**
 * Policy Evaluator
 * 
 * Role-based authorization engine for Trapdoor operations.
 * Evaluates operation requests against role permissions and risk levels.
 * 
 * @module core/lib/policy-evaluator
 */

const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  TECHNICIAN: 'technician',
  VIEWER: 'viewer'
};

const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  DESTRUCTIVE: 'destructive'
};

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
    destructive: true,
    administrative: false
  },
  [ROLES.TECHNICIAN]: {
    diagnostics: true,
    safe: true,
    backup: true,
    restore: true,
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

export function evaluatePolicy(role, operationSpec) {
  if (!Object.values(ROLES).includes(role)) {
    return {
      allowed: false,
      reason: `Invalid role: ${role}`,
      requiresConfirmation: false
    };
  }

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

  const riskLevel = operationSpec.riskLevel || RISK_LEVELS.LOW;
  let requiresConfirmation = false;

  if (riskLevel === RISK_LEVELS.DESTRUCTIVE && role === ROLES.ADMIN) {
    requiresConfirmation = true;
  }

  if (riskLevel === RISK_LEVELS.HIGH && role === ROLES.TECHNICIAN) {
    requiresConfirmation = true;
  }

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

export function requiresConfirmation(role, operationSpec) {
  const evaluation = evaluatePolicy(role, operationSpec);
  return evaluation.requiresConfirmation || false;
}

export function getRiskLevel(operationSpec) {
  return operationSpec.riskLevel || RISK_LEVELS.LOW;
}

export function validateParameters(params, operationSpec) {
  const errors = [];
  const schema = operationSpec.parameters || {};

  for (const [paramName, paramSpec] of Object.entries(schema)) {
    if (paramSpec.required && (params[paramName] === undefined || params[paramName] === null)) {
      errors.push({
        parameter: paramName,
        error: 'Required parameter missing'
      });
      continue;
    }

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
