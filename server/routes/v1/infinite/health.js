/**
 * 🏆 Production-Grade Health Check for Infinite Legendary Features
 */

import express from 'express';
import infiniteResourceManager from '../../../utils/infinite/resource-manager.js';
import infiniteErrorHandler from '../../../utils/infinite/error-handler.js';
import infinitePerformanceMonitor from '../../../utils/infinite/performance-monitor.js';

const router = express.Router();

// Lazy load feature modules
let quantumOptimizer, timeSeriesForecast;
async function getFeatureAvailability() {
  if (!quantumOptimizer) {
    try {
      quantumOptimizer = (await import('../../../utils/infinite/quantum-optimizer.js')).default;
    } catch (e) {
      quantumOptimizer = { hasRealQuantum: false };
    }
  }
  
  if (!timeSeriesForecast) {
    try {
      timeSeriesForecast = (await import('../../../utils/infinite/time-series-forecast.js')).default;
    } catch (e) {
      timeSeriesForecast = { hasTensorFlow: false };
    }
  }
  
  return {
    quantum: quantumOptimizer?.hasRealQuantum ? 'available' : 'unavailable',
    forecast: timeSeriesForecast?.hasTensorFlow ? 'available' : 'fallback',
  };
}

/**
 * GET /api/v1/infinite/health
 * Comprehensive health check
 */
router.get('/health', async (req, res) => {
  try {
    const resourceUsage = infiniteResourceManager.getResourceUsage();
    const errorStats = infiniteErrorHandler.getErrorStats();
    const performance = infinitePerformanceMonitor.getPerformanceMetrics();
    const slowOperations = infinitePerformanceMonitor.getSlowOperations(1000);
    const features = await getFeatureAvailability();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      resources: {
        memory: {
          used: resourceUsage.memory,
          limit: infiniteResourceManager.resourceLimits.memory.maxMB,
          percentage: (resourceUsage.memory / infiniteResourceManager.resourceLimits.memory.maxMB) * 100,
        },
        connections: {
          active: resourceUsage.connections,
          limit: infiniteResourceManager.resourceLimits.connections.max,
          percentage: (resourceUsage.connections / infiniteResourceManager.resourceLimits.connections.max) * 100,
        },
      },
      errors: {
        total: errorStats.total,
        byFeature: errorStats.byFeature,
        recentCount: infiniteErrorHandler.getRecentErrors(10).length,
      },
      performance: {
        throughput: performance.throughput,
        slowOperations: slowOperations.length > 0 ? slowOperations : null,
      },
      features,
    };

    // Determine overall status
    if (resourceUsage.connections >= infiniteResourceManager.resourceLimits.connections.max * 0.9) {
      health.status = 'degraded';
      health.issues = ['High connection usage'];
    }

    if (errorStats.total > 0 && errorStats.total / (performance.performance.quantum.count + 1) > 0.1) {
      health.status = 'degraded';
      health.issues = [...(health.issues || []), 'High error rate'];
    }

    if (slowOperations.length > 0) {
      health.status = 'degraded';
      health.issues = [...(health.issues || []), 'Slow operations detected'];
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      envelope: {
        version: '1.0',
        operation: 'infinite_health_check',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: health,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'infinite_health_check',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/infinite/stats
 * Get comprehensive statistics
 */
router.get('/stats', (req, res) => {
  try {
    const resourceUsage = infiniteResourceManager.getResourceUsage();
    const errorStats = infiniteErrorHandler.getErrorStats();
    const performance = infinitePerformanceMonitor.getPerformanceMetrics();

    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_infinite_stats',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: {
        resources: resourceUsage,
        errors: errorStats,
        performance,
      },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_infinite_stats',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

export default router;
