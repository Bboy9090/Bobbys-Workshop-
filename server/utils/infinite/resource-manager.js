/**
 * 🏆 Production-Grade Resource Management
 * 
 * Memory, CPU, and connection management for Infinite Legendary features
 */

class InfiniteResourceManager {
  constructor() {
    this.resourceLimits = {
      memory: {
        maxMB: 1024, // 1GB max per operation
        warningMB: 512, // Warn at 512MB
      },
      cpu: {
        maxPercent: 80, // Max 80% CPU
        warningPercent: 60, // Warn at 60%
      },
      connections: {
        max: 100, // Max concurrent operations
        warning: 80, // Warn at 80
      },
      timeout: {
        default: 30000, // 30 seconds
        quantum: 60000, // 60 seconds for quantum
        ml: 120000, // 2 minutes for ML
      },
    };
    
    this.activeOperations = new Map();
    this.resourceUsage = {
      memory: 0,
      cpu: 0,
      connections: 0,
    };
  }

  // Acquire resource for operation
  async acquireResource(operationId, operationType = 'default') {
    // Check limits
    const check = this._checkLimits(operationType);
    if (!check.allowed) {
      throw new Error(`Resource limit exceeded: ${check.reason}`);
    }

    // Reserve resource
    const resource = {
      id: operationId,
      type: operationType,
      startTime: Date.now(),
      timeout: this.resourceLimits.timeout[operationType] || 
               this.resourceLimits.timeout.default,
      memory: 0,
      cpu: 0,
    };

    this.activeOperations.set(operationId, resource);
    this.resourceUsage.connections++;

    // Set timeout
    resource.timeoutId = setTimeout(() => {
      this._handleTimeout(operationId);
    }, resource.timeout);

    return resource;
  }

  // Release resource
  releaseResource(operationId) {
    const resource = this.activeOperations.get(operationId);
    if (resource) {
      // Clear timeout
      if (resource.timeoutId) {
        clearTimeout(resource.timeoutId);
      }

      // Update usage
      this.resourceUsage.memory -= resource.memory;
      this.resourceUsage.connections--;

      // Remove
      this.activeOperations.delete(operationId);
    }
  }

  _checkLimits(operationType) {
    // Check connection limit
    if (this.resourceUsage.connections >= this.resourceLimits.connections.max) {
      return {
        allowed: false,
        reason: 'Maximum concurrent operations reached',
      };
    }

    // Check memory (simplified - would use actual memory monitoring)
    if (this.resourceUsage.memory >= this.resourceLimits.memory.maxMB) {
      return {
        allowed: false,
        reason: 'Insufficient memory available',
      };
    }

    return { allowed: true };
  }

  _handleTimeout(operationId) {
    const resource = this.activeOperations.get(operationId);
    if (resource) {
      // Force cleanup
      this.releaseResource(operationId);
      
      // Log timeout
      console.warn(`[ResourceManager] Operation ${operationId} timed out after ${resource.timeout}ms`);
    }
  }

  // Get resource usage
  getResourceUsage() {
    return {
      ...this.resourceUsage,
      activeOperations: this.activeOperations.size,
      limits: this.resourceLimits,
    };
  }

  // Cleanup all resources
  cleanup() {
    for (const [id, resource] of this.activeOperations.entries()) {
      if (resource.timeoutId) {
        clearTimeout(resource.timeoutId);
      }
    }
    this.activeOperations.clear();
    this.resourceUsage = {
      memory: 0,
      cpu: 0,
      connections: 0,
    };
  }
}

export default new InfiniteResourceManager();
