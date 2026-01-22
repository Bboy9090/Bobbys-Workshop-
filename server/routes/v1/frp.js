/**
 * FRP Detection API endpoints
 * 
 * Factory Reset Protection (FRP) lock detection and bypass (owner devices only)
 */

import express from 'express';
import ADBLibrary from '../../utils/adb-library-wrapper.js';

const router = express.Router();

/**
 * POST /api/v1/frp/detect
 * Detect FRP lock status on Android device
 * NOTE: Temporarily disabled - ADBLibrary methods need to be implemented
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
      return res.sendError('DEVICE_NOT_FOUND', 'Device not detected via ADB', { serial }, 404);
    }

    const frpResult = await ADBLibrary.checkFRPStatus(serial);
    if (!frpResult.success) {
      return res.sendError('FRP_DETECTION_FAILED', 'Unable to detect FRP status', {
        serial,
        error: frpResult.error
      }, 500);
    }

    return res.sendEnvelope({
      serial,
      frp: {
        enabled: frpResult.hasFRP,
        confidence: frpResult.confidence,
        androidId: frpResult.androidId || null,
        properties: frpResult.properties || {}
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.sendError('INTERNAL_ERROR', 'FRP detection failed', { error: error.message }, 500);
  }
});

/**
 * POST /api/v1/frp/bypass
 * Bypass FRP lock (owner devices only - must be in trapdoor/secret room)
 * This endpoint should only be accessible via trapdoor API
 */
router.post('/bypass', async (req, res) => {
  // This should be handled by trapdoor router, but included here for completeness
  return res.sendError('FORBIDDEN', 'FRP bypass must be performed through trapdoor API', {
    redirect: '/api/v1/trapdoor/frp/bypass'
  }, 403);
});

export default router;

