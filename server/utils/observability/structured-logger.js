/**
 * Universal Legend Status - Structured Logger
 * Enterprise-grade structured logging with correlation IDs and context
 * 
 * Features:
 * - JSON-structured logs
 * - Correlation ID tracking
 * - Log levels (debug, info, warn, error)
 * - Context preservation
 * - Searchable and filterable
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StructuredLogger {
  constructor() {
    this.logDir = process.env.BW_LOG_DIR || (process.platform === 'win32' 
      ? path.join(process.env.LOCALAPPDATA || process.env.APPDATA || process.cwd(), 'BobbysWorkshop', 'logs')
      : path.join(process.env.HOME || process.cwd(), '.local', 'share', 'bobbys-workshop', 'logs'));
    
    this.logFile = path.join(this.logDir, 'structured.log');
    this.errorLogFile = path.join(this.logDir, 'errors.log');
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Create write streams
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    this.errorStream = fs.createWriteStream(this.errorLogFile, { flags: 'a' });
    
    // Handle cleanup
    process.on('exit', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
    
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
  }

  /**
   * Cleanup streams
   */
  cleanup() {
    try {
      this.logStream.end();
      this.errorStream.end();
    } catch (error) {
      console.error('[Logger] Cleanup error:', error);
    }
  }

  /**
   * Check if log level should be logged
   */
  shouldLog(level) {
    return this.logLevels[level] >= this.logLevels[this.logLevel];
  }

  /**
   * Write log entry
   */
  writeLog(entry, isError = false) {
    const line = JSON.stringify(entry) + '\n';
    const stream = isError ? this.errorStream : this.logStream;
    
    stream.write(line, (err) => {
      if (err) {
        console.error('[Logger] Failed to write log:', err);
      }
    });
    
    // Also output to console in development
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = isError ? console.error : console.log;
      consoleMethod(`[${entry.level.toUpperCase()}] ${entry.message}`, entry.context || '');
    }
  }

  /**
   * Create log entry
   */
  createEntry(level, message, context = {}, correlationId = null) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: correlationId || context.correlationId || null,
      context: {
        ...context,
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version
      }
    };
  }

  /**
   * Debug log
   */
  debug(message, context = {}, correlationId = null) {
    if (!this.shouldLog('debug')) return;
    const entry = this.createEntry('debug', message, context, correlationId);
    this.writeLog(entry);
  }

  /**
   * Info log
   */
  info(message, context = {}, correlationId = null) {
    if (!this.shouldLog('info')) return;
    const entry = this.createEntry('info', message, context, correlationId);
    this.writeLog(entry);
  }

  /**
   * Warn log
   */
  warn(message, context = {}, correlationId = null) {
    if (!this.shouldLog('warn')) return;
    const entry = this.createEntry('warn', message, context, correlationId);
    this.writeLog(entry);
  }

  /**
   * Error log
   */
  error(message, error = null, context = {}, correlationId = null) {
    if (!this.shouldLog('error')) return;
    const entry = this.createEntry('error', message, {
      ...context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code
      } : null
    }, correlationId);
    this.writeLog(entry, true);
  }

  /**
   * Log HTTP request
   */
  logRequest(req, res, duration, correlationId = null) {
    const entry = this.createEntry('info', 'HTTP Request', {
      method: req.method,
      path: req.path,
      route: req.route?.path || req.path,
      statusCode: res.statusCode,
      duration_ms: duration,
      userAgent: req.get('user-agent'),
      ip: req.ip || req.connection.remoteAddress,
      query: Object.keys(req.query).length > 0 ? req.query : undefined
    }, correlationId);
    
    this.writeLog(entry);
  }

  /**
   * Log operation
   */
  logOperation(operation, deviceSerial, status, duration, context = {}, correlationId = null) {
    const entry = this.createEntry('info', 'Operation Executed', {
      operation,
      deviceSerial,
      status,
      duration_ms: duration,
      ...context
    }, correlationId);
    
    this.writeLog(entry);
  }

  /**
   * Log device event
   */
  logDeviceEvent(event, deviceInfo, context = {}, correlationId = null) {
    const entry = this.createEntry('info', 'Device Event', {
      event,
      device: deviceInfo,
      ...context
    }, correlationId);
    
    this.writeLog(entry);
  }

  /**
   * Create child logger with context
   */
  child(defaultContext = {}) {
    return {
      debug: (message, context = {}) => this.debug(message, { ...defaultContext, ...context }),
      info: (message, context = {}) => this.info(message, { ...defaultContext, ...context }),
      warn: (message, context = {}) => this.warn(message, { ...defaultContext, ...context }),
      error: (message, error = null, context = {}) => this.error(message, error, { ...defaultContext, ...context })
    };
  }
}

// Singleton instance
const structuredLogger = new StructuredLogger();

export default structuredLogger;
