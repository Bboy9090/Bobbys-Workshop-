/**
 * 🌟 World Class Universal Legend - Performance API
 * 
 * Performance monitoring and optimization endpoints
 */

import express from 'express';
import performanceProfiler from '../../../utils/world-class/performance-profiler.js';
import advancedCache from '../../../utils/world-class/advanced-cache.js';

const router = express.Router();

/**
 * GET /api/v1/world-class/performance/stats
 * Get performance statistics
 */
router.get('/stats', (req, res) => {
  try {
    const profilerStats = performanceProfiler.getStats();
    const cacheStats = advancedCache.getStats();
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_performance_stats',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: {
        profiler: profilerStats,
        cache: cacheStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_performance_stats',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: {
        message: error.message,
        code: 'PERFORMANCE_STATS_ERROR',
      },
    });
  }
});

/**
 * GET /api/v1/world-class/performance/slow-requests
 * Get slow request profiles
 */
router.get('/slow-requests', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const slowRequests = performanceProfiler.getSlowRequests(limit);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_slow_requests',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: {
        slowRequests,
        count: slowRequests.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_slow_requests',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: {
        message: error.message,
        code: 'SLOW_REQUESTS_ERROR',
      },
    });
  }
});

/**
 * GET /api/v1/world-class/performance/recommendations
 * Get performance recommendations
 */
router.get('/recommendations', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const recommendations = performanceProfiler.getRecommendations(limit);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_performance_recommendations',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: {
        recommendations,
        count: recommendations.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_performance_recommendations',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: {
        message: error.message,
        code: 'RECOMMENDATIONS_ERROR',
      },
    });
  }
});

/**
 * GET /api/v1/world-class/performance/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', (req, res) => {
  try {
    const stats = advancedCache.getStats();
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_cache_stats',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_cache_stats',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: {
        message: error.message,
        code: 'CACHE_STATS_ERROR',
      },
    });
  }
});

/**
 * POST /api/v1/world-class/performance/cache/clear
 * Clear cache
 */
router.post('/cache/clear', async (req, res) => {
  try {
    await advancedCache.clear();
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'clear_cache',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: {
        message: 'Cache cleared successfully',
      },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'clear_cache',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: {
        message: error.message,
        code: 'CACHE_CLEAR_ERROR',
      },
    });
  }
});

export default router;
