/**
 * Universal Legend Status - Platform API
 * Platform detection and capabilities API
 */

import express from 'express';
import platformDetector from '../../../utils/universal/platform-detector.js';

const router = express.Router();

/**
 * GET /api/v1/universal/platform
 * Get platform information
 */
router.get('/platform', (req, res) => {
  try {
    const info = platformDetector.getInfo();
    res.json({
      ok: true,
      data: info,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get platform info',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/universal/platform/capabilities
 * Get platform capabilities
 */
router.get('/platform/capabilities', (req, res) => {
  try {
    const info = platformDetector.getInfo();
    res.json({
      ok: true,
      data: info.capabilities,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get platform capabilities',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/universal/platform/supports/:feature
 * Check if platform supports feature
 */
router.get('/platform/supports/:feature', (req, res) => {
  try {
    const { feature } = req.params;
    const supported = platformDetector.supports(feature);
    res.json({
      ok: true,
      data: {
        feature,
        supported,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to check feature support',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
