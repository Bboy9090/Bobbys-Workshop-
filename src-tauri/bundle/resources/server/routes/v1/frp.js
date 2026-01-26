/**
 * FRP Detection API endpoints
 * 
 * Factory Reset Protection (FRP) lock detection and bypass (owner devices only)
 */

import express from 'express';
// import { executeAdbCommand, validateDeviceSerial } from '../../../core/lib/adb.js';

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

  // TODO: Implement FRP detection using executeAdbCommand
  return res.sendError('NOT_IMPLEMENTED', 'FRP detection is temporarily disabled', {
    note: 'This feature needs to be reimplemented with the new ADB library'
  }, 501);
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

