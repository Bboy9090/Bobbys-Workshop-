/**
 * Resource Limits and Graceful Degradation
 *
 * Monitors system resources and implements graceful degradation when limits are exceeded
 */

import { createLogger } from './bundled-logger.js';

const logger = createLogger('ResourceLimits');

/**
 * Resource limits configuration
 */
const RESOURCE_LIMITS = {
  maxConcurrentOperations: 10,    // Maximum concurrent device operations
  maxActiveDownloads: 3,          // Maximum concurrent firmware downloads
  maxMemoryUsage: 0.8,            // 80% of available memory
  maxCpuUsage: 0.9,               // 90% CPU usage
  maxDiskUsage: 0.95,             // 95% disk usage
  operationTimeout: 300000,       // 5 minutes default timeout
  downloadTimeout: 1800000,       // 30 minutes for downloads
  circuitBreakerResetTime: 300000 // 5 minutes
};

/**
 * System state tracking
 */
let systemState = {
  concurrentOperations: 0,
  activeDownloads: 0,
  memoryPressure: false,
  cpuPressure: false,
  diskPressure: false,
  degradedMode: false,
  lastResourceCheck: Date.now()
};

/**
 * Operation tracking
 */
const activeOperations = new Map();
const operationQueue = [];

/**
 * Check system resources
 */
async function checkSystemResources() {
  try {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();

    // Memory check
    const memoryUsagePercent = memUsage.heapUsed / totalMemory;
    systemState.memoryPressure = memoryUsagePercent > RESOURCE_LIMITS.maxMemoryUsage;

    // CPU check (simplified - in production you'd use a proper CPU monitoring library)
    systemState.cpuPressure = false; // Placeholder

    // Disk check (simplified - check log directory)
    try {
      const fs = require('fs');
      const stats = fs.statSync(require('fs').constants ? process.cwd() : '/tmp');
      // This is a simplified check - in production you'd check actual disk usage
      systemState.diskPressure = false;
    } catch (error) {
      systemState.diskPressure = true;
    }

    // Overall degradation state
    systemState.degradedMode = systemState.memoryPressure ||
                              systemState.cpuPressure ||
                              systemState.diskPressure;

    systemState.lastResourceCheck = Date.now();

    if (systemState.degradedMode) {
      logger.warn(`System under resource pressure: Memory=${(memoryUsagePercent*100).toFixed(1)}%, Degraded mode activated`);
    }

    return systemState;
  } catch (error) {
    logger.error(`Resource check failed: ${error.message}`);
    // Assume degraded mode on check failure
    systemState.degradedMode = true;
    return systemState;
  }
}

/**
 * Acquire operation slot with resource checking
 */
export async function acquireOperationSlot(operationId, operationType = 'device') {
  // Check resources first
  await checkSystemResources();

  // If system is under pressure, limit concurrent operations
  const maxOps = systemState.degradedMode ?
    Math.floor(RESOURCE_LIMITS.maxConcurrentOperations / 2) :
    RESOURCE_LIMITS.maxConcurrentOperations;

  if (systemState.concurrentOperations >= maxOps) {
    if (operationQueue.length >= 5) {
      throw new Error('Operation queue full - system under heavy load');
    }

    // Queue the operation
    return new Promise((resolve, reject) => {
      operationQueue.push({
        operationId,
        operationType,
        resolve,
        reject,
        queuedAt: Date.now()
      });

      logger.info(`Operation ${operationId} queued (position: ${operationQueue.length})`);
    });
  }

  // Acquire slot
  systemState.concurrentOperations++;
  activeOperations.set(operationId, {
    type: operationType,
    startTime: Date.now()
  });

  logger.debug(`Operation slot acquired: ${operationId} (${systemState.concurrentOperations}/${maxOps})`);
  return { operationId, degradedMode: systemState.degradedMode };
}

/**
 * Release operation slot
 */
export function releaseOperationSlot(operationId) {
  if (activeOperations.has(operationId)) {
    systemState.concurrentOperations--;
    activeOperations.delete(operationId);

    logger.debug(`Operation slot released: ${operationId} (${systemState.concurrentOperations} active)`);

    // Process next queued operation if any
    if (operationQueue.length > 0) {
      const nextOp = operationQueue.shift();
      systemState.concurrentOperations++;
      activeOperations.set(nextOp.operationId, {
        type: nextOp.operationType,
        startTime: Date.now()
      });

      logger.info(`Dequeued operation: ${nextOp.operationId}`);
      nextOp.resolve({
        operationId: nextOp.operationId,
        degradedMode: systemState.degradedMode
      });
    }
  }
}

/**
 * Check if operation should be allowed based on resource limits
 */
export async function canExecuteOperation(operationType = 'device') {
  await checkSystemResources();

  const checks = {
    operationLimit: systemState.concurrentOperations < RESOURCE_LIMITS.maxConcurrentOperations,
    memoryOk: !systemState.memoryPressure,
    cpuOk: !systemState.cpuPressure,
    diskOk: !systemState.diskPressure
  };

  const allowed = Object.values(checks).every(check => check);

  if (!allowed) {
    logger.warn(`Operation blocked due to resource limits: ${JSON.stringify(checks)}`);
  }

  return {
    allowed,
    checks,
    degradedMode: systemState.degradedMode,
    reason: allowed ? null : 'System resource limits exceeded'
  };
}

/**
 * Get adjusted timeout based on system state
 */
export function getAdjustedTimeout(baseTimeout, operationType = 'device') {
  if (systemState.degradedMode) {
    // Reduce timeouts in degraded mode
    return Math.max(baseTimeout * 0.5, 30000); // Minimum 30 seconds
  }
  return baseTimeout;
}

/**
 * Get system resource status for monitoring
 */
export async function getResourceStatus() {
  await checkSystemResources();

  return {
    systemState,
    activeOperations: Array.from(activeOperations.entries()).map(([id, info]) => ({
      id,
      ...info,
      duration: Date.now() - info.startTime
    })),
    queuedOperations: operationQueue.length,
    resourceLimits: RESOURCE_LIMITS,
    timestamp: new Date().toISOString()
  };
}

/**
 * Force cleanup of stuck operations (emergency recovery)
 */
export function forceCleanup(maxAge = 600000) { // 10 minutes default
  const now = Date.now();
  let cleaned = 0;

  for (const [operationId, info] of activeOperations.entries()) {
    if (now - info.startTime > maxAge) {
      releaseOperationSlot(operationId);
      logger.warn(`Force cleaned stuck operation: ${operationId} (${Math.round((now - info.startTime) / 1000)}s old)`);
      cleaned++;
    }
  }

  return cleaned;
}

// Periodic cleanup of stuck operations
setInterval(() => {
  const cleaned = forceCleanup(900000); // 15 minutes
  if (cleaned > 0) {
    logger.info(`Periodic cleanup removed ${cleaned} stuck operations`);
  }
}, 300000); // Check every 5 minutes

// Periodic resource monitoring
setInterval(async () => {
  await checkSystemResources();
}, 60000); // Check every minute

export { RESOURCE_LIMITS };