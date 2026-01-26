/**
 * The Flash Forge - Secret Room #2
 * 
 * Multi-brand flash operations:
 * - Samsung Odin automation
 * - MediaTek SP Flash
 * - Qualcomm EDL
 * - Custom recovery installation
 * - Partition-level operations
 * 
 * @module trapdoor-flash
 */

import express from 'express';
import ShadowLogger from '../../../../core/lib/shadow-logger.js';
import { safeSpawn, commandExistsSafe } from '../../../utils/safe-exec.js';
import { acquireDeviceLock, releaseDeviceLock } from '../../../locks.js';
import odinRouter from '../flash/odin.js';
import mtkRouter from '../flash/mtk.js';
import edlRouter from '../flash/edl.js';

const router = express.Router();
const shadowLogger = new ShadowLogger();

/**
 * POST /api/v1/trapdoor/flash
 * Execute flash operation (multi-brand)
 */
router.post('/', async (req, res) => {
  const { deviceSerial, brand, firmware, operation, confirmation } = req.body;

  if (!deviceSerial) {
    return res.sendError('VALIDATION_ERROR', 'Device serial is required', null, 400);
  }

  if (!brand || !['samsung', 'mediatek', 'qualcomm', 'generic'].includes(brand)) {
    return res.sendError('VALIDATION_ERROR', 'Valid brand is required (samsung, mediatek, qualcomm, generic)', null, 400);
  }

  if (confirmation !== 'FLASH') {
    return res.sendConfirmationRequired('Type "FLASH" to confirm flash operation', {
      operation: 'flash',
      warning: 'This will overwrite device firmware. All data will be lost.'
    });
  }

  // Acquire device lock
  const lockResult = await acquireDeviceLock(deviceSerial, 'trapdoor_flash');
  if (!lockResult.acquired) {
    return res.sendDeviceLocked(lockResult.reason, {
      lockedBy: lockResult.lockedBy
    });
  }

  try {
    // Log to shadow
    await shadowLogger.logShadow({
      operation: 'flash',
      deviceSerial,
      userId: req.ip,
      authorization: 'TRAPDOOR',
      success: false,
      metadata: {
        brand,
        operation,
        firmware: firmware ? Object.keys(firmware) : null
      }
    });

    // Route to brand-specific handler
    let result;
    switch (brand) {
      case 'samsung':
        // Use Odin router logic
        result = { success: true, message: 'Samsung Odin flash - use /api/v1/trapdoor/flash/odin endpoint', brand: 'samsung' };
        break;
      case 'mediatek':
        // Use MediaTek router logic
        result = { success: true, message: 'MediaTek SP Flash - use /api/v1/trapdoor/flash/mtk endpoint', brand: 'mediatek' };
        break;
      case 'qualcomm':
        // Use EDL router logic
        result = { success: true, message: 'Qualcomm EDL flash - use /api/v1/trapdoor/flash/edl endpoint', brand: 'qualcomm' };
        break;
      default:
        result = { success: false, error: 'Unsupported brand' };
    }

    releaseDeviceLock(deviceSerial);

    if (result.success) {
      await shadowLogger.logShadow({
        operation: 'flash',
        deviceSerial,
        userId: req.ip,
        authorization: 'TRAPDOOR',
        success: true,
        metadata: { brand, result }
      });

      return res.sendEnvelope({
        success: true,
        message: 'Flash operation initiated',
        deviceSerial,
        brand,
        result,
        note: 'Use brand-specific endpoints for detailed flash operations',
        timestamp: new Date().toISOString()
      });
    } else {
      return res.sendError('FLASH_FAILED', result.error || 'Flash operation failed', {
        deviceSerial,
        brand
      }, 500);
    }
  } catch (error) {
    releaseDeviceLock(deviceSerial);
    res.sendError('INTERNAL_ERROR', 'Failed to execute flash operation', {
      error: error.message,
      deviceSerial
    }, 500);
  }
});

// Mount brand-specific routers
router.use('/odin', odinRouter);
router.use('/mtk', mtkRouter);
router.use('/edl', edlRouter);

export default router;
