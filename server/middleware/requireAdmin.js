/**
 * Require Admin Middleware
 * 
 * Authentication and authorization middleware for Trapdoor API endpoints.
 * Supports multiple authentication methods: API Key, Secret Room Passcode, JWT.
 * 
 * @module server/middleware/requireAdmin
 */

import jwt from 'jsonwebtoken';

/**
 * Require admin authentication middleware
 * 
 * Checks for authentication via:
 * 1. X-API-Key header (development)
 * 2. X-Secret-Room-Passcode header (alternative)
 * 3. Authorization header with JWT (production)
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function requireAdmin(req, res, next) {
  // Get authentication from headers
  const apiKey = req.headers['x-api-key'];
  const passcode = req.headers['x-secret-room-passcode'];
  const authHeader = req.headers.authorization;

  // Get expected values from environment
  const expectedApiKey = process.env.TRAPDOOR_API_KEY || process.env.ADMIN_API_KEY;
  const expectedPasscode = process.env.SECRET_ROOM_PASSCODE;

  // Check API Key (development mode)
  if (apiKey && expectedApiKey && apiKey === expectedApiKey) {
    req.user = {
      role: 'admin',
      authMethod: 'api-key',
      authenticated: true
    };
    return next();
  }

  // Check Secret Room Passcode
  if (passcode && expectedPasscode && passcode === expectedPasscode) {
    req.user = {
      role: 'admin',
      authMethod: 'passcode',
      authenticated: true
    };
    return next();
  }

  // Check JWT token (production mode)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(503).json({
        error: 'JWT_SECRET_NOT_CONFIGURED',
        message: 'JWT authentication requires JWT_SECRET to be set.'
      });
    }

    const algorithms = process.env.JWT_ALGORITHMS
      ? process.env.JWT_ALGORITHMS.split(',').map(a => a.trim()).filter(Boolean)
      : ['HS256'];

    try {
      const payload = jwt.verify(token, jwtSecret, { algorithms });
      const role = extractRoleFromToken(payload);
      const isAdmin = role === 'admin' || role === 'owner' || payload?.admin === true;

      if (!isAdmin) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'JWT does not grant admin access'
        });
      }

      req.user = {
        role: role || 'admin',
        authMethod: 'jwt',
        authenticated: true,
        subject: payload?.sub || null,
        tokenId: payload?.jti || null
      };
      return next();
    } catch (error) {
      return res.status(401).json({
        error: 'JWT_INVALID',
        message: error.message
      });
    }
  }

  // No valid authentication found
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Trapdoor API requires authentication. Provide X-API-Key, X-Secret-Room-Passcode, or valid JWT token.',
    hint: 'Set TRAPDOOR_API_KEY or SECRET_ROOM_PASSCODE environment variable'
  });
}

/**
 * Optional admin authentication middleware
 * 
 * Sets req.user if authenticated, but doesn't block request
 * Useful for endpoints that have different behavior for authenticated users
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function optionalAdmin(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const passcode = req.headers['x-secret-room-passcode'];
  const authHeader = req.headers.authorization;
  const expectedApiKey = process.env.TRAPDOOR_API_KEY || process.env.ADMIN_API_KEY;
  const expectedPasscode = process.env.SECRET_ROOM_PASSCODE;

  if ((apiKey && expectedApiKey && apiKey === expectedApiKey) ||
      (passcode && expectedPasscode && passcode === expectedPasscode)) {
    req.user = {
      role: 'admin',
      authenticated: true
    };
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;
    const algorithms = process.env.JWT_ALGORITHMS
      ? process.env.JWT_ALGORITHMS.split(',').map(a => a.trim()).filter(Boolean)
      : ['HS256'];

    if (jwtSecret) {
      try {
        const payload = jwt.verify(token, jwtSecret, { algorithms });
        const role = extractRoleFromToken(payload);
        req.user = {
          role: role || 'viewer',
          authenticated: true
        };
      } catch {
        req.user = { role: 'viewer', authenticated: false };
      }
    } else {
      req.user = { role: 'viewer', authenticated: false };
    }
  } else {
    req.user = {
      role: 'viewer',
      authenticated: false
    };
  }

  next();
}

/**
 * Extract user role from request
 * 
 * @param {Object} req - Express request
 * @returns {string} User role (default: 'viewer')
 */
export function getUserRole(req) {
  if (req.user && req.user.role) {
    return req.user.role;
  }
  return 'viewer';
}

function extractRoleFromToken(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.role === 'string') return payload.role;
  if (Array.isArray(payload.roles) && payload.roles.length > 0) return payload.roles[0];
  if (typeof payload.scope === 'string') {
    const scopes = payload.scope.split(' ').map(s => s.trim());
    if (scopes.includes('admin')) return 'admin';
    if (scopes.includes('owner')) return 'owner';
  }
  return null;
}
