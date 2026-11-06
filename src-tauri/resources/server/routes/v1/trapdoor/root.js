/**
 * The Root Vault - Secret Room #4
 * 
 * Root installation and management:
 * - Magisk installation
 * - SuperSU installation
 * - Xposed framework
 * - Root verification & status inspection
 * - System app management
 * 
 * @module trapdoor-root
 */

import express from 'express';
import ShadowLogger from '../../../../core/lib/shadow-logger.js';
import { safeSpawn } from '../../../utils/safe-exec.js';
import { acquireDeviceLock, releaseDeviceLock } from '../../../locks.js';
import ADBLibrary from '../../../../core/lib/adb.js';

const router = express.Router();
const shadowLogger = new ShadowLogger();

const ALLOWED_ROOT_METHODS = ['magisk', 'supersu', 'xposed', 'custom'];

/**
 * Shared root verification logic for /verify and /status
 */
async function handleVerifyRootStatus(req, res) {
  const { deviceSerial } = req.body;

  if (!deviceSerial) {
    return res.sendError('VALIDATION_ERROR', 'Device serial is required', null, 400);
  }

  try {
    const adbInstalled = await ADBLibrary.isInstalled();
    if (!adbInstalled) {
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required', null, 503);
    }

    const rootCheck = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'su', '-c', 'id'], {
      timeout: 5000
    });

    const isRooted = rootCheck.success && (rootCheck.stdout || '').includes('uid=0');

    const magiskCheck = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'which', 'magisk'], {
      timeout: 5000
    });
    const supersuCheck = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'which', 'su'], {
      timeout: 5000
    });
    const xposedProp = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'getprop', 'ro.xposed.version'], {
      timeout: 5000
    });

    const hasMagisk = magiskCheck.success && Boolean((magiskCheck.stdout || '').trim());
    const hasSuperSU = supersuCheck.success && Boolean((supersuCheck.stdout || '').trim()) && !hasMagisk;
    const hasXposed = xposedProp.success && Boolean((xposedProp.stdout || '').trim());

    let rootMethod = 'none';
    if (hasMagisk) {
      rootMethod = 'magisk';
    } else if (hasSuperSU || isRooted) {
      rootMethod = hasSuperSU ? 'supersu' : 'detected';
    }

    return res.sendEnvelope({
      rooted: isRooted || hasMagisk,
      method: rootMethod,
      hasMagisk,
      hasSuperSU,
      hasXposed,
      deviceSerial,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.sendError('INTERNAL_ERROR', 'Failed to verify root status', {
      error: error.message,
      deviceSerial
    }, 500);
  }
}

/**
 * POST /api/v1/trapdoor/root/install
 * Install root on Android device
 */
router.post('/install', async (req, res) => {
  const { deviceSerial, method, confirmation } = req.body;

  if (!deviceSerial) {
    return res.sendError('VALIDATION_ERROR', 'Device serial is required', null, 400);
  }

  if (!method || !ALLOWED_ROOT_METHODS.includes(method)) {
    return res.sendError(
      'VALIDATION_ERROR',
      `Valid root method is required (${ALLOWED_ROOT_METHODS.join(', ')})`,
      null,
      400
    );
  }

  if (confirmation !== 'ROOT') {
    return res.sendConfirmationRequired('Type "ROOT" to confirm root installation', {
      operation: 'root_install',
      warning: 'Rooting may void warranty and can cause security issues.'
    });
  }

  const lockResult = await acquireDeviceLock(deviceSerial, 'trapdoor_root_install');
  if (!lockResult.acquired) {
    return res.sendDeviceLocked(lockResult.reason, {
      lockedBy: lockResult.lockedBy
    });
  }

  try {
    await shadowLogger.logShadow({
      operation: 'root_install',
      deviceSerial,
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: false,
      metadata: { method }
    });

    const adbInstalled = await ADBLibrary.isInstalled();
    if (!adbInstalled) {
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required for root installation', null, 503);
    }

    const devicesResult = await ADBLibrary.listDevices();
    const device = devicesResult.devices?.find(d => d.serial === deviceSerial);

    if (!device) {
      return res.sendError('DEVICE_NOT_FOUND', 'Device not found', {
        serial: deviceSerial
      }, 404);
    }

    const rootCheck = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'su', '-c', 'id'], {
      timeout: 5000
    });

    if (rootCheck.success && (rootCheck.stdout || '').includes('uid=0') && method !== 'xposed') {
      return res.sendEnvelope({
        success: true,
        message: 'Device is already rooted',
        deviceSerial,
        method: 'existing',
        note: 'Device already has root access',
        timestamp: new Date().toISOString()
      });
    }

    const logs = [
      { level: 'info', message: `Initiating ${method} root installation` },
      { level: 'info', message: `Device serial: ${deviceSerial}` },
      { level: 'warn', message: 'Root installation requires unlocked bootloader and custom recovery' },
      { level: 'info', message: `Use ${method} installation package via recovery or patched boot image` }
    ];

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

    return res.sendEnvelope({
      success: true,
      message: 'Root installation framework ready',
      deviceSerial,
      method,
      logs,
      instructions: [
        '1. Ensure bootloader is unlocked',
        '2. Install custom recovery (TWRP recommended) or patch boot.img',
        `3. Flash ${method} package via recovery or fastboot`,
        '4. Reboot and verify root access',
        '5. All operations are logged to Shadow Archive'
      ],
      note: 'Root installation requires device-specific packages and unlocked bootloader.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.sendError('INTERNAL_ERROR', 'Failed to install root', {
      error: error.message,
      deviceSerial
    }, 500);
  } finally {
    releaseDeviceLock(deviceSerial);
  }
});

/**
 * POST /api/v1/trapdoor/root/verify
 * Verify root status on device
 */
router.post('/verify', handleVerifyRootStatus);

/**
 * POST /api/v1/trapdoor/root/status
 * Alias for root status verification used by TrapdoorRootVault frontend
 */
router.post('/status', handleVerifyRootStatus);

export default router;
