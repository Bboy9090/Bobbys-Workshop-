/**
 * Storage Analytics API
 * 
 * Provides storage usage tracking and analytics for connected devices.
 * Tracks storage usage over time, disk health, and storage breakdown.
 * 
 * @module storage-monitor
 */

import express from 'express';
import ADBLibrary from '../../../../core/lib/adb.js';
import { safeSpawn, commandExistsSafe } from '../../../utils/safe-exec.js';

const router = express.Router();

/**
 * Get storage usage for an Android device
 * @param {string} deviceSerial - Device serial number
 * @returns {Promise<Object>} Storage usage information
 */
async function getStorageUsage(deviceSerial) {
  try {
    // Get storage information via df command
    const dfResult = await ADBLibrary.shell(deviceSerial, 'df -h');
    if (!dfResult.success) {
      return { success: false, error: dfResult.error };
    }

    // Parse df output
    const lines = dfResult.stdout.trim().split('\n').slice(1); // Skip header
    const partitions = [];
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6) {
        partitions.push({
          filesystem: parts[0],
          size: parts[1],
          used: parts[2],
          available: parts[3],
          usePercent: parts[4],
          mounted: parts[5]
        });
      }
    }

    // Get internal storage (usually /data or /sdcard)
    const internalStorage = partitions.find(p => 
      p.mounted === '/data' || p.mounted === '/sdcard' || p.mounted.startsWith('/storage/')
    );

    // Get system storage (usually /system)
    const systemStorage = partitions.find(p => p.mounted === '/system');

    // Get cache storage (usually /cache)
    const cacheStorage = partitions.find(p => p.mounted === '/cache');

    // Parse size values to bytes (approximate)
    function parseSize(sizeStr) {
      const match = sizeStr.match(/^([\d.]+)([KMGTP]?)$/i);
      if (!match) return 0;
      const value = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      const multipliers = { '': 1, 'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4, 'P': 1024**5 };
      return Math.floor(value * (multipliers[unit] || 1));
    }

    // Calculate totals
    const totalSize = partitions.reduce((sum, p) => sum + parseSize(p.size || '0'), 0);
    const totalUsed = partitions.reduce((sum, p) => sum + parseSize(p.used || '0'), 0);
    const totalAvailable = partitions.reduce((sum, p) => sum + parseSize(p.available || '0'), 0);
    const totalUsePercent = totalSize > 0 ? Math.round((totalUsed / totalSize) * 100) : 0;

    // Get app storage breakdown
    const appStorageResult = await ADBLibrary.shell(deviceSerial, 'dumpsys diskstats | grep -i "app" | head -5');
    const appStorage = appStorageResult.success ? appStorageResult.stdout.trim() : null;

    // Get media storage (photos, videos, etc.)
    const mediaStorageResult = await ADBLibrary.shell(deviceSerial, 'du -sh /sdcard/DCIM /sdcard/Pictures 2>/dev/null | tail -1');
    const mediaStorage = mediaStorageResult.success ? mediaStorageResult.stdout.trim() : null;

    return {
      success: true,
      partitions,
      internalStorage,
      systemStorage,
      cacheStorage,
      totals: {
        size: totalSize,
        used: totalUsed,
        available: totalAvailable,
        usePercent: totalUsePercent,
        partitions: partitions.length
      },
      appStorage,
      mediaStorage,
      timestamp: Date.now()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get storage health information
 * @param {string} deviceSerial - Device serial number
 * @returns {Promise<Object>} Storage health information
 */
async function getStorageHealth(deviceSerial) {
  try {
    // Get storage health via dumpsys diskstats
    const diskstatsResult = await ADBLibrary.shell(deviceSerial, 'dumpsys diskstats');
    const diskstats = diskstatsResult.success ? diskstatsResult.stdout.trim() : null;

    // Get I/O statistics
    const ioStatsResult = await ADBLibrary.shell(deviceSerial, 'cat /proc/diskstats | head -1');
    const ioStats = ioStatsResult.success ? ioStatsResult.stdout.trim() : null;

    // Get free space percentage
    const freeSpaceResult = await ADBLibrary.shell(deviceSerial, 'df -h /data | tail -1');
    const freeSpace = freeSpaceResult.success ? freeSpaceResult.stdout.trim().match(/(\d+)%/)?.[1] : null;
    const freeSpacePercent = freeSpace ? parseInt(freeSpace) : null;

    // Determine health status
    let healthStatus = 'good';
    let healthLevel = 'low';
    if (freeSpacePercent !== null) {
      if (freeSpacePercent < 10) {
        healthStatus = 'critical';
        healthLevel = 'high';
      } else if (freeSpacePercent < 20) {
        healthStatus = 'warning';
        healthLevel = 'medium';
      }
    }

    return {
      success: true,
      diskstats,
      ioStats,
      freeSpacePercent,
      healthStatus,
      healthLevel,
      timestamp: Date.now()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * GET /api/v1/monitor/storage/:serial
 * Get storage usage and analytics for a device
 */
router.get('/:serial', async (req, res) => {
  const { serial } = req.params;

  try {
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
      return res.sendError('DEVICE_NOT_READY', 'Device must be in device state for storage monitoring', {
        serial,
        currentState: device.state,
        requiredState: 'device'
      }, 400);
    }

    // Get storage usage and health
    const [usageResult, healthResult] = await Promise.all([
      getStorageUsage(serial),
      getStorageHealth(serial)
    ]);

    if (!usageResult.success) {
      return res.sendError('STORAGE_USAGE_FAILED', usageResult.error, {
        serial
      }, 500);
    }

    res.sendEnvelope({
      serial,
      timestamp: new Date().toISOString(),
      usage: usageResult,
      health: healthResult.success ? healthResult : { error: healthResult.error }
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to get storage analytics', {
      error: error.message,
      serial
    }, 500);
  }
});

/**
 * GET /api/v1/monitor/storage
 * Get storage analytics for all connected devices
 */
router.get('/', async (req, res) => {
  try {
    // Get all devices
    const devicesResult = await ADBLibrary.listDevices();
    if (!devicesResult.success) {
      return res.sendError('DEVICE_SCAN_FAILED', 'Failed to scan for devices', {
        error: devicesResult.error
      }, 500);
    }

    // Get storage analytics for each device
    const devices = devicesResult.devices.filter(d => d.state === 'device');
    const results = await Promise.all(
      devices.map(async (device) => {
        const usageResult = await getStorageUsage(device.serial);
        const healthResult = await getStorageHealth(device.serial);
        return {
          serial: device.serial,
          state: device.state,
          usage: usageResult.success ? {
            totals: usageResult.totals,
            internalStorage: usageResult.internalStorage,
            systemStorage: usageResult.systemStorage
          } : { error: usageResult.error },
          health: healthResult.success ? healthResult : { error: healthResult.error }
        };
      })
    );

    res.sendEnvelope({
      devices: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to get storage analytics for devices', {
      error: error.message
    }, 500);
  }
});

export default router;
