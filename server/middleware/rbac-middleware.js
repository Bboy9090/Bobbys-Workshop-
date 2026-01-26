/**
 * 🌟 World Class Universal Legend - RBAC Middleware
 * 
 * Middleware to enforce role-based access control
 */

import rbac from '../utils/world-class/rbac.js';
import auditTrail from '../utils/world-class/audit-trail.js';

export function requirePermission(permission, resource = null) {
  return async (req, res, next) => {
    // Get user ID from request (should be set by auth middleware)
    const userId = req.user?.id || req.headers['x-user-id'] || 'anonymous';

    // Check permission
    const hasAccess = rbac.hasPermission(userId, permission, resource);

    if (!hasAccess) {
      // Log denied access
      await auditTrail.logResourceAccess(userId, resource || req.path, permission, 'denied');

      return res.status(403).json({
        envelope: {
          version: '1.0',
          operation: req.path,
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        error: {
          message: 'Access denied',
          code: 'PERMISSION_DENIED',
          permission,
          resource: resource || req.path,
        },
      });
    }

    // Log allowed access
    await auditTrail.logResourceAccess(userId, resource || req.path, permission, 'allowed');

    next();
  };
}

export function requireRole(...roles) {
  return async (req, res, next) => {
    const userId = req.user?.id || req.headers['x-user-id'] || 'anonymous';
    const userRoles = rbac.getUserRoles(userId);

    const hasRole = roles.some(role => userRoles.includes(role));

    if (!hasRole) {
      await auditTrail.logResourceAccess(userId, req.path, 'role_check', 'denied');

      return res.status(403).json({
        envelope: {
          version: '1.0',
          operation: req.path,
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        error: {
          message: 'Insufficient role permissions',
          code: 'ROLE_DENIED',
          requiredRoles: roles,
          userRoles,
        },
      });
    }

    next();
  };
}
