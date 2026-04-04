/**
 * Device Encryption Status Detection API
 * 
 * Detects device encryption status (FDE/FBE) on Android devices.
 * Provides detailed information about encryption state and type.
 * 
 * @module security-encryption-status
 */

import express from 'express';
import ADBLibrary from '../../../../core/lib/adb.js';
import { safeSpawn, commandExistsSafe } from '../../../utils/safe-exec.js';

const router = express.Router();

/**
 * Get device encryption status
 * @param {string} deviceSerial - Device serial number
 * @returns {Promise<Object>} Encryption status information
 */
async function getEncryptionStatus(deviceSerial) {
  try {
    // Get encryption-related properties
    const properties = await ADBLibrary.getProperties(deviceSerial);
    
    if (!properties.success) {
      return {
        success: false,
        error: 'Failed to get device properties'
      };
    }

    const props = properties.properties;
    
    // Key properties for encryption detection
    const cryptoState = props['ro.crypto.state']; // 'encrypted', 'unencrypted', 'unsupported'
    const cryptoType = props['ro.crypto.type']; // 'file', 'block' (FDE vs FBE)
    const fileEncryption = props['ro.crypto.fde_syscall']; // FDE-specific
    const fbeEncryption = props['ro.crypto.fde_enabled']; // FBE-specific
    const voldDecrypt = props['vold.decrypt']; // 'trigger_restart_framework', 'trigger_restart_min_framework', 'trigger_shutdown_framework'
    const voldEncrypt = props['vold.encrypt_progress']; // Encryption progress
    
    // Determine encryption status
    let isEncrypted = false;
    let encryptionType = 'unknown';
    let encryptionState = 'unknown';
    const evidence = [];
    
    // Check 1: Crypto state (most reliable)
    if (cryptoState) {
      const state = cryptoState.toLowerCase();
      if (state === 'encrypted') {
        isEncrypted = true;
        encryptionState = 'encrypted';
        evidence.push(`ro.crypto.state: ${state}`);
      } else if (state === 'unencrypted') {
        isEncrypted = false;
        encryptionState = 'unencrypted';
        evidence.push(`ro.crypto.state: ${state}`);
      } else if (state === 'unsupported') {
        encryptionState = 'unsupported';
        evidence.push(`ro.crypto.state: ${state} (encryption not supported)`);
      }
    }
    
    // Check 2: Encryption type (FDE vs FBE)
    if (cryptoType) {
      const type = cryptoType.toLowerCase();
      if (type === 'file') {
        encryptionType = 'FBE'; // File-Based Encryption
        evidence.push(`ro.crypto.type: ${type} (File-Based Encryption)`);
      } else if (type === 'block') {
        encryptionType = 'FDE'; // Full Disk Encryption
        evidence.push(`ro.crypto.type: ${type} (Full Disk Encryption)`);
      }
    }
    
    // Check 3: FDE-specific indicators
    if (fileEncryption) {
      encryptionType = 'FDE';
      evidence.push(`FDE-specific property found`);
    }
    
    // Check 4: FBE-specific indicators
    if (fbeEncryption === 'true' || fbeEncryption === '1') {
      encryptionType = 'FBE';
      evidence.push(`FBE-specific property found`);
    }
    
    // Check 5: Vold decrypt status (indicates encryption state)
    if (voldDecrypt) {
      if (voldDecrypt === 'trigger_restart_framework' || voldDecrypt === 'trigger_restart_min_framework') {
        // Device is encrypted and decrypting
        isEncrypted = true;
        evidence.push(`vold.decrypt: ${voldDecrypt} (encrypted, decrypting)`);
      }
    }
    
    // Determine confidence
    let confidence = 'medium';
    if (cryptoState && (cryptoState === 'encrypted' || cryptoState === 'unencrypted')) {
      confidence = 'high';
    } else if (encryptionType !== 'unknown') {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    // Get encryption algorithm if available
    const cryptoAlgorithm = props['ro.crypto.fs_crypto_blkdev'] || props['ro.crypto.fs_crypto_key'] || null;
    
    // Get Android version to determine default encryption
    const androidVersion = parseInt(props['ro.build.version.release'] || '0');
    const defaultEncryption = androidVersion >= 9 ? 'FBE' : 'FDE'; // Android 9+ uses FBE by default
    
    return {
      success: true,
      isEncrypted,
      encryptionType,
      encryptionState,
      confidence,
      defaultEncryption,
      algorithm: cryptoAlgorithm,
      evidence,
      properties: {
        cryptoState,
        cryptoType,
        fileEncryption,
        fbeEncryption,
        voldDecrypt,
        voldEncrypt
      },
      androidVersion,
      note: androidVersion >= 9 && !isEncrypted 
        ? 'Android 9+ devices should have encryption enabled by default. Unencrypted state may indicate modified device.'
        : null
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * GET /api/v1/security/encryption-status/:serial
 * Get device encryption status
 */
router.get('/:serial', async (req, res) => {
  const { serial } = req.params;

  try {
    // Verify ADB is available
    if (!(await commandExistsSafe('adb'))) {
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required for encryption status detection', {
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
      return res.sendError('DEVICE_NOT_READY', 'Device must be in device state for encryption detection', {
        serial,
        currentState: device.state,
        requiredState: 'device'
      }, 400);
    }

    // Get encryption status
    const result = await getEncryptionStatus(serial);

    if (!result.success) {
      return res.sendError('ENCRYPTION_CHECK_FAILED', result.error, {
        serial
      }, 500);
    }

    res.sendEnvelope({
      serial,
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to check encryption status', {
      error: error.message,
      serial
    }, 500);
  }
});

/**
 * GET /api/v1/security/encryption-status
 * Get encryption status for all connected devices
 */
router.get('/', async (req, res) => {
  try {
    // Verify ADB is available
    if (!(await commandExistsSafe('adb'))) {
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required for encryption status detection', {
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

    // Get encryption status for each device
    const devices = devicesResult.devices.filter(d => d.state === 'device');
    const results = await Promise.all(
      devices.map(async (device) => {
        const status = await getEncryptionStatus(device.serial);
        return {
          serial: device.serial,
          state: device.state,
          status: status.success ? {
            isEncrypted: status.isEncrypted,
            encryptionType: status.encryptionType,
            encryptionState: status.encryptionState,
            confidence: status.confidence
          } : { error: status.error }
        };
      })
    );

    res.sendEnvelope({
      devices: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to check encryption status for devices', {
      error: error.message
    }, 500);
  }
});

export default router;
