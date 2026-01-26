/**
 * 🌟 World Class Universal Legend - Role-Based Access Control (RBAC)
 * 
 * Enterprise-grade RBAC system with:
 * - Roles and permissions
 * - Resource-based access control
 * - Permission inheritance
 * - Audit logging
 */

class RBAC {
  constructor() {
    this.roles = new Map();
    this.permissions = new Map();
    this.userRoles = new Map(); // userId -> [roleIds]
    this.resourcePolicies = new Map(); // resource -> policy
  }

  // Initialize default roles
  initialize() {
    // Admin role - full access
    this.createRole('admin', {
      description: 'Administrator with full access',
      permissions: ['*'], // All permissions
    });

    // Operator role - operational access
    this.createRole('operator', {
      description: 'Operator with operational access',
      permissions: [
        'devices:read',
        'devices:write',
        'flashing:execute',
        'monitoring:read',
      ],
    });

    // Viewer role - read-only access
    this.createRole('viewer', {
      description: 'Viewer with read-only access',
      permissions: [
        'devices:read',
        'monitoring:read',
        'firmware:read',
      ],
    });

    // Auditor role - audit access
    this.createRole('auditor', {
      description: 'Auditor with audit trail access',
      permissions: [
        'audit:read',
        'logs:read',
        'reports:read',
      ],
    });

    console.log('✅ RBAC system initialized with default roles');
  }

  createRole(roleId, config) {
    this.roles.set(roleId, {
      id: roleId,
      ...config,
      createdAt: new Date().toISOString(),
    });
    return roleId;
  }

  assignRole(userId, roleId) {
    if (!this.roles.has(roleId)) {
      throw new Error(`Role ${roleId} does not exist`);
    }

    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, []);
    }

    const roles = this.userRoles.get(userId);
    if (!roles.includes(roleId)) {
      roles.push(roleId);
    }

    return true;
  }

  revokeRole(userId, roleId) {
    if (!this.userRoles.has(userId)) {
      return false;
    }

    const roles = this.userRoles.get(userId);
    const index = roles.indexOf(roleId);
    if (index !== -1) {
      roles.splice(index, 1);
      return true;
    }

    return false;
  }

  hasPermission(userId, permission, resource = null) {
    // Get user roles
    const userRoles = this.userRoles.get(userId) || [];

    // Check each role
    for (const roleId of userRoles) {
      const role = this.roles.get(roleId);
      if (!role) continue;

      // Check for wildcard permission
      if (role.permissions.includes('*')) {
        return true;
      }

      // Check for exact permission
      if (role.permissions.includes(permission)) {
        // Check resource policy if provided
        if (resource) {
          return this._checkResourcePolicy(resource, permission, roleId);
        }
        return true;
      }
    }

    return false;
  }

  _checkResourcePolicy(resource, permission, roleId) {
    const policy = this.resourcePolicies.get(resource);
    if (!policy) return true; // No policy means allow

    // Check if role is allowed
    if (policy.allowedRoles && !policy.allowedRoles.includes(roleId)) {
      return false;
    }

    // Check if permission is allowed
    if (policy.allowedPermissions && !policy.allowedPermissions.includes(permission)) {
      return false;
    }

    return true;
  }

  setResourcePolicy(resource, policy) {
    this.resourcePolicies.set(resource, {
      ...policy,
      updatedAt: new Date().toISOString(),
    });
  }

  getUserRoles(userId) {
    return this.userRoles.get(userId) || [];
  }

  getRolePermissions(roleId) {
    const role = this.roles.get(roleId);
    return role ? role.permissions : [];
  }

  getAllRoles() {
    return Array.from(this.roles.values());
  }

  createPermission(permissionId, config) {
    this.permissions.set(permissionId, {
      id: permissionId,
      ...config,
      createdAt: new Date().toISOString(),
    });
    return permissionId;
  }

  getAllPermissions() {
    return Array.from(this.permissions.values());
  }
}

export default new RBAC();
