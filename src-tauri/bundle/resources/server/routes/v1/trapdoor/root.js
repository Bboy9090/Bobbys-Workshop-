/**
 * The Root Vault - Secret Room #4
 * 
 * Root installation and management:
 * - Magisk installation
 * - SuperSU installation
 * - Xposed framework
 * - Root verification
 * - System app management
 * 
 * @module trapdoor-root
 */

import express from 'express';
import ShadowLogger from '../../../../core/lib/shadow-logger.js';
import { safeSpawn, commandExistsSafe } from '../../../utils/safe-exec.js';
import { acquireDeviceLock, releaseDeviceLock } from '../../../locks.js';
import ADBLibrary from '../../../../core/lib/adb.js';

const router = express.Router();
const shadowLogger = new ShadowLogger();

/**
 * POST /api/v1/trapdoor/root/install
 * Install root on Android device
 */
router.post('/install', async (req, res) => {
  const { deviceSerial, method, confirmation } = req.body;

  if (!deviceSerial) {
    return res.sendError('VALIDATION_ERROR', 'Device serial is required', null, 400);
  }

  if (!method || !['magisk', 'supersu', 'custom'].includes(method)) {
    return res.sendError('VALIDATION_ERROR', 'Valid root method is required (magisk, supersu, custom)', null, 400);
  }

  if (confirmation !== 'ROOT') {
    return res.sendConfirmationRequired('Type "ROOT" to confirm root installation', {
      operation: 'root_install',
      warning: 'Rooting may void warranty and can cause security issues.'
    });
  }

  // Acquire device lock
  const lockResult = await acquireDeviceLock(deviceSerial, 'trapdoor_root_install');
  if (!lockResult.acquired) {
    return res.sendDeviceLocked(lockResult.reason, {
      lockedBy: lockResult.lockedBy
    });
  }

  try {
    // Log to shadow
    await shadowLogger.logShadow({
      operation: 'root_install',
      deviceSerial,
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: false,
      metadata: { method }
    });

    // Check ADB availability
    const adbInstalled = await ADBLibrary.isInstalled();
    if (!adbInstalled) {
      releaseDeviceLock(deviceSerial);
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required for root installation', null, 503);
    }

    // Verify device connection
    const devicesResult = await ADBLibrary.listDevices();
    const device = devicesResult.devices?.find(d => d.serial === deviceSerial);
    
    if (!device) {
      releaseDeviceLock(deviceSerial);
      return res.sendError('DEVICE_NOT_FOUND', 'Device not found', {
        serial: deviceSerial
      }, 404);
    }

    // Check if device is already rooted
    const rootCheck = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'su', '-c', 'id'], {
      timeout: 5000
    });

    if (rootCheck.success) {
      releaseDeviceLock(deviceSerial);
      return res.sendEnvelope({
        success: true,
        message: 'Device is already rooted',
        deviceSerial,
        method: 'existing',
        note: 'Device already has root access',
        timestamp: new Date().toISOString()
      });
    }

    // Root installation framework
    const logs = [];
    logs.push({ level: 'info', message: `Initiating ${method} root installation` });
    logs.push({ level: 'info', message: 'Device serial: ' + deviceSerial });

    // Note: Actual root installation requires:
    // - Unlocked bootloader
    // - Custom recovery (TWRP, etc.)
    // - Root package (Magisk ZIP, SuperSU, etc.)
    logs.push({ level: 'warn', message: 'Root installation requires unlocked bootloader and custom recovery' });
    logs.push({ level: 'info', message: `Use ${method} installation package via recovery mode` });

    await shadowLogger.logShadow({
      operation: 'root_install',
      deviceSerial,
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: true,
      metadata: {
        method,
        logs: logs.map(l => l.message)
      }
    });

    releaseDeviceLock(deviceSerial);

    return res.sendEnvelope({
      success: true,
      message: 'Root installation framework ready',
      deviceSerial,
      method,
      logs,
      instructions: [
        '1. Ensure bootloader is unlocked',
        '2. Install custom recovery (TWRP recommended)',
        `3. Flash ${method} package via recovery`,
        '4. Reboot and verify root access',
        '5. All operations are logged to Shadow Archive'
      ],
      note: 'Root installation requires device-specific packages and unlocked bootloader.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    releaseDeviceLock(deviceSerial);
    res.sendError('INTERNAL_ERROR', 'Failed to install root', {
      error: error.message,
      deviceSerial
    }, 500);
  }
});

/**
 * POST /api/v1/trapdoor/root/verify
 * Verify root status on device
 */
router.post('/verify', async (req, res) => {
  const { deviceSerial } = req.body;

  if (!deviceSerial) {
    return res.sendError('VALIDATION_ERROR', 'Device serial is required', null, 400);
  }

  try {
    const adbInstalled = await ADBLibrary.isInstalled();
    if (!adbInstalled) {
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required', null, 503);
    }

    // Check root via su command
    const rootCheck = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'su', '-c', 'id'], {
      timeout: 5000
    });

    const isRooted = rootCheck.success;
    const rootMethod = isRooted ? 'detected' : 'none';

    // Check for common root binaries
    const magiskCheck = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'which', 'magisk'], {
      timeout: 5000
    });
    const supersuCheck = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'which', 'su'], {
      timeout: 5000
    });

    return res.sendEnvelope({
      rooted: isRooted,
      method: rootMethod,
      hasMagisk: magiskCheck.success,
      hasSuperSU: supersuCheck.success && !magiskCheck.success,
      deviceSerial,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to verify root status', {
      error: error.message,
      deviceSerial
    }, 500);
  }
});

export default router;
