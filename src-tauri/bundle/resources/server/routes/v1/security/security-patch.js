/**
 * Security Patch Level Detection API
 * 
 * Detects and analyzes Android security patch level.
 * Provides security patch date, age calculation, and security status.
 * 
 * @module security-patch-level
 */

import express from 'express';
import ADBLibrary from '../../../../core/lib/adb.js';
import { safeSpawn, commandExistsSafe } from '../../../utils/safe-exec.js';

const router = express.Router();

/**
 * Parse security patch date string (format: YYYY-MM-DD)
 * @param {string} patchDate - Security patch date string
 * @returns {Date|null} Parsed date or null
 */
function parseSecurityPatchDate(patchDate) {
  if (!patchDate || patchDate === '') {
    return null;
  }
  
  // Format: YYYY-MM-DD (e.g., "2024-12-05")
  const parts = patchDate.split('-');
  if (parts.length !== 3) {
    return null;
  }
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }
  
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return date;
}

/**
 * Calculate security patch age in days
 * @param {Date} patchDate - Security patch date
 * @returns {number} Age in days
 */
function calculatePatchAge(patchDate) {
  if (!patchDate) {
    return null;
  }
  
  const now = new Date();
  const diffTime = Math.abs(now - patchDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Determine security status based on patch age
 * @param {number} ageDays - Age in days
 * @returns {Object} Security status information
 */
function determineSecurityStatus(ageDays) {
  if (ageDays === null || ageDays === undefined) {
    return {
      status: 'unknown',
      level: 'unknown',
      color: 'gray',
      message: 'Unable to determine security status'
    };
  }
  
  // Security patch levels:
  // - Current: < 90 days (3 months)
  // - Outdated: 90-180 days (3-6 months)
  // - Critical: > 180 days (6+ months)
  
  if (ageDays < 90) {
    return {
      status: 'current',
      level: 'low',
      color: 'green',
      message: 'Security patch is current (< 3 months old)'
    };
  } else if (ageDays < 180) {
    return {
      status: 'outdated',
      level: 'medium',
      color: 'amber',
      message: 'Security patch is outdated (3-6 months old)'
    };
  } else {
    return {
      status: 'critical',
      level: 'high',
      color: 'red',
      message: 'Security patch is critically outdated (> 6 months old)'
    };
  }
}

/**
 * Get security patch level for a device
 * @param {string} deviceSerial - Device serial number
 * @returns {Promise<Object>} Security patch information
 */
async function getSecurityPatchLevel(deviceSerial) {
  try {
    // Get security patch property
    const patchResult = await ADBLibrary.shell(deviceSerial, 'getprop ro.build.version.security_patch');
    
    if (!patchResult.success) {
      return {
        success: false,
        error: 'Failed to get security patch property'
      };
    }
    
    const patchDateString = patchResult.stdout.trim();
    
    // Get Android version for context
    const androidVersionResult = await ADBLibrary.shell(deviceSerial, 'getprop ro.build.version.release');
    const androidVersion = androidVersionResult.success ? androidVersionResult.stdout.trim() : null;
    
    // Get build date for additional context
    const buildDateResult = await ADBLibrary.shell(deviceSerial, 'getprop ro.build.date');
    const buildDate = buildDateResult.success ? buildDateResult.stdout.trim() : null;
    
    // Parse security patch date
    const patchDate = parseSecurityPatchDate(patchDateString);
    
    // Calculate patch age
    const ageDays = patchDate ? calculatePatchAge(patchDate) : null;
    
    // Determine security status
    const securityStatus = determineSecurityStatus(ageDays);
    
    // Get current date for comparison
    const currentDate = new Date();
    
    return {
      success: true,
      securityPatch: patchDateString || null,
      securityPatchDate: patchDate ? patchDate.toISOString().split('T')[0] : null,
      ageDays,
      securityStatus: securityStatus.status,
      securityLevel: securityStatus.level,
      securityColor: securityStatus.color,
      securityMessage: securityStatus.message,
      androidVersion,
      buildDate,
      currentDate: currentDate.toISOString().split('T')[0],
      isCurrent: securityStatus.status === 'current',
      isOutdated: securityStatus.status === 'outdated',
      isCritical: securityStatus.status === 'critical'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * GET /api/v1/security/security-patch/:serial
 * Get security patch level for a device
 */
router.get('/:serial', async (req, res) => {
  const { serial } = req.params;

  try {
    // Verify ADB is available
    if (!(await commandExistsSafe('adb'))) {
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required for security patch detection', {
        tool: 'adb',
        installInstructions: 'Install Android SDK Platform Tools'
      }, 503);
    }

    // Verify device is connected
    const devicesResult = await ADBLibrary.listDevices();
    if (!devicesResult.success) {
      return res.sendError('DEVICE_SCAN_FAILED', 'Failed to scan for devices', {
        error: devicesResult.error
      }, 500);
    }

    const device = devicesResult.devices.find(d => d.serial === serial);
    if (!device) {
      return res.sendError('DEVICE_NOT_FOUND', 'Device not found or not connected', {
        serial,
        availableDevices: devicesResult.devices.map(d => d.serial)
      }, 404);
    }

    if (device.state !== 'device') {
      return res.sendError('DEVICE_NOT_READY', 'Device must be in device state for security patch detection', {
        serial,
        currentState: device.state,
        requiredState: 'device'
      }, 400);
    }

    // Get security patch level
    const result = await getSecurityPatchLevel(serial);

    if (!result.success) {
      return res.sendError('SECURITY_PATCH_CHECK_FAILED', result.error, {
        serial
      }, 500);
    }

    res.sendEnvelope({
      serial,
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to check security patch level', {
      error: error.message,
      serial
    }, 500);
  }
});

/**
 * GET /api/v1/security/security-patch
 * Get security patch level for all connected devices
 */
router.get('/', async (req, res) => {
  try {
    // Verify ADB is available
    if (!(await commandExistsSafe('adb'))) {
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required for security patch detection', {
        tool: 'adb',
        installInstructions: 'Install Android SDK Platform Tools'
      }, 503);
    }

    // Get all devices
    const devicesResult = await ADBLibrary.listDevices();
    if (!devicesResult.success) {
      return res.sendError('DEVICE_SCAN_FAILED', 'Failed to scan for devices', {
        error: devicesResult.error
      }, 500);
    }

    // Get security patch level for each device
    const devices = devicesResult.devices.filter(d => d.state === 'device');
    const results = await Promise.all(
      devices.map(async (device) => {
        const patchInfo = await getSecurityPatchLevel(device.serial);
        return {
          serial: device.serial,
          state: device.state,
          patchInfo: patchInfo.success ? {
            securityPatch: patchInfo.securityPatch,
            securityPatchDate: patchInfo.securityPatchDate,
            ageDays: patchInfo.ageDays,
            securityStatus: patchInfo.securityStatus,
            securityLevel: patchInfo.securityLevel,
            securityColor: patchInfo.securityColor,
            androidVersion: patchInfo.androidVersion
          } : { error: patchInfo.error }
        };
      })
    );

    res.sendEnvelope({
      devices: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to check security patch level for devices', {
      error: error.message
    }, 500);
  }
});

export default router;
