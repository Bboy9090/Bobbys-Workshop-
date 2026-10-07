/**
 * Bundled Logger - Simple logger for bundled server environment
 * This replaces the src/lib/debug-logger.js dependency for bundled builds
 */

/**
 * Simple logger for bundled server
 */
export function createLogger(name) {
  const prefix = `[${name}]`;

  return {
    debug: (msg, ...args) => {
      console.debug(`${prefix} ${msg}`, ...args);
    },
    info: (msg, ...args) => {
      console.log(`${prefix} ${msg}`, ...args);
    },
    warn: (msg, ...args) => {
      console.warn(`${prefix} WARNING: ${msg}`, ...args);
    },
    error: (msg, ...args) => {
      console.error(`${prefix} ERROR: ${msg}`, ...args);
    }
  };
}