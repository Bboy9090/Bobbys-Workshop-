/**
 * MDM Detection API endpoints
 * 
 * Mobile Device Management (MDM) profile detection
 */

import express from 'express';
// import { executeAdbCommand, validateDeviceSerial } from '../../../core/lib/adb.js';
// NOTE: ADBLibrary methods need to be reimplemented

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

  // TODO: Implement MDM detection using executeAdbCommand
  return res.sendError('NOT_IMPLEMENTED', 'MDM detection is temporarily disabled', {
    note: 'This feature needs to be reimplemented with the new ADB library'
  }, 501);
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

