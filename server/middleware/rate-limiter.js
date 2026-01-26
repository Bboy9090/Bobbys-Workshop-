/**
 * Rate Limiting Middleware
 * In-memory rate limiter for sensitive endpoints
 */

const rateLimitStore = new Map();

/**
 * Rate limit configuration
 */
const RATE_LIMITS = {
  // Trapdoor endpoints - very strict
  trapdoor: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: 'Too many requests to trapdoor endpoint. Please try again later.'
  },
  // Authorization triggers - moderate
  authorization: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Too many authorization trigger requests. Please try again later.'
  },
  // Flash operations - moderate
  flash: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'Too many flash operation requests. Please try again later.'
  },
  // Fastboot destructive operations - strict
  fastboot: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many fastboot operation requests. Please try again later.'
  },
  // Default rate limit
  default: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'Too many requests. Please try again later.'
  }
};

/**
 * Get client identifier from request
 */
function getClientId(req) {
  // Use IP address as client identifier
  return req.ip || req.connection.remoteAddress || 'unknown';
}

/**
 * Clean up expired entries
 * Called periodically by interval timer, not per-request
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`[RateLimit] Cleaned up ${deletedCount} expired entries`);
  }
}

// Clean up expired entries every minute (more frequent than before)
setInterval(cleanupExpiredEntries, 60 * 1000);

/**
 * Create rate limiting middleware
 */
export function rateLimiter(limitType = 'default') {
  const config = RATE_LIMITS[limitType] || RATE_LIMITS.default;

  return (req, res, next) => {
    // Removed per-request cleanup - rely on interval timer instead

    const clientId = getClientId(req);
    const key = `${limitType}:${clientId}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    // Lazy deletion: check if current record is expired
    if (record && now > record.resetTime) {
      rateLimitStore.delete(key);
      record = null;
    }

    if (!record) {
      // Create new record
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs
      });
      return next();
    }

    // Increment count
    record.count++;

    if (record.count > config.maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.status(429).json({
        ok: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: config.message,
          details: {
            limit: config.maxRequests,
            windowMs: config.windowMs,
            retryAfter
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          correlationId: req.correlationId || null,
          apiVersion: 'v1'
        }
      });
      return;
    }

    next();
  };
}

