/**
 * Base Flash Operations Utilities
 * 
 * Common utilities for all flash operations (MediaTek, Samsung Odin, Fastboot, Xiaomi EDL, etc.)
 * Reduces code duplication across flash route handlers.
 */

import { safeSpawn, commandExistsSafe } from './safe-exec.js';

/**
 * Scan for devices using a specific command
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {Function} parseOutput - Function to parse command output into device list
 * @param {number} timeout - Command timeout in ms (default: 5000)
 * @returns {Promise<{success: boolean, devices: Array, count: number, error?: string}>}
 */
export async function scanDevices(command, args, parseOutput, timeout = 5000) {
  try {
    // Check if command exists first
    const exists = await commandExistsSafe(command);
    if (!exists) {
      return {
        success: false,
        devices: [],
        count: 0,
        error: `Command '${command}' not found. Please ensure it is installed and in PATH.`
      };
    }

    const result = await safeSpawn(command, args, { timeout });

    if (!result.success) {
      return {
        success: false,
        devices: [],
        count: 0,
        error: result.error || 'Device scan failed'
      };
    }

    const devices = parseOutput(result.stdout, result.stderr);
    return {
      success: true,
      devices,
      count: devices.length
    };
  } catch (error) {
    return {
      success: false,
      devices: [],
      count: 0,
      error: error.message
    };
  }
}

/**
 * Execute a flash operation with progress tracking
 * @param {string} command - Flash command
 * @param {string[]} args - Command arguments
 * @param {Object} options - Flash options
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{success: boolean, output?: string, error?: string}>}
 */
export async function executeFlash(command, args, options = {}, onProgress = null) {
  try {
    const exists = await commandExistsSafe(command);
    if (!exists) {
      return {
        success: false,
        error: `Flash tool '${command}' not found. Please ensure it is installed.`
      };
    }

    // Execute flash command with progress monitoring
    const result = await safeSpawn(command, args, {
      timeout: options.timeout || 300000, // 5 minutes default
      onStdout: onProgress ? (data) => {
        if (onProgress) {
          onProgress({ type: 'stdout', data });
        }
      } : undefined,
      onStderr: onProgress ? (data) => {
        if (onProgress) {
          onProgress({ type: 'stderr', data });
        }
      } : undefined
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Flash operation failed',
        output: result.stderr
      };
    }

    return {
      success: true,
      output: result.stdout
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate file path and check if file exists
 * @param {string} filePath - File path to validate
 * @param {string[]} allowedExtensions - Array of allowed extensions (e.g., ['.img', '.bin'])
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateFilePath(filePath, allowedExtensions = []) {
  try {
    // Basic path validation
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, error: 'Invalid file path' };
    }

    // Check extension if specified
    if (allowedExtensions.length > 0) {
      const hasValidExt = allowedExtensions.some(ext => 
        filePath.toLowerCase().endsWith(ext.toLowerCase())
      );
      if (!hasValidExt) {
        return { 
          valid: false, 
          error: `File must have one of these extensions: ${allowedExtensions.join(', ')}`
        };
      }
    }

    // Check if file exists (platform-specific)
    const { existsSync } = await import('fs');
    if (!existsSync(filePath)) {
      return { valid: false, error: 'File does not exist' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Create a standardized response for device scan endpoints
 * @param {Object} scanResult - Result from scanDevices()
 * @param {string} deviceType - Type of device (e.g., 'MediaTek', 'Samsung')
 * @returns {Object} Express response object
 */
export function createScanResponse(scanResult, deviceType) {
  if (!scanResult.success) {
    return {
      success: false,
      error: scanResult.error,
      devices: [],
      count: 0,
      message: `Failed to scan for ${deviceType} devices`
    };
  }

  return {
    success: true,
    devices: scanResult.devices,
    count: scanResult.count,
    message: scanResult.count > 0 
      ? `Found ${scanResult.count} ${deviceType} device(s)`
      : `No ${deviceType} devices found`
  };
}

/**
 * Create a standardized response for flash operation endpoints
 * @param {Object} flashResult - Result from executeFlash()
 * @param {string} operation - Description of operation
 * @returns {Object} Express response object
 */
export function createFlashResponse(flashResult, operation) {
  if (!flashResult.success) {
    return {
      success: false,
      error: flashResult.error,
      message: `${operation} failed`,
      output: flashResult.output
    };
  }

  return {
    success: true,
    message: `${operation} completed successfully`,
    output: flashResult.output
  };
}

/**
 * Parse ADB devices output into device list
 * @param {string} stdout - ADB devices output
 * @returns {Array} Array of device objects
 */
export function parseAdbDevices(stdout) {
  const lines = stdout.split('\n').slice(1).filter(line => line.trim());
  return lines.map(line => {
    const parts = line.split(/\s+/);
    return {
      serial: parts[0],
      state: parts[1],
      detected: true
    };
  }).filter(device => device.state !== 'offline');
}

/**
 * Parse fastboot devices output into device list
 * @param {string} stdout - Fastboot devices output
 * @returns {Array} Array of device objects
 */
export function parseFastbootDevices(stdout) {
  const lines = stdout.split('\n').filter(line => line.trim());
  return lines.map(line => {
    const parts = line.split(/\s+/);
    return {
      serial: parts[0],
      mode: 'fastboot',
      detected: true
    };
  });
}
