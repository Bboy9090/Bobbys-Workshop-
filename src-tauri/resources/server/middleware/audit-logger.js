/**
 * Audit logging middleware
 * Logs all operations to audit trail (console for normal ops, shadow logger for sensitive)
 */

import ShadowLogger from '../../core/lib/shadow-logger.js';

const shadowLogger = new ShadowLogger();

/**
 * Audit logging middleware
 * Logs all operations to audit trail (console for normal ops, shadow logger for sensitive)
 */
export function auditLogMiddleware(req, res, next) {
  const startTime = Date.now();
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      operation: req.body?.operation || req.query?.operation || req.path,
      deviceSerial: req.body?.serial || req.body?.deviceSerial || req.params?.serial,
      statusCode: res.statusCode,
      duration: Date.now() - startTime,
      success: res.statusCode < 400,
      userId: req.get('X-Session-Id') || req.correlationId?.split('-')[0] || req.ip, // Session ID from header or correlation prefix
      userAgent: req.get('user-agent'),
      requestBody: sanitizeRequestBody(req.body) // Remove sensitive data
    };

    // Log to shadow logger for sensitive operations
    const isSensitive = req.path.includes('/trapdoor') || 
                       req.path.includes('/flash') ||
                       req.path.includes('/unlock') ||
                       req.path.includes('/erase');

    if (isSensitive) {
      shadowLogger.logShadow({
        operation: auditEntry.operation,
        deviceSerial: auditEntry.deviceSerial || 'N/A',
        userId: auditEntry.userId,
        authorization: 'LOGGED',
        success: auditEntry.success,
        metadata: {
          method: auditEntry.method,
          path: auditEntry.path,
          statusCode: auditEntry.statusCode,
          duration: auditEntry.duration
        }
      }).catch(err => console.error('[AUDIT] Shadow log error:', err));
    } else {
      // Log to console for non-sensitive operations
      console.log('[AUDIT]', JSON.stringify(auditEntry));
    }

    return originalJson(data);
  };

  next();
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = [
    'password', 'passcode', 'token', 'secret', 'authorization', 
    'confirmation', 'key', 'apiKey', 'api_key', 'accessToken',
    'refreshToken', 'privateKey', 'private_key', 'credential'
  ];

  // Recursively sanitize nested objects
  function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    
    const result = { ...obj };
    for (const [key, value] of Object.entries(result)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(f => lowerKey.includes(f.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeObject(value);
      }
    }
    return result;
  }

  return sanitizeObject(sanitized);
}

