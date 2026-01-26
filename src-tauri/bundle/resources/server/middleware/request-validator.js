/**
 * Request Validator Middleware
 * 
 * Strict input validation. No malformed requests pass through.
 * Every parameter checked. Every type verified.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, coerceTypes: true });
addFormats(ajv);

// Common schemas
const schemas = {
  deviceSerial: {
    type: 'string',
    minLength: 1,
    maxLength: 64,
    pattern: '^[a-zA-Z0-9_\\-:.]+$'
  },
  
  operation: {
    type: 'string',
    minLength: 1,
    maxLength: 128,
    pattern: '^[a-zA-Z0-9_\\-]+$'
  },
  
  passcode: {
    type: 'string',
    minLength: 4,
    maxLength: 256
  },
  
  confirmation: {
    type: 'string',
    minLength: 1,
    maxLength: 128
  },
  
  filePath: {
    type: 'string',
    minLength: 1,
    maxLength: 1024
  },
  
  positiveInteger: {
    type: 'integer',
    minimum: 0
  },
  
  pagination: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
      offset: { type: 'integer', minimum: 0, default: 0 }
    }
  }
};

// Compiled validators cache
const validators = new Map();

/**
 * Get or create validator for schema
 */
function getValidator(schema) {
  const key = JSON.stringify(schema);
  if (!validators.has(key)) {
    validators.set(key, ajv.compile(schema));
  }
  return validators.get(key);
}

/**
 * Validate request body against schema
 */
export function validateBody(schema) {
  const validate = getValidator(schema);
  
  return (req, res, next) => {
    if (!validate(req.body)) {
      const errors = validate.errors.map(e => ({
        field: e.instancePath || e.params?.missingProperty || 'body',
        message: e.message,
        value: e.data
      }));
      
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body validation failed',
          details: errors
        },
        meta: {
          ts: new Date().toISOString(),
          correlationId: req.correlationId
        }
      });
    }
    next();
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(schema) {
  const validate = getValidator(schema);
  
  return (req, res, next) => {
    if (!validate(req.query)) {
      const errors = validate.errors.map(e => ({
        field: e.instancePath || e.params?.missingProperty || 'query',
        message: e.message
      }));
      
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          details: errors
        },
        meta: {
          ts: new Date().toISOString(),
          correlationId: req.correlationId
        }
      });
    }
    next();
  };
}

/**
 * Validate route parameters
 */
export function validateParams(schema) {
  const validate = getValidator(schema);
  
  return (req, res, next) => {
    if (!validate(req.params)) {
      const errors = validate.errors.map(e => ({
        field: e.instancePath || e.params?.missingProperty || 'params',
        message: e.message
      }));
      
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Route parameter validation failed',
          details: errors
        },
        meta: {
          ts: new Date().toISOString(),
          correlationId: req.correlationId
        }
      });
    }
    next();
  };
}

/**
 * Require device serial in body or params
 */
export function requireDeviceSerial(req, res, next) {
  const serial = req.body?.deviceSerial || req.body?.serial || req.params?.serial;
  
  if (!serial || typeof serial !== 'string' || serial.length === 0) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'MISSING_DEVICE_SERIAL',
        message: 'Device serial number is required'
      },
      meta: {
        ts: new Date().toISOString(),
        correlationId: req.correlationId
      }
    });
  }
  
  // Normalize serial location
  req.deviceSerial = serial.trim();
  next();
}

/**
 * Require confirmation phrase for destructive operations
 */
export function requireConfirmation(requiredPhrase) {
  return (req, res, next) => {
    const confirmation = req.body?.confirmation || req.body?.confirmationPhrase;
    
    if (!confirmation) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'CONFIRMATION_REQUIRED',
          message: `This operation requires confirmation. Type "${requiredPhrase}" to proceed.`,
          details: { requiredPhrase }
        },
        meta: {
          ts: new Date().toISOString(),
          correlationId: req.correlationId
        }
      });
    }
    
    if (confirmation.toUpperCase() !== requiredPhrase.toUpperCase()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'CONFIRMATION_MISMATCH',
          message: 'Confirmation phrase does not match',
          details: { 
            required: requiredPhrase,
            received: confirmation 
          }
        },
        meta: {
          ts: new Date().toISOString(),
          correlationId: req.correlationId
        }
      });
    }
    
    req.confirmed = true;
    next();
  };
}

/**
 * Sanitize string input
 */
export function sanitizeString(str, maxLength = 1024) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Basic XSS prevention
}

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = schemas;
