/**
 * The Bypass Laboratory - Secret Room #5
 * 
 * This project operates under a "legal operations only" policy.
 * Circumvention/bypass endpoints are intentionally disabled.
 * 
 * @module trapdoor-bypass
 */

import express from 'express';

const router = express.Router();

/**
 * POST /api/v1/trapdoor/bypass/screenlock
 * Disabled.
 */
router.post('/screenlock', async (req, res) => {
  return res.sendPolicyBlocked(
    'Bypass endpoints are disabled. Use official recovery/repair flows and diagnostics.',
    { operation: 'screenlock_bypass' }
  );
});

/**
 * POST /api/v1/trapdoor/bypass/mdm
 * Disabled.
 */
router.post('/mdm', async (req, res) => {
  return res.sendPolicyBlocked(
    'Bypass endpoints are disabled. Use official MDM unenrollment paths and ownership verification.',
    { operation: 'mdm_removal' }
  );
});

export default router;
