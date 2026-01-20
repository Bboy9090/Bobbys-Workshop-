/**
 * Universal Legend Status - Universal Devices API
 * Unified device management API
 */

import express from 'express';
import deviceManager from '../../utils/universal/device-abstraction.js';

const router = express.Router();

/**
 * GET /api/v1/universal/devices
 * Get all devices in universal format
 */
router.get('/devices', (req, res) => {
  try {
    const devices = deviceManager.getAllDevices();
    res.json({
      ok: true,
      data: {
        devices,
        count: devices.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get devices',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/universal/devices/:id
 * Get specific device
 */
router.get('/devices/:id', (req, res) => {
  try {
    const { id } = req.params;
    const device = deviceManager.getDevice(id);
    
    if (!device) {
      return res.status(404).json({
        ok: false,
        error: 'Device not found',
        deviceId: id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      ok: true,
      data: device.toUniversal(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get device',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/v1/universal/devices
 * Add or update device
 */
router.post('/devices', (req, res) => {
  try {
    const deviceData = req.body;
    const device = deviceManager.addDevice(deviceData);
    
    res.json({
      ok: true,
      data: device.toUniversal(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to add device',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/v1/universal/devices/:id
 * Remove device
 */
router.delete('/devices/:id', (req, res) => {
  try {
    const { id } = req.params;
    const removed = deviceManager.removeDevice(id);
    
    res.json({
      ok: true,
      data: {
        deviceId: id,
        removed,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to remove device',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/universal/devices/search
 * Search devices by criteria
 */
router.get('/devices/search', (req, res) => {
  try {
    const criteria = req.query;
    const devices = deviceManager.findDevices(criteria);
    
    res.json({
      ok: true,
      data: {
        devices,
        count: devices.length,
        criteria,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to search devices',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
