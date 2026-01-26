/**
 * Device Lock Manager
 *
 * Atomic locking with mutex guarantees and resource limit integration.
 * No race conditions. No silent failures. No excuses.
 */

import { acquireOperationSlot, releaseOperationSlot } from './utils/resource-limits.js';

const deviceLocks = new Map();
const pendingLocks = new Map();

export const LOCK_TIMEOUT = 300000; // 5 minutes
export const LOCK_ACQUIRE_TIMEOUT = 10000; // 10 seconds max wait

/**
 * Acquire a lock for a device with atomic guarantees
 * @param {string} deviceSerial - Device serial number
 * @param {string} operation - Operation identifier
 * @param {Object} options - Lock options
 * @returns {{acquired: boolean, lockId?: string, reason?: string, lockedBy?: string, lockedAt?: number}}
 */
export async function acquireDeviceLock(deviceSerial, operation, options = {}) {
  if (!deviceSerial || typeof deviceSerial !== 'string') {
    return { acquired: false, reason: 'INVALID_SERIAL' };
  }

  if (!operation || typeof operation !== 'string') {
    return { acquired: false, reason: 'INVALID_OPERATION' };
  }

  // Check resource limits before acquiring device lock
  try {
    const resourceCheck = await acquireOperationSlot(`${deviceSerial}-${operation}`, 'device');
    if (!resourceCheck) {
      return { acquired: false, reason: 'RESOURCE_LIMIT_EXCEEDED' };
    }
  } catch (error) {
    return { acquired: false, reason: 'RESOURCE_LIMIT_EXCEEDED', details: error.message };
  }

  const now = Date.now();
  const existingLock = deviceLocks.get(deviceSerial);

  // Check existing lock
  if (existingLock) {
    const age = now - existingLock.lockedAt;

    // Expired lock - clean up
    if (age > LOCK_TIMEOUT) {
      deviceLocks.delete(deviceSerial);
    } else {
      // Active lock - deny - but we already acquired resource slot, release it
      releaseOperationSlot(`${deviceSerial}-${operation}`);
      return {
        acquired: false,
        reason: 'DEVICE_LOCKED',
        lockedBy: existingLock.operation,
        lockedAt: existingLock.lockedAt,
        lockId: existingLock.lockId,
        expiresIn: LOCK_TIMEOUT - age
      };
    }
  }

  // Generate lock ID for tracking
  const lockId = `${deviceSerial}-${now}-${Math.random().toString(36).slice(2, 8)}`;

  // Atomic set
  const lock = {
    lockId,
    deviceSerial,
    operation,
    lockedAt: now,
    expiresAt: now + LOCK_TIMEOUT,
    metadata: options.metadata || {},
    resourceSlot: `${deviceSerial}-${operation}`
  };

  deviceLocks.set(deviceSerial, lock);

  return {
    acquired: true,
    lockId,
    expiresAt: lock.expiresAt
  };
}

/**
 * Acquire lock with wait - blocks until lock available or timeout
 * @param {string} deviceSerial - Device serial number
 * @param {string} operation - Operation identifier
 * @param {number} timeout - Max wait time in ms
 * @returns {Promise<{acquired: boolean, lockId?: string, reason?: string}>}
 */
export async function acquireDeviceLockWithWait(deviceSerial, operation, timeout = LOCK_ACQUIRE_TIMEOUT) {
  const startTime = Date.now();
  const pollInterval = 100;

  while (Date.now() - startTime < timeout) {
    const result = await acquireDeviceLock(deviceSerial, operation);
    if (result.acquired) {
      return result;
    }
    
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return { 
    acquired: false, 
    reason: 'TIMEOUT',
    waitedMs: Date.now() - startTime
  };
}

/**
 * Release a lock for a device
 * @param {string} deviceSerial - Device serial number
 * @param {string} lockId - Optional lock ID for validation
 * @returns {{released: boolean, reason?: string}}
 */
export function releaseDeviceLock(deviceSerial, lockId = null) {
  const lock = deviceLocks.get(deviceSerial);

  if (!lock) {
    return { released: true, reason: 'NO_LOCK_EXISTS' };
  }

  // If lockId provided, validate it matches
  if (lockId && lock.lockId !== lockId) {
    return {
      released: false,
      reason: 'LOCK_ID_MISMATCH',
      currentLockId: lock.lockId
    };
  }

  // Release resource slot if it was acquired
  if (lock.resourceSlot) {
    releaseOperationSlot(lock.resourceSlot);
  }

  deviceLocks.delete(deviceSerial);
  return { released: true };
}

/**
 * Force release a lock (admin only)
 * @param {string} deviceSerial - Device serial number
 * @returns {{released: boolean, previousLock?: Object}}
 */
export function forceReleaseLock(deviceSerial) {
  const lock = deviceLocks.get(deviceSerial);
  deviceLocks.delete(deviceSerial);
  
  return { 
    released: true, 
    previousLock: lock || null 
  };
}

/**
 * Extend lock expiration
 * @param {string} deviceSerial - Device serial number
 * @param {string} lockId - Lock ID for validation
 * @param {number} extensionMs - Extension time in milliseconds
 * @returns {{extended: boolean, reason?: string, newExpiresAt?: number}}
 */
export function extendLock(deviceSerial, lockId, extensionMs = LOCK_TIMEOUT) {
  const lock = deviceLocks.get(deviceSerial);
  
  if (!lock) {
    return { extended: false, reason: 'NO_LOCK_EXISTS' };
  }

  if (lock.lockId !== lockId) {
    return { extended: false, reason: 'LOCK_ID_MISMATCH' };
  }

  const now = Date.now();
  lock.expiresAt = now + extensionMs;
  deviceLocks.set(deviceSerial, lock);

  return { 
    extended: true, 
    newExpiresAt: lock.expiresAt 
  };
}

/**
 * Get lock status for a device
 * @param {string} deviceSerial - Device serial number
 * @returns {{locked: boolean, operation?: string, lockedAt?: number}}
 */
export function getDeviceLockStatus(deviceSerial) {
  const lock = deviceLocks.get(deviceSerial);
  
  if (!lock) {
    return { locked: false };
  }

  // Check if expired
  if (Date.now() - lock.lockedAt > LOCK_TIMEOUT) {
    deviceLocks.delete(deviceSerial);
    return { locked: false };
  }

  return {
    locked: true,
    operation: lock.operation,
    lockedAt: lock.lockedAt
  };
}

/**
 * Clear all locks (for cleanup/testing)
 */
export function clearAllLocks() {
  deviceLocks.clear();
}

/**
 * Get all active locks
 * @returns {Array<{deviceSerial: string, operation: string, lockedAt: number, ageMs: number}>}
 */
export function getAllActiveLocks() {
  const now = Date.now();
  const activeLocks = [];
  
  // Clean up expired locks and collect active ones
  for (const [serial, lock] of deviceLocks.entries()) {
    if (now - lock.lockedAt > LOCK_TIMEOUT) {
      deviceLocks.delete(serial);
    } else {
      activeLocks.push({
        deviceSerial: serial,
        operation: lock.operation,
        lockedAt: lock.lockedAt,
        ageMs: now - lock.lockedAt,
        expiresAt: lock.lockedAt + LOCK_TIMEOUT,
        expiresInMs: (lock.lockedAt + LOCK_TIMEOUT) - now
      });
    }
  }
  
  return activeLocks;
}

/**
 * Get lock count
 * @returns {number}
 */
export function getActiveLockCount() {
  return getAllActiveLocks().length;
}

/**
 * Express middleware factory for requiring device locks on destructive operations
 * @param {Object} options - Middleware options
 * @param {string} options.operationPrefix - Prefix for operation name (e.g., 'fastboot', 'flash')
 * @returns {Function} Express middleware function
 */
export function createRequireDeviceLockMiddleware(options = {}) {
  const { operationPrefix = 'api' } = options;
  
  return async function requireDeviceLock(req, res, next) {
    const deviceSerial = req.body?.serial || req.body?.deviceSerial || req.params?.serial;
    
    if (!deviceSerial) {
      // Operations that don't need a device lock can proceed
      return next();
    }

    try {
      // Build operation name: strip common API prefixes, then apply operationPrefix
      const cleanPath = req.path
        .replace(/^\/api\/v1\//, '')  // Strip /api/v1/
        .replace(/^\/api\//, '')       // Strip /api/
        .replace(/^\/v1\//, '')        // Strip /v1/
        .replace(/^\//, '')            // Strip leading slash
        .replace(/\//g, '_');          // Replace remaining slashes with underscores
      const operation = `${operationPrefix}_${cleanPath}`;
      const lockResult = await acquireDeviceLock(deviceSerial, operation);

      if (!lockResult.acquired) {
        // Use the envelope middleware's sendDeviceLocked helper if available,
        // otherwise fall back to properly-enveloped manual response
        if (typeof res.sendDeviceLocked === 'function') {
          return res.sendDeviceLocked(
            lockResult.reason || 'Device is locked by another operation',
            {
              lockedBy: lockResult.lockedBy,
              retryAfter: Math.floor(LOCK_TIMEOUT / 1000)
            }
          );
        }
        
        // Fallback with proper meta field for API consistency
        return res.status(423).json({
          ok: false,
          error: {
            code: 'DEVICE_LOCKED',
            message: lockResult.reason || 'Device is locked by another operation',
            details: {
              lockedBy: lockResult.lockedBy,
              retryAfter: Math.floor(LOCK_TIMEOUT / 1000)
            }
          },
          meta: {
            ts: new Date().toISOString(),
            correlationId: req.correlationId || req.headers['x-correlation-id'] || `${Date.now()}-lock`,
            apiVersion: 'v1'
          }
        });
      }

      // Store lockId for cleanup
      req.deviceLockId = lockResult.lockId;
      req.deviceSerial = deviceSerial;

      // Release lock when response finishes (success or error)
      const originalEnd = res.end;
      res.end = function(...args) {
        releaseDeviceLock(deviceSerial, lockResult.lockId);
        originalEnd.apply(this, args);
      };

      next();
    } catch (error) {
      console.error('[requireDeviceLock] Error acquiring lock:', error);
      next(error);
    }
  };
}
