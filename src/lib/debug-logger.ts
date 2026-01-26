/**
 * Debug Logger Utility
 * 
 * Centralized logging for Bobby's Workshop with configurable verbosity.
 * Respects production mode - only logs when DEBUG=true or in development.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  prefix: string;
  enabled: boolean;
}

const isDev = import.meta.env.DEV;
const isDebugMode = import.meta.env.VITE_DEBUG === 'true' || localStorage.getItem('bw:debug') === 'true';

class DebugLogger {
  private prefix: string;
  private enabled: boolean;

  constructor(config: LoggerConfig) {
    this.prefix = config.prefix;
    this.enabled = config.enabled && (isDev || isDebugMode);
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString().slice(11, 23);
    return `[${timestamp}] [${this.prefix}] ${level.toUpperCase()}: ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.enabled && isDebugMode) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    // Warnings always show in dev mode
    if (isDev || this.enabled) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    // Errors always show
    console.error(this.formatMessage('error', message), ...args);
  }
}

/**
 * Create a logger instance for a specific module
 */
export function createLogger(prefix: string, enabled = true): DebugLogger {
  return new DebugLogger({ prefix, enabled });
}

/**
 * Pre-configured loggers for common modules
 */
export const appLogger = createLogger('App');
export const apiLogger = createLogger('API');
export const deviceLogger = createLogger('Device');
export const flashLogger = createLogger('Flash');
export const wsLogger = createLogger('WebSocket');

/**
 * Enable debug mode at runtime
 */
export function enableDebugMode(): void {
  localStorage.setItem('bw:debug', 'true');
  console.info('[DebugLogger] Debug mode enabled. Reload the page to apply.');
}

/**
 * Disable debug mode at runtime
 */
export function disableDebugMode(): void {
  localStorage.removeItem('bw:debug');
  console.info('[DebugLogger] Debug mode disabled. Reload the page to apply.');
}
