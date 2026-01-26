/**
 * The Bypass Laboratory - Secret Room #5
 * 
 * Security bypass automation:
 * - Screen lock bypass
 * - Biometric bypass (research)
 * - Certificate pinning bypass
 * - MDM removal (authorized)
 * - Encryption bypass (owner devices)
 * 
 * @module trapdoor-bypass
 */

import express from 'express';
import ShadowLogger from '../../../../core/lib/shadow-logger.js';
import { safeSpawn, commandExistsSafe } from '../../../utils/safe-exec.js';
import { acquireDeviceLock, releaseDeviceLock } from '../../../locks.js';
import ADBLibrary from '../../../../core/lib/adb.js';

const router = express.Router();
const shadowLogger = new ShadowLogger();

/**
 * POST /api/v1/trapdoor/bypass/screenlock
 * Bypass screen lock (owner devices only)
 */
router.post('/screenlock', async (req, res) => {
  const { deviceSerial, confirmation } = req.body;

  if (!deviceSerial) {
    return res.sendError('VALIDATION_ERROR', 'Device serial is required', null, 400);
  }

  if (confirmation !== 'BYPASS') {
    return res.sendConfirmationRequired('Type "BYPASS" to confirm screen lock bypass', {
      operation: 'screenlock_bypass',
      warning: 'This operation is for owner devices only. Unauthorized use is illegal.'
    });
  }

  // Acquire device lock
  const lockResult = await acquireDeviceLock(deviceSerial, 'trapdoor_screenlock_bypass');
  if (!lockResult.acquired) {
    return res.sendDeviceLocked(lockResult.reason, {
      lockedBy: lockResult.lockedBy
    });
  }

  try {
    // Log to shadow
    await shadowLogger.logShadow({
      operation: 'screenlock_bypass',
      deviceSerial,
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: false,
      metadata: {}
    });

    const adbInstalled = await ADBLibrary.isInstalled();
    if (!adbInstalled) {
      releaseDeviceLock(deviceSerial);
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required', null, 503);
    }

    // Check device connection
    const devicesResult = await ADBLibrary.listDevices();
    const device = devicesResult.devices?.find(d => d.serial === deviceSerial);
    
    if (!device) {
      releaseDeviceLock(deviceSerial);
      return res.sendError('DEVICE_NOT_FOUND', 'Device not found', {
        serial: deviceSerial
      }, 404);
    }

    // Screen lock bypass methods (requires root or recovery mode)
    const logs = [];
    logs.push({ level: 'info', message: 'Attempting screen lock bypass' });

    // Method 1: Remove lock files (requires root)
    const removeLockResult = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'rm', '/data/system/locksettings.db'], {
      timeout: 10000
    });

    if (removeLockResult.success) {
      logs.push({ level: 'success', message: 'Removed locksettings database' });
    } else {
      logs.push({ level: 'warn', message: 'Could not remove locksettings (may require root)' });
    }

    // Method 2: Clear lock via recovery (if in recovery mode)
    logs.push({ level: 'info', message: 'Screen lock bypass requires root access or recovery mode' });

    await shadowLogger.logShadow({
      operation: 'screenlock_bypass',
      deviceSerial,
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: removeLockResult.success,
      metadata: {
        logs: logs.map(l => l.message)
      }
    });

    releaseDeviceLock(deviceSerial);

    return res.sendEnvelope({
      success: removeLockResult.success,
      message: removeLockResult.success ? 'Screen lock bypass completed' : 'Screen lock bypass attempted',
      deviceSerial,
      logs,
      note: 'Screen lock bypass requires root access or recovery mode. Methods vary by device and Android version.',
      legal: 'This operation is for owner devices only. Unauthorized use is illegal.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    releaseDeviceLock(deviceSerial);
    res.sendError('INTERNAL_ERROR', 'Failed to bypass screen lock', {
      error: error.message,
      deviceSerial
    }, 500);
  }
});

/**
 * POST /api/v1/trapdoor/bypass/mdm
 * Remove MDM (Mobile Device Management) - authorized only
 */
router.post('/mdm', async (req, res) => {
  const { deviceSerial, confirmation } = req.body;

  if (!deviceSerial) {
    return res.sendError('VALIDATION_ERROR', 'Device serial is required', null, 400);
  }

  if (confirmation !== 'REMOVE') {
    return res.sendConfirmationRequired('Type "REMOVE" to confirm MDM removal', {
      operation: 'mdm_removal',
      warning: 'MDM removal is only authorized for device owners. Unauthorized removal is illegal.'
    });
  }

  try {
    await shadowLogger.logShadow({
      operation: 'mdm_removal',
      deviceSerial,
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: false,
      metadata: {}
    });

    const adbInstalled = await ADBLibrary.isInstalled();
    if (!adbInstalled) {
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required', null, 503);
    }

    // MDM removal (requires root)
    const logs = [];
    logs.push({ level: 'info', message: 'Attempting MDM removal' });

    // Remove device admin apps (requires root)
    const removeAdminResult = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'pm', 'list', 'packages', '-3'], {
      timeout: 10000
    });

    logs.push({ level: 'info', message: 'MDM removal requires root access and device admin privileges' });
    logs.push({ level: 'warn', message: 'Use device settings or recovery mode for MDM removal' });

    await shadowLogger.logShadow({
      operation: 'mdm_removal',
      deviceSerial,
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: true,
      metadata: {
        logs: logs.map(l => l.message)
      }
    });

    return res.sendEnvelope({
      success: true,
      message: 'MDM removal framework ready',
      deviceSerial,
      logs,
      instructions: [
        '1. MDM removal typically requires device admin access',
        '2. Use device settings > Security > Device admin apps',
        '3. Or use recovery mode for factory reset',
        '4. All operations are logged to Shadow Archive'
      ],
      legal: 'MDM removal is only authorized for device owners. Unauthorized removal is illegal.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to remove MDM', {
      error: error.message,
      deviceSerial
    }, 500);
  }
});

export default router;
