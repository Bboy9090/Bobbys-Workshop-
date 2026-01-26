/**
 * Universal Legend Status - Graceful Degradation
 * Maintain partial functionality when components fail
 * 
 * Features:
 * - Feature flags
 * - Fallback mechanisms
 * - Degraded mode operation
 * - Service health tracking
 */

import structuredLogger from '../observability/structured-logger.js';
import metricsCollector from '../observability/metrics-collector.js';

class GracefulDegradationManager {
  constructor() {
    this.serviceHealth = new Map();
    this.featureFlags = new Map();
    this.fallbacks = new Map();
    this.degradedMode = false;
  }

  /**
   * Register service health
   */
  registerService(name, healthCheck) {
    this.serviceHealth.set(name, {
      healthCheck,
      status: 'unknown',
      lastCheck: null,
      failures: 0
    });
  }

  /**
   * Check service health
   */
  async checkServiceHealth(name) {
    const service = this.serviceHealth.get(name);
    if (!service) {
      return { healthy: false, reason: 'Service not registered' };
    }

    try {
      const result = await service.healthCheck();
      service.status = result.healthy ? 'healthy' : 'unhealthy';
      service.lastCheck = Date.now();
      
      if (result.healthy) {
        service.failures = 0;
      } else {
        service.failures++;
      }
      
      return result;
    } catch (error) {
      service.status = 'unhealthy';
      service.failures++;
      service.lastCheck = Date.now();
      
      structuredLogger.error('Service health check failed', error, {
        service: name
      });
      
      return {
        healthy: false,
        reason: error.message
      };
    }
  }

  /**
   * Check all services
   */
  async checkAllServices() {
    const results = {};
    const unhealthy = [];
    
    for (const [name] of this.serviceHealth.entries()) {
      const result = await this.checkServiceHealth(name);
      results[name] = result;
      
      if (!result.healthy) {
        unhealthy.push(name);
      }
    }
    
    // Enter degraded mode if critical services are down
    if (unhealthy.length > 0) {
      this.degradedMode = true;
      structuredLogger.warn('Entering degraded mode', {
        unhealthyServices: unhealthy
      });
    } else {
      this.degradedMode = false;
    }
    
    return {
      results,
      unhealthy,
      degradedMode: this.degradedMode
    };
  }

  /**
   * Register fallback
   */
  registerFallback(operation, fallback) {
    this.fallbacks.set(operation, fallback);
  }

  /**
   * Execute with fallback
   */
  async executeWithFallback(operation, primary, ...args) {
    try {
      return await primary(...args);
    } catch (error) {
      structuredLogger.warn('Primary operation failed, using fallback', {
        operation,
        error: error.message
      });
      
      const fallback = this.fallbacks.get(operation);
      if (fallback) {
        try {
          metricsCollector.incrementCounter('fallback_used_total', {
            operation
          });
          return await fallback(...args);
        } catch (fallbackError) {
          structuredLogger.error('Fallback also failed', fallbackError, {
            operation
          });
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Set feature flag
   */
  setFeatureFlag(feature, enabled) {
    this.featureFlags.set(feature, enabled);
    structuredLogger.info('Feature flag updated', {
      feature,
      enabled
    });
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature) {
    return this.featureFlags.get(feature) !== false; // Default to enabled
  }

  /**
   * Get degradation status
   */
  getStatus() {
    return {
      degradedMode: this.degradedMode,
      services: Array.from(this.serviceHealth.entries()).map(([name, service]) => ({
        name,
        status: service.status,
        failures: service.failures,
        lastCheck: service.lastCheck
      })),
      featureFlags: Object.fromEntries(this.featureFlags.entries())
    };
  }
}

// Singleton instance
const gracefulDegradation = new GracefulDegradationManager();

export default gracefulDegradation;
