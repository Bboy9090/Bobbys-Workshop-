/**
 * The Unlock Chamber - Secret Room #1
 * 
 * Complete device unlock automation:
 * - FRP bypass (owner devices only)
 * - Bootloader unlock automation
 * - OEM unlock enable
 * - Security patch bypass (testing)
 * 
 * @module trapdoor-unlock
 */

import express from 'express';
import ShadowLogger from '../../../../core/lib/shadow-logger.js';
import ADBLibrary from '../../../../core/lib/adb.js';
import { safeSpawn, commandExistsSafe } from '../../../utils/safe-exec.js';
import { acquireDeviceLock, releaseDeviceLock } from '../../../locks.js';

const router = express.Router();
const shadowLogger = new ShadowLogger();

/**
 * POST /api/v1/trapdoor/unlock/bootloader
 * Automatically unlock bootloader (requires confirmation)
 */
router.post('/bootloader', async (req, res) => {
  const { deviceSerial, confirmation } = req.body;

  if (!deviceSerial) {
    return res.sendError('VALIDATION_ERROR', 'Device serial is required', null, 400);
  }

  if (confirmation !== 'UNLOCK') {
    return res.sendConfirmationRequired('Type "UNLOCK" to confirm bootloader unlock', {
      operation: 'bootloader_unlock',
      warning: 'This will void warranty and may brick device if done incorrectly'
    });
  }

  // Check policy
  if (process.env.ALLOW_BOOTLOADER_UNLOCK !== '1') {
    return res.sendPolicyBlocked('Bootloader unlock is disabled. Set ALLOW_BOOTLOADER_UNLOCK=1 to enable.', {
      operation: 'bootloader_unlock',
      policy: 'ALLOW_BOOTLOADER_UNLOCK'
    });
  }

  // Acquire device lock
  const lockResult = await acquireDeviceLock(deviceSerial, 'trapdoor_bootloader_unlock');
  if (!lockResult.acquired) {
    return res.sendDeviceLocked(lockResult.reason, {
      lockedBy: lockResult.lockedBy
    });
  }

  try {
    // Log to shadow
    await shadowLogger.logShadow({
      operation: 'bootloader_unlock',
      deviceSerial,
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: false, // Will update on completion
      metadata: {
        method: req.method,
        path: req.path,
        confirmation: 'provided'
      }
    });

    // Verify device is in Fastboot mode
    if (!(await commandExistsSafe('fastboot'))) {
      releaseDeviceLock(deviceSerial);
      return res.sendError('TOOL_NOT_AVAILABLE', 'Fastboot is not installed', null, 503);
    }

    const fastbootDevices = await safeSpawn('fastboot', ['devices'], { timeout: 5000 });
    if (!fastbootDevices.success || !fastbootDevices.stdout.includes(deviceSerial)) {
      releaseDeviceLock(deviceSerial);
      return res.sendError('DEVICE_NOT_FOUND', 'Device not found in Fastboot mode', {
        serial: deviceSerial,
        instructions: [
          '1. Enable USB debugging',
          '2. Run: adb reboot bootloader',
          '3. Or use hardware keys: Power + Volume Down (varies by device)'
        ]
      }, 404);
    }

    // Execute unlock
    const unlockResult = await safeSpawn('fastboot', ['-s', deviceSerial, 'oem', 'unlock'], {
      timeout: 60000
    });

    releaseDeviceLock(deviceSerial);

    if (!unlockResult.success) {
      await shadowLogger.logShadow({
        operation: 'bootloader_unlock',
        deviceSerial,
        userId: req.ip,
        authorization: 'TRAPDOOR',
        success: false,
        metadata: {
          error: unlockResult.error || unlockResult.stderr,
          stderr: unlockResult.stderr
        }
      });

      return res.sendError('UNLOCK_FAILED', unlockResult.error || unlockResult.stderr || 'Bootloader unlock failed', {
        serial: deviceSerial,
        stderr: unlockResult.stderr,
        stdout: unlockResult.stdout
      }, 500);
    }

    // Log success
    await shadowLogger.logShadow({
      operation: 'bootloader_unlock',
      deviceSerial,
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: true,
      metadata: {
        method: req.method,
        path: req.path,
        output: unlockResult.stdout
      }
    });

    res.sendEnvelope({
      success: true,
      message: 'Bootloader unlock initiated',
      deviceSerial,
      output: unlockResult.stdout,
      warning: 'Device will reboot. Bootloader is now unlocked. Warranty may be voided.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    releaseDeviceLock(deviceSerial);
    res.sendError('INTERNAL_ERROR', 'Failed to unlock bootloader', {
      error: error.message,
      deviceSerial
    }, 500);
  }
});

/**
 * POST /api/v1/trapdoor/unlock/frp
 * Bypass FRP lock (owner devices only)
 */
router.post('/frp', async (req, res) => {
  const { deviceSerial, confirmation } = req.body;

  if (!deviceSerial) {
    return res.sendError('VALIDATION_ERROR', 'Device serial is required', null, 400);
  }

  if (confirmation !== 'BYPASS') {
    return res.sendConfirmationRequired('Type "BYPASS" to confirm FRP bypass', {
      operation: 'frp_bypass',
      warning: 'This operation is for owner devices only. Unauthorized use is illegal.'
    });
  }

  // Acquire device lock
  const lockResult = await acquireDeviceLock(deviceSerial, 'trapdoor_frp_bypass');
  if (!lockResult.acquired) {
    return res.sendDeviceLocked(lockResult.reason, {
      lockedBy: lockResult.lockedBy
    });
  }

  try {
    // Log to shadow
    await shadowLogger.logShadow({
      operation: 'frp_bypass',
      deviceSerial,
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: false,
      metadata: {
        method: req.method,
        path: req.path,
        confirmation: 'provided'
      }
    });

    // FRP bypass methods vary by device and Android version
    // This is a simplified example - real implementation would be device-specific
    const adbInstalled = await ADBLibrary.isInstalled();
    if (!adbInstalled) {
      releaseDeviceLock(deviceSerial);
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required for FRP bypass', null, 503);
    }

    // Check device state
    const devicesResult = await ADBLibrary.listDevices();
    const device = devicesResult.devices?.find(d => d.serial === deviceSerial);
    
    if (!device) {
      releaseDeviceLock(deviceSerial);
      return res.sendError('DEVICE_NOT_FOUND', 'Device not found', {
        serial: deviceSerial
      }, 404);
    }

    // FRP bypass implementation - attempts common methods
    // Note: Methods vary by device manufacturer and Android version
    const logs = [];
    let success = false;
    let method = 'unknown';

    try {
      // Method 1: Clear FRP partition via ADB shell (requires root or recovery mode)
      const clearFRPResult = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'rm', '-rf', '/persist/frp'], {
        timeout: 10000
      });
      
      if (clearFRPResult.success) {
        logs.push({ level: 'info', message: 'Attempted to clear FRP partition' });
        method = 'partition_clear';
      }

      // Method 2: Clear FRP properties (if device allows)
      const clearPropsResult = await safeSpawn('adb', ['-s', deviceSerial, 'shell', 'setprop', 'ro.frp.pst', ''], {
        timeout: 10000
      });
      
      if (clearPropsResult.success) {
        logs.push({ level: 'info', message: 'Attempted to clear FRP properties' });
        if (method === 'unknown') method = 'property_clear';
      }

      // Method 3: Factory reset via recovery (if device supports)
      // This is a last resort and requires user confirmation
      const factoryResetResult = await safeSpawn('adb', ['-s', deviceSerial, 'reboot', 'recovery'], {
        timeout: 5000
      });
      
      if (factoryResetResult.success) {
        logs.push({ level: 'info', message: 'Rebooted to recovery mode - manual factory reset may be required' });
        if (method === 'unknown') method = 'recovery_reboot';
      }

      // Check if device is still accessible
      const verifyResult = await ADBLibrary.listDevices();
      const deviceStillConnected = verifyResult.devices?.some(d => d.serial === deviceSerial);
      
      if (deviceStillConnected) {
        // Verify FRP status
        const frpStatus = await ADBLibrary.checkFRPStatus(deviceSerial);
        if (frpStatus.success && !frpStatus.hasFRP) {
          success = true;
          logs.push({ level: 'success', message: 'FRP bypass appears successful - device no longer shows FRP lock' });
        } else {
          logs.push({ level: 'warn', message: 'FRP status check inconclusive - device may still be locked' });
        }
      }

      // Log success/failure
      await shadowLogger.logShadow({
        operation: 'frp_bypass',
        deviceSerial,
        userId: req.ip,
        authorization: 'TRAPDOOR',
        success,
        metadata: {
          method,
          logs: logs.map(l => l.message),
          deviceStillConnected
        }
      });

      releaseDeviceLock(deviceSerial);

      if (success) {
        return res.sendEnvelope({
          success: true,
          message: 'FRP bypass completed',
          deviceSerial,
          method,
          logs,
          warning: 'Device may require reboot. Verify FRP status after reboot.',
          note: 'FRP bypass methods vary by device. If this method did not work, consult device-specific guides.',
          timestamp: new Date().toISOString()
        });
      } else {
        return res.sendEnvelope({
          success: false,
          message: 'FRP bypass attempted but status unclear',
          deviceSerial,
          method,
          logs,
          instructions: [
            '1. Verify device is in recovery mode or has root access',
            '2. Some devices require hardware button combinations',
            '3. Consult device-specific FRP bypass guides',
            '4. This operation is for owner devices only'
          ],
          note: 'FRP bypass methods are highly device-specific. Manual methods may be required.',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      releaseDeviceLock(deviceSerial);
      
      await shadowLogger.logShadow({
        operation: 'frp_bypass',
        deviceSerial,
        userId: req.ip,
        authorization: 'TRAPDOOR',
        success: false,
        metadata: {
          error: error.message
        }
      });

      return res.sendError('INTERNAL_ERROR', 'FRP bypass failed', {
        error: error.message,
        deviceSerial,
        note: 'FRP bypass methods vary by device manufacturer and Android version. Consult device-specific guides.',
        legal: 'This operation is for owner devices only. Unauthorized use is illegal.'
      }, 500);
    }
  } catch (error) {
    releaseDeviceLock(deviceSerial);
    res.sendError('INTERNAL_ERROR', 'Failed to bypass FRP', {
      error: error.message,
      deviceSerial
    }, 500);
  }
});

export default router;

