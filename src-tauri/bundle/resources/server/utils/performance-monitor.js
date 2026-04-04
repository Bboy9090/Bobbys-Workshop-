/**
 * Performance Monitoring and Analytics
 *
 * Tracks API performance, response times, and system metrics
 */

import { createLogger } from './bundled-logger.js';

const logger = createLogger('PerformanceMonitor');

/**
 * Performance metrics storage
 */
const performanceMetrics = {
  api: {
    requests: 0,
    responses: 0,
    errors: 0,
    avgResponseTime: 0,
    percentiles: {
      p50: 0,
      p95: 0,
      p99: 0
    },
    endpointStats: new Map()
  },
  system: {
    cpuUsage: [],
    memoryUsage: [],
    uptime: 0
  },
  operations: {
    total: 0,
    successful: 0,
    failed: 0,
    avgDuration: 0
  }
};

const responseTimes = [];
const MAX_RESPONSE_TIME_SAMPLES = 1000;

/**
 * Record API request start
 */
export function recordRequestStart(req, operation = null) {
  req._startTime = process.hrtime.bigint();
  req._operation = operation;

  performanceMetrics.api.requests++;

  // Track endpoint statistics
  const endpoint = `${req.method} ${req.route?.path || req.path || 'unknown'}`;
  if (!performanceMetrics.api.endpointStats.has(endpoint)) {
    performanceMetrics.api.endpointStats.set(endpoint, {
      requests: 0,
      errors: 0,
      avgResponseTime: 0,
      totalResponseTime: 0
    });
  }

  const stats = performanceMetrics.api.endpointStats.get(endpoint);
  stats.requests++;
}

/**
 * Record API request completion
 */
export function recordRequestEnd(req, res, error = null) {
  if (!req._startTime) return;

  const endTime = process.hrtime.bigint();
  const responseTime = Number(endTime - req._startTime) / 1000000; // Convert to milliseconds

  performanceMetrics.api.responses++;

  if (error) {
    performanceMetrics.api.errors++;
  }

  // Store response time for percentile calculations
  responseTimes.push(responseTime);
  if (responseTimes.length > MAX_RESPONSE_TIME_SAMPLES) {
    responseTimes.shift(); // Remove oldest
  }

  // Update endpoint stats
  const endpoint = `${req.method} ${req.route?.path || req.path || 'unknown'}`;
  const stats = performanceMetrics.api.endpointStats.get(endpoint);
  if (stats) {
    stats.totalResponseTime += responseTime;
    stats.avgResponseTime = stats.totalResponseTime / stats.requests;

    if (error) {
      stats.errors++;
    }
  }

  // Update overall averages
  const totalRequests = performanceMetrics.api.requests;
  const totalResponseTime = Array.from(performanceMetrics.api.endpointStats.values())
    .reduce((sum, stat) => sum + stat.totalResponseTime, 0);

  performanceMetrics.api.avgResponseTime = totalResponseTime / totalRequests;

  // Log slow requests
  if (responseTime > 5000) { // 5 seconds
    logger.warn(`🐌 SLOW REQUEST: ${endpoint} took ${responseTime.toFixed(2)}ms`);
  } else if (responseTime > 30000) { // 30 seconds
    logger.error(`🚨 VERY SLOW REQUEST: ${endpoint} took ${responseTime.toFixed(2)}ms`);
  }
}

/**
 * Record operation start
 */
export function recordOperationStart(operationId, operationType) {
  performanceMetrics.operations.total++;

  return {
    operationId,
    operationType,
    startTime: Date.now()
  };
}

/**
 * Record operation completion
 */
export function recordOperationEnd(operationData, success = true, error = null) {
  const duration = Date.now() - operationData.startTime;

  if (success) {
    performanceMetrics.operations.successful++;
  } else {
    performanceMetrics.operations.failed++;
  }

  // Update average duration
  const totalOps = performanceMetrics.operations.successful + performanceMetrics.operations.failed;
  performanceMetrics.operations.avgDuration =
    (performanceMetrics.operations.avgDuration * (totalOps - 1) + duration) / totalOps;

  // Log long-running operations
  if (duration > 60000) { // 1 minute
    logger.warn(`⏰ LONG OPERATION: ${operationData.operationType} (${operationData.operationId}) took ${(duration / 1000).toFixed(1)}s`);
  }

  return {
    ...operationData,
    duration,
    success,
    error: error?.message
  };
}

/**
 * Calculate percentiles from response times
 */
function calculatePercentiles() {
  if (responseTimes.length === 0) return { p50: 0, p95: 0, p99: 0 };

  const sorted = [...responseTimes].sort((a, b) => a - b);

  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

  return { p50, p95, p99 };
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics() {
  // Update percentiles
  performanceMetrics.api.percentiles = calculatePercentiles();

  // Update system metrics
  performanceMetrics.system.uptime = process.uptime();

  // Calculate system resource usage over time
  const memUsage = process.memoryUsage();
  performanceMetrics.system.memoryUsage.push({
    timestamp: Date.now(),
    usage: memUsage.heapUsed / memUsage.heapTotal
  });

  // Keep only last 100 samples
  if (performanceMetrics.system.memoryUsage.length > 100) {
    performanceMetrics.system.memoryUsage.shift();
  }

  return {
    ...performanceMetrics,
    timestamp: new Date().toISOString(),
    summary: {
      apiHealth: performanceMetrics.api.errors / Math.max(performanceMetrics.api.requests, 1),
      avgResponseTime: performanceMetrics.api.avgResponseTime,
      operationSuccessRate: performanceMetrics.operations.successful / Math.max(performanceMetrics.operations.total, 1),
      memoryTrend: performanceMetrics.system.memoryUsage.slice(-10) // Last 10 samples
    }
  };
}

/**
 * Performance monitoring middleware
 */
export function performanceMiddleware(req, res, next) {
  recordRequestStart(req);

  // Override res.end to record completion
  const originalEnd = res.end;
  res.end = function(...args) {
    recordRequestEnd(req, res);
    originalEnd.apply(this, args);
  };

  // Also handle res.send for consistency
  const originalSend = res.send;
  res.send = function(data) {
    recordRequestEnd(req, res);
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Performance monitoring for operations
 */
export class OperationTimer {
  constructor(operationId, operationType) {
    this.operationData = recordOperationStart(operationId, operationType);
  }

  end(success = true, error = null) {
    return recordOperationEnd(this.operationData, success, error);
  }
}

/**
 * Reset performance metrics (for testing)
 */
export function resetPerformanceMetrics() {
  performanceMetrics.api.requests = 0;
  performanceMetrics.api.responses = 0;
  performanceMetrics.api.errors = 0;
  performanceMetrics.api.avgResponseTime = 0;
  performanceMetrics.api.endpointStats.clear();
  performanceMetrics.operations.total = 0;
  performanceMetrics.operations.successful = 0;
  performanceMetrics.operations.failed = 0;
  performanceMetrics.operations.avgDuration = 0;
  responseTimes.length = 0;
}

// Periodic cleanup and logging
setInterval(() => {
  const metrics = getPerformanceMetrics();

  // Log performance summary every 5 minutes
  logger.info(`📊 Performance: ${metrics.api.requests} req/min, avg ${metrics.api.avgResponseTime.toFixed(0)}ms, ${metrics.api.errors} errors`);

  // Warn on high error rates
  const errorRate = metrics.summary.apiHealth;
  if (errorRate > 0.1) { // 10% error rate
    logger.warn(`⚠️  High error rate: ${(errorRate * 100).toFixed(1)}%`);
  }

  // Warn on slow average response times
  if (metrics.summary.avgResponseTime > 2000) { // 2 seconds
    logger.warn(`🐌 Slow responses: avg ${metrics.summary.avgResponseTime.toFixed(0)}ms`);
  }

}, 300000); // Every 5 minutes