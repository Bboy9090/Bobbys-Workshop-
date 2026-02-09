/**
 * Base Monitor Utilities
 * 
 * Common utilities for all device monitoring routes (storage, thermal, performance, network)
 * Reduces code duplication across monitoring endpoints.
 */

import ADBLibrary from './adb-library-wrapper.js';

/**
 * Standard response envelope for monitoring endpoints
 * @param {boolean} success - Operation success status
 * @param {Object} data - Monitoring data
 * @param {string} error - Error message (if failed)
 * @returns {Object} Standard response object
 */
export function createMonitorResponse(success, data = null, error = null) {
  return {
    ok: success,
    data: success ? data : null,
    error: error,
    timestamp: Date.now()
  };
}

/**
 * Execute ADB shell command with error handling
 * @param {string} deviceSerial - Device serial number
 * @param {string} command - Shell command to execute
 * @returns {Promise<Object>} Command result
 */
export async function executeDeviceCommand(deviceSerial, command) {
  try {
    const result = await ADBLibrary.shell(deviceSerial, command);
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Command execution failed',
        stdout: null,
        stderr: result.stderr || null
      };
    }

    return {
      success: true,
      stdout: result.stdout || '',
      stderr: result.stderr || ''
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stdout: null,
      stderr: null
    };
  }
}

/**
 * Parse size strings (e.g., "1.5G", "512M") to bytes
 * @param {string} sizeStr - Size string with unit
 * @returns {number} Size in bytes
 */
export function parseSizeToBytes(sizeStr) {
  const match = sizeStr.match(/^([\d.]+)([KMGTP]?)$/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers = {
    '': 1,
    'K': 1024,
    'M': 1024 ** 2,
    'G': 1024 ** 3,
    'T': 1024 ** 4,
    'P': 1024 ** 5
  };
  
  return Math.floor(value * (multipliers[unit] || 1));
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size string
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Parse temperature value (handles different formats)
 * @param {string} tempStr - Temperature string (may be in tenths or millidegrees)
 * @param {number} divisor - Divisor to convert to Celsius (10 for tenths, 1000 for millidegrees)
 * @returns {number|null} Temperature in Celsius
 */
export function parseTemperature(tempStr, divisor = 1000) {
  if (!tempStr) return null;
  
  const value = parseFloat(tempStr);
  if (isNaN(value)) return null;
  
  return value / divisor;
}

/**
 * Check if device is available via ADB
 * @param {string} deviceSerial - Device serial number
 * @returns {Promise<boolean>} True if device is available
 */
export async function isDeviceAvailable(deviceSerial) {
  try {
    const result = await ADBLibrary.shell(deviceSerial, 'echo "ping"');
    return result.success && result.stdout.trim() === 'ping';
  } catch (error) {
    return false;
  }
}

/**
 * Get device uptime in seconds
 * @param {string} deviceSerial - Device serial number
 * @returns {Promise<number|null>} Uptime in seconds or null if failed
 */
export async function getDeviceUptime(deviceSerial) {
  const result = await executeDeviceCommand(deviceSerial, 'cat /proc/uptime');
  if (!result.success) return null;
  
  const uptimeMatch = result.stdout.match(/^([\d.]+)/);
  return uptimeMatch ? parseFloat(uptimeMatch[1]) : null;
}

/**
 * Calculate percentage from usage values
 * @param {number} used - Used value
 * @param {number} total - Total value
 * @param {number} decimals - Number of decimal places
 * @returns {number} Percentage (0-100)
 */
export function calculatePercentage(used, total, decimals = 2) {
  if (total === 0) return 0;
  return parseFloat(((used / total) * 100).toFixed(decimals));
}

/**
 * Create alert object for threshold monitoring
 * @param {string} metric - Metric name (e.g., 'temperature', 'storage')
 * @param {number} value - Current value
 * @param {number} threshold - Alert threshold
 * @param {string} severity - Alert severity ('info', 'warning', 'critical')
 * @returns {Object|null} Alert object or null if below threshold
 */
export function createAlert(metric, value, threshold, severity = 'warning') {
  if (value < threshold) return null;
  
  return {
    metric,
    value,
    threshold,
    severity,
    message: `${metric} is ${value}, exceeds threshold of ${threshold}`,
    timestamp: Date.now()
  };
}

/**
 * Batch execute multiple device commands
 * @param {string} deviceSerial - Device serial number
 * @param {Array<{key: string, command: string}>} commands - Array of command objects
 * @returns {Promise<Object>} Object with command results keyed by their key
 */
export async function batchExecuteCommands(deviceSerial, commands) {
  const results = {};
  
  for (const { key, command } of commands) {
    results[key] = await executeDeviceCommand(deviceSerial, command);
  }
  
  return results;
}

/**
 * Parse dumpsys output by property
 * @param {string} dumpsysOutput - Output from dumpsys command
 * @param {string} property - Property to extract
 * @returns {string|null} Property value or null if not found
 */
export function parseDumpsysProperty(dumpsysOutput, property) {
  const regex = new RegExp(`${property}:\\s*(.+)`, 'i');
  const match = dumpsysOutput.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Common error handler for monitor routes
 * @param {Error} error - Error object
 * @param {string} operation - Description of operation that failed
 * @returns {Object} Standardized error response
 */
export function handleMonitorError(error, operation) {
  console.error(`[Monitor] ${operation} failed:`, error);
  return createMonitorResponse(false, null, `${operation} failed: ${error.message}`);
}
