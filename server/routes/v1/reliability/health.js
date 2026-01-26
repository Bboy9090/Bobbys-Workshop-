/**
 * Universal Legend Status - Enhanced Health Check API
 * Comprehensive system health monitoring
 */

import express from 'express';
import { getHealthStatus, getEnhancedCircuitBreakerStatus } from '../../../utils/retry-circuit-breaker.js';
import autoRecovery from '../../../utils/reliability/auto-recovery.js';
import gracefulDegradation from '../../../utils/reliability/graceful-degradation.js';
import { getResourceStatus } from '../../../utils/resource-limits.js';
import { getValidationResults } from '../../../utils/startup-validation.js';

const router = express.Router();

/**
 * GET /api/v1/reliability/health
 * Get comprehensive health status
 */
router.get('/health', async (req, res) => {
  try {
    // Get all health information
    const circuitBreakers = getEnhancedCircuitBreakerStatus();
    const recoveryStats = autoRecovery.getStats();
    const degradationStatus = gracefulDegradation.getStatus();
    const resourceStatus = getResourceStatus();
    const validationResults = getValidationResults();
    
    // Determine overall health
    const overall = determineOverallHealth({
      circuitBreakers,
      degradationStatus,
      resourceStatus,
      validationResults
    });
    
    res.json({
      ok: true,
      data: {
        overall,
        circuitBreakers,
        recovery: recoveryStats,
        degradation: degradationStatus,
        resources: resourceStatus,
        validation: validationResults,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get health status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/reliability/health/circuit-breakers
 * Get circuit breaker status
 */
router.get('/health/circuit-breakers', (req, res) => {
  try {
    const status = getEnhancedCircuitBreakerStatus();
    res.json({
      ok: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get circuit breaker status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/reliability/health/recovery
 * Get auto-recovery statistics
 */
router.get('/health/recovery', (req, res) => {
  try {
    const stats = autoRecovery.getStats();
    res.json({
      ok: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get recovery statistics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/reliability/health/degradation
 * Get graceful degradation status
 */
router.get('/health/degradation', async (req, res) => {
  try {
    // Check all services
    await gracefulDegradation.checkAllServices();
    const status = gracefulDegradation.getStatus();
    
    res.json({
      ok: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get degradation status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Determine overall health
 */
function determineOverallHealth({ circuitBreakers, degradationStatus, resourceStatus, validationResults }) {
  let status = 'healthy';
  const issues = [];
  
  // Check circuit breakers
  if (circuitBreakers.unhealthyCount > 0) {
    status = 'degraded';
    issues.push(`${circuitBreakers.unhealthyCount} circuit breaker(s) open`);
  }
  
  // Check degradation mode
  if (degradationStatus.degradedMode) {
    status = 'degraded';
    issues.push('System in degraded mode');
  }
  
  // Check resources
  if (resourceStatus && resourceStatus.available === 0) {
    status = 'degraded';
    issues.push('No resources available');
  }
  
  // Check validation
  if (validationResults && !validationResults.passed) {
    status = 'degraded';
    issues.push('Validation failures detected');
  }
  
  return {
    status,
    issues,
    timestamp: new Date().toISOString()
  };
}

export default router;
