/**
 * Trapdoor Authentication Middleware
 * 
 * Secret Room access control with session tokens.
 * Short-lived access. Active audit logging. No shortcuts.
 * 
 * @module trapdoor-auth
 */

import crypto from 'crypto';

// Session store for short-lived tokens
const sessionStore = new Map();

// Session configuration
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS = 10;
const FAILED_ATTEMPT_LIMIT = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Track failed attempts
const failedAttempts = new Map();

/**
 * Get trapdoor passcode from environment
 */
function getTrapdoorPasscode() {
  return process.env.SECRET_ROOM_PASSCODE || process.env.TRAPDOOR_PASSCODE || null;
}

/**
 * Generate secure session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create new session
 */
export function createSession(clientId) {
  // Clean expired sessions
  cleanExpiredSessions();
  
  // Check max sessions
  if (sessionStore.size >= MAX_SESSIONS) {
    // Remove oldest session
    const oldest = [...sessionStore.entries()]
      .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (oldest) {
      sessionStore.delete(oldest[0]);
    }
  }
  
  const token = generateSessionToken();
  const session = {
    token,
    clientId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
    lastActivity: Date.now(),
    operations: []
  };
  
  sessionStore.set(token, session);
  
  return {
    token,
    expiresAt: session.expiresAt,
    ttl: SESSION_TTL
  };
}

/**
 * Validate session token
 */
export function validateSession(token) {
  if (!token) return { valid: false, reason: 'NO_TOKEN' };
  
  const session = sessionStore.get(token);
  if (!session) return { valid: false, reason: 'SESSION_NOT_FOUND' };
  
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(token);
    return { valid: false, reason: 'SESSION_EXPIRED' };
  }
  
  // Update last activity
  session.lastActivity = Date.now();
  
  return { valid: true, session };
}

/**
 * Revoke session
 */
export function revokeSession(token) {
  return sessionStore.delete(token);
}

/**
 * Clean expired sessions
 */
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (now > session.expiresAt) {
      sessionStore.delete(token);
    }
  }
}

/**
 * Record operation in session
 */
export function recordOperation(token, operation) {
  const session = sessionStore.get(token);
  if (session) {
    session.operations.push({
      operation,
      timestamp: Date.now()
    });
  }
}

/**
 * Check if client is locked out
 */
function isLockedOut(clientId) {
  const attempts = failedAttempts.get(clientId);
  if (!attempts) return false;
  
  if (attempts.count >= FAILED_ATTEMPT_LIMIT) {
    const lockoutEnds = attempts.lastAttempt + LOCKOUT_DURATION;
    if (Date.now() < lockoutEnds) {
      return { 
        locked: true, 
        remainingMs: lockoutEnds - Date.now() 
      };
    }
    // Lockout expired, reset
    failedAttempts.delete(clientId);
  }
  
  return false;
}

/**
 * Record failed attempt
 */
function recordFailedAttempt(clientId) {
  const attempts = failedAttempts.get(clientId) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  failedAttempts.set(clientId, attempts);
  return attempts;
}

/**
 * Clear failed attempts on success
 */
function clearFailedAttempts(clientId) {
  failedAttempts.delete(clientId);
}

/**
 * Middleware to require trapdoor passcode authentication
 */
export function requireTrapdoorPasscode(req, res, next) {
  const clientId = req.ip || req.get('X-Forwarded-For') || 'unknown';
  
  // Check lockout
  const lockout = isLockedOut(clientId);
  if (lockout && lockout.locked) {
    return res.status(429).json({
      ok: false,
      error: {
        code: 'LOCKED_OUT',
        message: 'Too many failed attempts. Access temporarily blocked.',
        retryAfterMs: lockout.remainingMs
      },
      meta: {
        ts: new Date().toISOString(),
        correlationId: req.correlationId || 'unknown',
        apiVersion: 'v1'
      }
    });
  }
  
  const required = getTrapdoorPasscode();
  if (!required) {
    return res.status(503).json({
      ok: false,
      error: {
        code: 'TRAPDOOR_NOT_CONFIGURED',
        message: 'Secret Room passcode not configured'
      },
      meta: {
        ts: new Date().toISOString(),
        correlationId: req.correlationId || 'unknown',
        apiVersion: 'v1'
      }
    });
  }

  const provided =
    req.get('X-Secret-Room-Passcode') ||
    req.get('X-Trapdoor-Passcode') ||
    (typeof req.query?.passcode === 'string' ? req.query.passcode : null);

  if (!provided || provided !== required) {
    const attempts = recordFailedAttempt(clientId);
    const remaining = FAILED_ATTEMPT_LIMIT - attempts.count;
    
    return res.status(401).json({
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing Secret Room passcode.',
        attemptsRemaining: Math.max(0, remaining)
      },
      meta: {
        ts: new Date().toISOString(),
        correlationId: req.correlationId || 'unknown',
        apiVersion: 'v1',
        requiredHeader: 'X-Secret-Room-Passcode'
      }
    });
  }

  // Success - clear failed attempts
  clearFailedAttempts(clientId);
  
  // Attach auth info to request
  req.secretRoomAuth = {
    authenticated: true,
    clientId,
    timestamp: Date.now()
  };

  return next();
}

/**
 * Middleware to require valid session token
 */
export function requireSessionToken(req, res, next) {
  const token = req.get('X-Session-Token') || req.query?.sessionToken;
  
  const validation = validateSession(token);
  
  if (!validation.valid) {
    return res.status(401).json({
      ok: false,
      error: {
        code: 'INVALID_SESSION',
        message: `Session validation failed: ${validation.reason}`,
        requiresReauth: true
      },
      meta: {
        ts: new Date().toISOString(),
        correlationId: req.correlationId || 'unknown',
        apiVersion: 'v1'
      }
    });
  }
  
  req.session = validation.session;
  return next();
}

/**
 * Get active session count
 */
export function getActiveSessionCount() {
  cleanExpiredSessions();
  return sessionStore.size;
}

export { getTrapdoorPasscode };

