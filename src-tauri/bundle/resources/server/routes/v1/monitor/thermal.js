/**
 * Thermal Monitoring API
 * 
 * Provides temperature tracking and thermal monitoring for connected devices.
 * Tracks device temperature, overheating alerts, and throttling detection.
 * 
 * @module thermal-monitor
 */

import express from 'express';
import ADBLibrary from '../../../../core/lib/adb.js';
import { safeSpawn, commandExistsSafe } from '../../../utils/safe-exec.js';

const router = express.Router();

/**
 * Get temperature readings for an Android device
 * @param {string} deviceSerial - Device serial number
 * @returns {Promise<Object>} Temperature information
 */
async function getTemperatureReadings(deviceSerial) {
  try {
    // Get battery temperature (in tenths of a degree Celsius)
    const batteryTempResult = await ADBLibrary.shell(deviceSerial, 'dumpsys battery | grep temperature');
    const batteryTempRaw = batteryTempResult.success ? batteryTempResult.stdout.trim() : null;
    const batteryTempMatch = batteryTempRaw?.match(/temperature:\s*(\d+)/);
    const batteryTempCelsius = batteryTempMatch ? parseFloat(batteryTempMatch[1]) / 10 : null;

    // Get CPU temperature (if available)
    const cpuTempResult = await ADBLibrary.shell(deviceSerial, 'cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | head -1');
    const cpuTempRaw = cpuTempResult.success ? cpuTempResult.stdout.trim() : null;
    const cpuTempCelsius = cpuTempRaw ? parseFloat(cpuTempRaw) / 1000 : null; // Usually in millidegrees

    // Get GPU temperature (if available)
    const gpuTempResult = await ADBLibrary.shell(deviceSerial, 'cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | tail -1');
    const gpuTempRaw = gpuTempResult.success ? gpuTempResult.stdout.trim() : null;
    const gpuTempCelsius = gpuTempRaw ? parseFloat(gpuTempRaw) / 1000 : null;

    // Get all thermal zones
    const thermalZonesResult = await ADBLibrary.shell(deviceSerial, 'ls /sys/class/thermal/ 2>/dev/null');
    const thermalZones = thermalZonesResult.success 
      ? thermalZonesResult.stdout.trim().split('\n').filter(line => line.startsWith('thermal_zone'))
      : [];

    // Get thermal zone temperatures
    const zoneTemperatures = {};
    for (const zone of thermalZones.slice(0, 10)) { // Limit to first 10 zones
      try {
        const zoneTempResult = await ADBLibrary.shell(deviceSerial, `cat /sys/class/thermal/${zone}/temp 2>/dev/null`);
        const zoneTemp = zoneTempResult.success ? parseFloat(zoneTempResult.stdout.trim()) / 1000 : null;
        if (zoneTemp !== null) {
          zoneTemperatures[zone] = zoneTemp;
        }
      } catch (e) {
        // Skip zones that can't be read
      }
    }

    // Calculate average temperature
    const allTemps = [batteryTempCelsius, cpuTempCelsius, gpuTempCelsius, ...Object.values(zoneTemperatures)].filter(t => t !== null);
    const avgTemp = allTemps.length > 0 ? allTemps.reduce((sum, t) => sum + t, 0) / allTemps.length : null;
    const maxTemp = allTemps.length > 0 ? Math.max(...allTemps) : null;
    const minTemp = allTemps.length > 0 ? Math.min(...allTemps) : null;

    return {
      success: true,
      battery: batteryTempCelsius,
      cpu: cpuTempCelsius,
      gpu: gpuTempCelsius,
      zones: zoneTemperatures,
      average: avgTemp,
      maximum: maxTemp,
      minimum: minTemp,
      thermalZones: thermalZones.length,
      timestamp: Date.now()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check for thermal throttling
 * @param {string} deviceSerial - Device serial number
 * @param {Object} temps - Temperature readings
 * @returns {Promise<Object>} Throttling information
 */
async function checkThermalThrottling(deviceSerial, temps) {
  try {
    // Check CPU frequency scaling (indicates throttling)
    const cpuFreqResult = await ADBLibrary.shell(deviceSerial, 'cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq 2>/dev/null');
    const currentFreq = cpuFreqResult.success ? parseInt(cpuFreqResult.stdout.trim()) : null;
    
    const maxFreqResult = await ADBLibrary.shell(deviceSerial, 'cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq 2>/dev/null');
    const maxFreq = maxFreqResult.success ? parseInt(maxFreqResult.stdout.trim()) : null;

    // Calculate throttling percentage
    const throttlingPercent = (currentFreq && maxFreq) 
      ? Math.round(((maxFreq - currentFreq) / maxFreq) * 100)
      : null;

    // Determine throttling status
    let isThrottling = false;
    let throttlingLevel = 'none';
    if (throttlingPercent !== null && throttlingPercent > 10) {
      isThrottling = true;
      if (throttlingPercent > 50) {
        throttlingLevel = 'severe';
      } else if (throttlingPercent > 25) {
        throttlingLevel = 'moderate';
      } else {
        throttlingLevel = 'light';
      }
    }

    return {
      success: true,
      isThrottling,
      throttlingLevel,
      throttlingPercent,
      currentFreq,
      maxFreq,
      timestamp: Date.now()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Determine thermal status and alerts
 * @param {Object} temps - Temperature readings
 * @returns {Object} Thermal status information
 */
function determineThermalStatus(temps) {
  const threshold = {
    safe: 40,      // Safe temperature (Celsius)
    warm: 50,      // Warm (minor concern)
    hot: 60,       // Hot (concerning)
    critical: 75   // Critical (dangerous)
  };

  const maxTemp = temps.maximum || temps.average || temps.battery || 0;
  
  let status = 'normal';
  let level = 'low';
  let alerts = [];
  
  if (maxTemp >= threshold.critical) {
    status = 'critical';
    level = 'high';
    alerts.push(`Critical temperature detected: ${maxTemp.toFixed(1)}°C - Device may shutdown`);
  } else if (maxTemp >= threshold.hot) {
    status = 'hot';
    level = 'high';
    alerts.push(`Hot temperature detected: ${maxTemp.toFixed(1)}°C - Performance may be throttled`);
  } else if (maxTemp >= threshold.warm) {
    status = 'warm';
    level = 'medium';
    alerts.push(`Warm temperature detected: ${maxTemp.toFixed(1)}°C`);
  } else if (maxTemp >= threshold.safe) {
    status = 'normal';
    level = 'low';
  } else {
    status = 'cool';
    level = 'low';
  }

  return {
    status,
    level,
    alerts,
    thresholds: threshold,
    currentMax: maxTemp
  };
}

/**
 * GET /api/v1/monitor/thermal/:serial
 * Get thermal monitoring data for a device
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
      return res.sendError('DEVICE_NOT_READY', 'Device must be in device state for thermal monitoring', {
        serial,
        currentState: device.state,
        requiredState: 'device'
      }, 400);
    }

    // Get temperature readings
    const tempsResult = await getTemperatureReadings(serial);
    if (!tempsResult.success) {
      return res.sendError('THERMAL_READING_FAILED', tempsResult.error, {
        serial
      }, 500);
    }

    // Check for throttling
    const throttlingResult = await checkThermalThrottling(serial, tempsResult);

    // Determine thermal status
    const thermalStatus = determineThermalStatus(tempsResult);

    res.sendEnvelope({
      serial,
      timestamp: new Date().toISOString(),
      temperatures: tempsResult,
      throttling: throttlingResult.success ? throttlingResult : { error: throttlingResult.error },
      status: thermalStatus
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to get thermal monitoring data', {
      error: error.message,
      serial
    }, 500);
  }
});

/**
 * GET /api/v1/monitor/thermal
 * Get thermal monitoring data for all connected devices
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

    // Get thermal data for each device
    const devices = devicesResult.devices.filter(d => d.state === 'device');
    const results = await Promise.all(
      devices.map(async (device) => {
        const tempsResult = await getTemperatureReadings(device.serial);
        const throttlingResult = tempsResult.success ? await checkThermalThrottling(device.serial, tempsResult) : { success: false };
        const thermalStatus = tempsResult.success ? determineThermalStatus(tempsResult) : null;
        return {
          serial: device.serial,
          state: device.state,
          temperatures: tempsResult.success ? {
            average: tempsResult.average,
            maximum: tempsResult.maximum,
            battery: tempsResult.battery,
            cpu: tempsResult.cpu
          } : { error: tempsResult.error },
          throttling: throttlingResult.success ? throttlingResult : { error: throttlingResult.error },
          status: thermalStatus
        };
      })
    );

    res.sendEnvelope({
      devices: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to get thermal monitoring data for devices', {
      error: error.message
    }, 500);
  }
});

export default router;
