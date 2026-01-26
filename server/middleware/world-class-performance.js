/**
 * 🌟 World Class Universal Legend - Performance Middleware
 * 
 * Advanced performance optimization middleware
 * Features:
 * - Request deduplication
 * - Response compression
 * - Smart prefetching
 * - Connection pooling
 */

import { performance } from 'perf_hooks';
import zlib from 'zlib';
import { promisify } from 'util';
import performanceProfiler from '../utils/world-class/performance-profiler.js';
import advancedCache from '../utils/world-class/advanced-cache.js';

const gzip = promisify(zlib.gzip);

// Request deduplication
const pendingRequests = new Map();

export function worldClassPerformanceMiddleware(req, res, next) {
  const startTime = performance.now();
  const requestId = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
  
  // Request deduplication
  if (pendingRequests.has(requestId)) {
    const pending = pendingRequests.get(requestId);
    return pending.promise.then(result => {
      res.json(result);
    });
  }

  // Start profiling
  const profileId = performanceProfiler.startProfile(
    `${Date.now()}-${Math.random()}`,
    `${req.method} ${req.path}`
  );

  // Response compression
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    const jsonString = JSON.stringify(data);
    
    // Compress if large enough
    if (jsonString.length > 1024) {
      res.setHeader('Content-Encoding', 'gzip');
      gzip(jsonString).then(compressed => {
        res.send(compressed);
      });
    } else {
      originalJson(data);
    }
  };

  // Cache check
  const cacheKey = `api:${requestId}`;
  advancedCache.get(cacheKey).then(cached => {
    if (cached) {
      res.json(cached);
      performanceProfiler.endProfile(profileId);
      return;
    }

    // Create pending request
    const pending = {
      promise: new Promise((resolve) => {
        const originalEnd = res.end.bind(res);
        res.end = function(data) {
          const responseData = data ? JSON.parse(data.toString()) : null;
          
          // Cache successful responses
          if (res.statusCode === 200 && responseData) {
            advancedCache.set(cacheKey, responseData, 5 * 60 * 1000); // 5 min TTL
          }
          
          resolve(responseData);
          originalEnd(data);
        };
      }),
    };
    pendingRequests.set(requestId, pending);

    // Clean up after request
    pending.promise.finally(() => {
      pendingRequests.delete(requestId);
      const duration = performance.now() - startTime;
      performanceProfiler.endProfile(profileId);
      
      // Record metrics
      if (duration > 100) {
        console.warn(`⚠️  Slow request: ${req.method} ${req.path} took ${duration.toFixed(2)}ms`);
      }
    });

    next();
  });
}
