/**
 * FRP Detection API endpoints
 * 
 * Factory Reset Protection (FRP) lock **detection only** (read-only).
 */

import express from 'express';
import ADBLibrary from '../../utils/adb-library-wrapper.js';

const router = express.Router();

/**
 * POST /api/v1/frp/detect
 * Detect FRP lock status on Android device
 */
router.post('/detect', async (req, res) => {
  const { serial } = req.body;

  if (!serial) {
    return res.sendError('VALIDATION_ERROR', 'Device serial is required', null, 400);
  }

  try {
    const adbInstalled = await ADBLibrary.isInstalled();
    if (!adbInstalled) {
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required for FRP detection', null, 503);
    }

    const devicesResult = await ADBLibrary.listDevices();
    const device = devicesResult.devices?.find(d => d.serial === serial);
    if (!device) {
      return res.sendError('DEVICE_NOT_FOUND', 'Device not found via ADB', { serial }, 404);
    }

    const status = await ADBLibrary.checkFRPStatus(serial);
    return res.sendEnvelope({
      serial,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.sendError('INTERNAL_ERROR', 'FRP detection failed', { error: error.message, serial }, 500);
  }
});

/**
 * POST /api/v1/frp/bypass
 * FRP bypass is not supported.
 */
router.post('/bypass', async (req, res) => {
  return res.sendPolicyBlocked(
    'FRP bypass is not supported. Use official vendor recovery flows and ownership verification.',
    { operation: 'frp_bypass' }
  );
});

export default router;

