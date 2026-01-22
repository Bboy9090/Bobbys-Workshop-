/**
 * MDM Detection API endpoints
 * 
 * Mobile Device Management (MDM) profile detection
 */

import express from 'express';
import ADBLibrary from '../../utils/adb-library-wrapper.js';

const router = express.Router();

/**
 * POST /api/v1/mdm/detect
 * Detect MDM profiles on Android device
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
      return res.sendError('TOOL_NOT_AVAILABLE', 'ADB is required for MDM detection', null, 503);
    }

    const devicesResult = await ADBLibrary.listDevices();
    const device = devicesResult.devices?.find(d => d.serial === serial);
    if (!device) {
      return res.sendError('DEVICE_NOT_FOUND', 'Device not detected via ADB', { serial }, 404);
    }

    const policyDump = await ADBLibrary.shell(serial, 'dumpsys device_policy');
    if (!policyDump.success) {
      return res.sendError('MDM_DETECTION_FAILED', 'Unable to query device policy', {
        serial,
        error: policyDump.error
      }, 500);
    }

    const output = policyDump.stdout || '';
    const deviceOwnerMatch = output.match(/Device Owner:\s*(.+)/i);
    const profileOwnerMatch = output.match(/Profile Owner:\s*(.+)/i);
    const activeAdmins = output
      .split('\n')
      .filter(line => /Active admin/i.test(line))
      .map(line => line.trim());

    const deviceOwner = deviceOwnerMatch ? deviceOwnerMatch[1].trim() : null;
    const profileOwner = profileOwnerMatch ? profileOwnerMatch[1].trim() : null;

    const mdmEnrolled = Boolean(deviceOwner || profileOwner || activeAdmins.length > 0);

    return res.sendEnvelope({
      serial,
      mdm: {
        enrolled: mdmEnrolled,
        deviceOwner,
        profileOwner,
        activeAdmins,
        note: mdmEnrolled
          ? 'Device policy owners detected via dumpsys device_policy'
          : 'No device/profile owner detected'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.sendError('INTERNAL_ERROR', 'MDM detection failed', { error: error.message }, 500);
  }
});

/**
 * POST /api/v1/mdm/remove
 * Remove MDM profile (owner devices only - must be in trapdoor/secret room)
 * This endpoint should only be accessible via trapdoor API
 */
router.post('/remove', async (req, res) => {
  return res.sendError('FORBIDDEN', 'MDM removal must be performed through trapdoor API', {
    redirect: '/api/v1/trapdoor/mdm/remove'
  }, 403);
});

export default router;

