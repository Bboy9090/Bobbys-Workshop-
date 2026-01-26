/**
 * PHOENIX CORE — Authority Routing Table
 * 
 * Centralized authority routing for all system operations.
 * Determines which subsystem handles each request based on
 * operation type, device state, user permissions, and context.
 * 
 * @module core/lib/authority-router
 */

import { ROLES, evaluatePolicy } from './policy-evaluator.js';

/**
 * Authority domains in the Phoenix Core system
 */
export const AUTHORITY_DOMAINS = {
  // Surface layer - standard user operations
  REFORGE_OS: 'reforge_os',
  
  // Operator layer - technician tools
  WORKBENCH: 'workbench',
  
  // Codex layer - analysis and recommendations
  CODEX: 'codex',
  
  // Phoenix Keys - special unlock capabilities
  PHOENIX_KEYS: 'phoenix_keys',
  
  // Trapdoor layer - contextual hidden operations
  TRAPDOOR: 'trapdoor',
  
  // System layer - internal operations
  SYSTEM: 'system',
  
  // Hardware layer - direct device communication
  BOOTFORGE: 'bootforge',
};

/**
 * Operation categories for routing
 */
export const OPERATION_CATEGORIES = {
  // Read-only operations
  DIAGNOSTIC: 'diagnostic',
  QUERY: 'query',
  
  // Standard operations
  BACKUP: 'backup',
  RESTORE: 'restore',
  TRANSFER: 'transfer',
  
  // Elevated operations
  FLASH: 'flash',
  UNLOCK: 'unlock',
  REPAIR: 'repair',
  
  // Destructive operations
  WIPE: 'wipe',
  FACTORY_RESET: 'factory_reset',
  
  // Administrative operations
  ADMIN: 'admin',
  CONFIG: 'config',
};

/**
 * Route definition for an operation
 */
class Route {
  constructor({
    pattern,
    domain,
    category,
    requiredRoles = [ROLES.TECHNICIAN, ROLES.ADMIN, ROLES.OWNER],
    requiresDevice = false,
    requiresConfirmation = false,
    handoff = null,
    conditions = [],
    metadata = {}
  }) {
    this.pattern = pattern;
    this.domain = domain;
    this.category = category;
    this.requiredRoles = requiredRoles;
    this.requiresDevice = requiresDevice;
    this.requiresConfirmation = requiresConfirmation;
    this.handoff = handoff;
    this.conditions = conditions;
    this.metadata = metadata;
  }
  
  /**
   * Check if this route matches the given operation
   */
  matches(operation) {
    if (typeof this.pattern === 'string') {
      return operation === this.pattern;
    }
    if (this.pattern instanceof RegExp) {
      return this.pattern.test(operation);
    }
    return false;
  }
  
  /**
   * Check if all conditions are satisfied
   */
  checkConditions(context) {
    return this.conditions.every(condition => condition(context));
  }
}

/**
 * Authority Router - Routes operations to appropriate domains
 */
class AuthorityRouter {
  constructor() {
    this.routes = new Map();
    this.routeList = [];
    this.routeCache = new Map();
    this.auditLog = [];
    
    // Load built-in routes
    this._loadBuiltinRoutes();
  }
  
  /**
   * Load built-in routing rules
   */
  _loadBuiltinRoutes() {
    // Diagnostic operations -> WORKBENCH (with Codex analysis)
    this.addRoute(new Route({
      pattern: /^device\.(info|status|diagnostics)/,
      domain: AUTHORITY_DOMAINS.WORKBENCH,
      category: OPERATION_CATEGORIES.DIAGNOSTIC,
      requiredRoles: [ROLES.VIEWER, ROLES.TECHNICIAN, ROLES.ADMIN, ROLES.OWNER],
      requiresDevice: true,
      handoff: AUTHORITY_DOMAINS.CODEX,
    }));
    
    // Query operations -> CODEX
    this.addRoute(new Route({
      pattern: /^codex\./,
      domain: AUTHORITY_DOMAINS.CODEX,
      category: OPERATION_CATEGORIES.QUERY,
      requiredRoles: [ROLES.TECHNICIAN, ROLES.ADMIN, ROLES.OWNER],
    }));
    
    // Backup operations -> WORKBENCH
    this.addRoute(new Route({
      pattern: /^backup\./,
      domain: AUTHORITY_DOMAINS.WORKBENCH,
      category: OPERATION_CATEGORIES.BACKUP,
      requiredRoles: [ROLES.TECHNICIAN, ROLES.ADMIN, ROLES.OWNER],
      requiresDevice: true,
    }));
    
    // Restore operations -> WORKBENCH
    this.addRoute(new Route({
      pattern: /^restore\./,
      domain: AUTHORITY_DOMAINS.WORKBENCH,
      category: OPERATION_CATEGORIES.RESTORE,
      requiredRoles: [ROLES.TECHNICIAN, ROLES.ADMIN, ROLES.OWNER],
      requiresDevice: true,
      requiresConfirmation: true,
    }));
    
    // Flash operations -> BOOTFORGE
    this.addRoute(new Route({
      pattern: /^flash\./,
      domain: AUTHORITY_DOMAINS.BOOTFORGE,
      category: OPERATION_CATEGORIES.FLASH,
      requiredRoles: [ROLES.ADMIN, ROLES.OWNER],
      requiresDevice: true,
      requiresConfirmation: true,
      conditions: [
        (ctx) => ctx.device?.mode === 'fastboot' || ctx.device?.mode === 'download',
      ],
    }));
    
    // Unlock operations -> PHOENIX_KEYS
    this.addRoute(new Route({
      pattern: /^unlock\./,
      domain: AUTHORITY_DOMAINS.PHOENIX_KEYS,
      category: OPERATION_CATEGORIES.UNLOCK,
      requiredRoles: [ROLES.ADMIN, ROLES.OWNER],
      requiresDevice: true,
      requiresConfirmation: true,
    }));
    
    // Repair operations -> WORKBENCH (with handoff to BOOTFORGE)
    this.addRoute(new Route({
      pattern: /^repair\./,
      domain: AUTHORITY_DOMAINS.WORKBENCH,
      category: OPERATION_CATEGORIES.REPAIR,
      requiredRoles: [ROLES.TECHNICIAN, ROLES.ADMIN, ROLES.OWNER],
      requiresDevice: true,
      handoff: AUTHORITY_DOMAINS.BOOTFORGE,
    }));
    
    // Wipe operations -> WORKBENCH (requires confirmation)
    this.addRoute(new Route({
      pattern: /^wipe\./,
      domain: AUTHORITY_DOMAINS.WORKBENCH,
      category: OPERATION_CATEGORIES.WIPE,
      requiredRoles: [ROLES.ADMIN, ROLES.OWNER],
      requiresDevice: true,
      requiresConfirmation: true,
    }));
    
    // Factory reset -> BOOTFORGE (destructive)
    this.addRoute(new Route({
      pattern: /^factory\.reset/,
      domain: AUTHORITY_DOMAINS.BOOTFORGE,
      category: OPERATION_CATEGORIES.FACTORY_RESET,
      requiredRoles: [ROLES.OWNER],
      requiresDevice: true,
      requiresConfirmation: true,
    }));
    
    // Admin operations -> SYSTEM
    this.addRoute(new Route({
      pattern: /^admin\./,
      domain: AUTHORITY_DOMAINS.SYSTEM,
      category: OPERATION_CATEGORIES.ADMIN,
      requiredRoles: [ROLES.ADMIN, ROLES.OWNER],
    }));
    
    // Config operations -> SYSTEM
    this.addRoute(new Route({
      pattern: /^config\./,
      domain: AUTHORITY_DOMAINS.SYSTEM,
      category: OPERATION_CATEGORIES.CONFIG,
      requiredRoles: [ROLES.ADMIN, ROLES.OWNER],
    }));
    
    // Trapdoor operations (contextual)
    this.addRoute(new Route({
      pattern: /^trapdoor\./,
      domain: AUTHORITY_DOMAINS.TRAPDOOR,
      category: OPERATION_CATEGORIES.UNLOCK,
      requiredRoles: [ROLES.ADMIN, ROLES.OWNER],
      requiresDevice: true,
      conditions: [
        // Trapdoors only available when device is in specific state
        (ctx) => ctx.device != null,
        (ctx) => ctx.session?.trapdoorEnabled === true,
        (ctx) => ctx.operator?.verified === true,
      ],
      metadata: {
        ephemeral: true,
        noCache: true,
      },
    }));
    
    // ADB operations -> WORKBENCH
    this.addRoute(new Route({
      pattern: /^adb\./,
      domain: AUTHORITY_DOMAINS.WORKBENCH,
      category: OPERATION_CATEGORIES.DIAGNOSTIC,
      requiredRoles: [ROLES.TECHNICIAN, ROLES.ADMIN, ROLES.OWNER],
      requiresDevice: true,
    }));
    
    // Fastboot operations -> BOOTFORGE
    this.addRoute(new Route({
      pattern: /^fastboot\./,
      domain: AUTHORITY_DOMAINS.BOOTFORGE,
      category: OPERATION_CATEGORIES.FLASH,
      requiredRoles: [ROLES.ADMIN, ROLES.OWNER],
      requiresDevice: true,
      conditions: [
        (ctx) => ctx.device?.mode === 'fastboot',
      ],
    }));
  }
  
  /**
   * Add a route to the router
   */
  addRoute(route) {
    const key = route.pattern.toString();
    this.routes.set(key, route);
    this.routeList.push(route);
    this.routeCache.clear(); // Invalidate cache
  }
  
  /**
   * Remove a route
   */
  removeRoute(pattern) {
    const key = pattern.toString();
    const route = this.routes.get(key);
    if (route) {
      this.routes.delete(key);
      this.routeList = this.routeList.filter(r => r !== route);
      this.routeCache.clear();
    }
  }
  
  /**
   * Route an operation to its appropriate domain
   * 
   * @param {string} operation - Operation name (e.g., 'flash.boot')
   * @param {Object} context - Routing context
   * @param {string} context.role - User role
   * @param {Object} context.device - Device state (optional)
   * @param {Object} context.session - Session info (optional)
   * @param {Object} context.operator - Operator info (optional)
   * @returns {Object} Routing result
   */
  route(operation, context = {}) {
    const startTime = Date.now();
    
    // Check cache
    const cacheKey = `${operation}:${JSON.stringify(context)}`;
    if (this.routeCache.has(cacheKey)) {
      return this.routeCache.get(cacheKey);
    }
    
    // Find matching route
    let matchedRoute = null;
    for (const route of this.routeList) {
      if (route.matches(operation)) {
        matchedRoute = route;
        break;
      }
    }
    
    // No matching route
    if (!matchedRoute) {
      return this._buildResult({
        success: false,
        operation,
        error: `No route found for operation: ${operation}`,
        domain: null,
      });
    }
    
    // Check role authorization
    const role = context.role || ROLES.VIEWER;
    if (!matchedRoute.requiredRoles.includes(role)) {
      return this._buildResult({
        success: false,
        operation,
        error: `Role '${role}' not authorized for this operation`,
        domain: matchedRoute.domain,
        requiredRoles: matchedRoute.requiredRoles,
      });
    }
    
    // Check device requirement
    if (matchedRoute.requiresDevice && !context.device) {
      return this._buildResult({
        success: false,
        operation,
        error: 'This operation requires a connected device',
        domain: matchedRoute.domain,
        requiresDevice: true,
      });
    }
    
    // Check conditions
    if (!matchedRoute.checkConditions(context)) {
      return this._buildResult({
        success: false,
        operation,
        error: 'Operation conditions not met',
        domain: matchedRoute.domain,
        conditionsFailed: true,
      });
    }
    
    // Build successful result
    const result = this._buildResult({
      success: true,
      operation,
      domain: matchedRoute.domain,
      category: matchedRoute.category,
      requiresConfirmation: matchedRoute.requiresConfirmation,
      handoff: matchedRoute.handoff,
      metadata: matchedRoute.metadata,
      routeTime: Date.now() - startTime,
    });
    
    // Cache result (unless ephemeral)
    if (!matchedRoute.metadata?.noCache) {
      this.routeCache.set(cacheKey, result);
    }
    
    // Log routing decision
    this._logRouting(operation, context, result);
    
    return result;
  }
  
  /**
   * Build a routing result object
   */
  _buildResult(data) {
    return {
      timestamp: new Date().toISOString(),
      ...data,
    };
  }
  
  /**
   * Log routing decision for audit trail
   */
  _logRouting(operation, context, result) {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      operation,
      role: context.role,
      deviceId: context.device?.id,
      domain: result.domain,
      success: result.success,
      error: result.error,
    });
    
    // Keep audit log bounded
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }
  
  /**
   * Get audit log entries
   */
  getAuditLog(options = {}) {
    let logs = [...this.auditLog];
    
    if (options.operation) {
      logs = logs.filter(l => l.operation.includes(options.operation));
    }
    if (options.domain) {
      logs = logs.filter(l => l.domain === options.domain);
    }
    if (options.success !== undefined) {
      logs = logs.filter(l => l.success === options.success);
    }
    
    const limit = options.limit || 100;
    return logs.slice(-limit);
  }
  
  /**
   * Get all registered routes
   */
  getRoutes() {
    return this.routeList.map(r => ({
      pattern: r.pattern.toString(),
      domain: r.domain,
      category: r.category,
      requiredRoles: r.requiredRoles,
      requiresDevice: r.requiresDevice,
      requiresConfirmation: r.requiresConfirmation,
    }));
  }
  
  /**
   * Check if an operation is available in the current context
   */
  isAvailable(operation, context = {}) {
    const result = this.route(operation, context);
    return result.success;
  }
  
  /**
   * Get available operations for a role
   */
  getAvailableOperations(role, context = {}) {
    const operations = [];
    
    for (const route of this.routeList) {
      if (route.requiredRoles.includes(role)) {
        const testContext = { ...context, role };
        if (!route.requiresDevice || context.device) {
          if (route.checkConditions(testContext)) {
            operations.push({
              pattern: route.pattern.toString(),
              domain: route.domain,
              category: route.category,
            });
          }
        }
      }
    }
    
    return operations;
  }
}

// Singleton instance
let routerInstance = null;

/**
 * Get the Authority Router singleton
 */
export function getAuthorityRouter() {
  if (!routerInstance) {
    routerInstance = new AuthorityRouter();
  }
  return routerInstance;
}

/**
 * Route an operation (convenience function)
 */
export function routeOperation(operation, context) {
  return getAuthorityRouter().route(operation, context);
}

export { AuthorityRouter, Route };
export default AuthorityRouter;
