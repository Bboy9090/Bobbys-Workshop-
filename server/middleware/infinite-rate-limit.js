/**
 * 🏆 Production-Grade Rate Limiting for Infinite Legendary Features
 */

class InfiniteRateLimiter {
  constructor() {
    this.rateLimits = {
      quantum: { requests: 100, window: 60000 }, // 100 req/min
      forecast: { requests: 200, window: 60000 }, // 200 req/min
      swarm: { requests: 50, window: 60000 }, // 50 req/min
      causal: { requests: 100, window: 60000 }, // 100 req/min
      consciousness: { requests: 150, window: 60000 }, // 150 req/min
      replicate: { requests: 20, window: 60000 }, // 20 req/min (dangerous)
      neuromorphic: { requests: 100, window: 60000 }, // 100 req/min
      simulation: { requests: 50, window: 60000 }, // 50 req/min (CPU intensive)
      multiOptimize: { requests: 30, window: 60000 }, // 30 req/min (CPU intensive)
      blockchain: { requests: 200, window: 60000 }, // 200 req/min
    };

    this.clientRequests = new Map(); // clientId -> { timestamps: [], feature: {} }
  }

  // Check rate limit
  checkRateLimit(clientId, feature) {
    const limit = this.rateLimits[feature];
    if (!limit) {
      return { allowed: true, remaining: Infinity };
    }

    const now = Date.now();
    
    // Get or create client record
    if (!this.clientRequests.has(clientId)) {
      this.clientRequests.set(clientId, {
        timestamps: [],
        feature: {},
      });
    }

    const client = this.clientRequests.get(clientId);
    
    // Get or create feature record
    if (!client.feature[feature]) {
      client.feature[feature] = [];
    }

    const featureTimestamps = client.feature[feature];

    // Clean old timestamps
    const windowStart = now - limit.window;
    const recentRequests = featureTimestamps.filter(ts => ts > windowStart);
    client.feature[feature] = recentRequests;

    // Check limit
    if (recentRequests.length >= limit.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(recentRequests[0] + limit.window).toISOString(),
        limit: limit.requests,
        window: limit.window,
      };
    }

    // Add current request
    recentRequests.push(now);
    client.feature[feature] = recentRequests;

    return {
      allowed: true,
      remaining: limit.requests - recentRequests.length,
      resetAt: new Date(now + limit.window).toISOString(),
      limit: limit.requests,
    };
  }

  // Middleware factory
  createRateLimitMiddleware(feature) {
    return (req, res, next) => {
      const clientId = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const check = this.checkRateLimit(clientId, feature);

      if (!check.allowed) {
        return res.status(429).json({
          envelope: {
            version: '1.0',
            operation: req.path,
            mode: 'error',
            timestamp: new Date().toISOString(),
          },
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded for ${feature}. Limit: ${check.limit} requests per ${check.window / 1000}s`,
            retryAfter: check.resetAt,
            remaining: check.remaining,
          },
        });
      }

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': check.limit,
        'X-RateLimit-Remaining': check.remaining,
        'X-RateLimit-Reset': check.resetAt,
      });

      next();
    };
  }

  // Cleanup old client records
  cleanup() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [clientId, client] of this.clientRequests.entries()) {
      let hasRecentActivity = false;

      for (const timestamps of Object.values(client.feature)) {
        if (timestamps.some(ts => now - ts < maxAge)) {
          hasRecentActivity = true;
          break;
        }
      }

      if (!hasRecentActivity) {
        this.clientRequests.delete(clientId);
      }
    }
  }
}

export default new InfiniteRateLimiter();
