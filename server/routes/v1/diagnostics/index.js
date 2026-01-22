/**
 * Diagnostics API Main Router
 * 
 * GOD MODE: Comprehensive device diagnostics API
 * Routes to specialized diagnostic modules
 * 
 * @module diagnostics
 */

import express from 'express';
import hardwareRouter, { runComprehensiveDiagnostics } from './hardware.js';
import batteryRouter, { getBatteryHealth } from './battery.js';

const router = express.Router();

/**
 * GET /api/v1/diagnostics
 * Get available diagnostic features
 */
router.get('/', (req, res) => {
  res.sendEnvelope({
    available: true,
    features: {
      hardware: {
        available: true,
        endpoint: '/api/v1/diagnostics/hardware/:serial',
        description: 'Hardware diagnostics (screen, sensors, camera, audio)'
      },
      battery: {
        available: true,
        endpoint: '/api/v1/diagnostics/battery/:serial',
        description: 'Battery health diagnostics and monitoring'
      },
      storage: {
        available: false,
        endpoint: '/api/v1/monitor/storage/:serial',
        description: 'Storage diagnostics are exposed under /api/v1/monitor/storage'
      },
      network: {
        available: false,
        endpoint: '/api/v1/monitor/network/:serial',
        description: 'Network diagnostics are exposed under /api/v1/monitor/network'
      },
      security: {
        available: false,
        endpoint: '/api/v1/security/*',
        description: 'Security diagnostics are exposed under /api/v1/security'
      },
      software: {
        available: false,
        endpoint: '/api/v1/diagnostics/software/:checkId',
        description: 'Software diagnostics are not implemented in this endpoint'
      },
      performance: {
        available: true,
        endpoint: '/api/v1/monitor/performance/:serial',
        description: 'Performance diagnostics (CPU, memory, battery)',
        note: 'See /api/v1/monitor/performance endpoint'
      }
    },
    documentation: {
      hardware: 'GET /api/v1/diagnostics/hardware/:serial - Run comprehensive hardware tests',
      battery: 'GET /api/v1/diagnostics/battery/:serial - Get battery health information',
      batteryMonitor: 'POST /api/v1/diagnostics/battery/:serial/monitor - Monitor battery during charge/discharge',
      fullDiagnostics: 'POST /api/v1/diagnostics/:category/:checkId - Run specific diagnostic check'
    }
  });
});

/**
 * POST /api/v1/diagnostics/:category/:checkId
 * Run a specific diagnostic check
 * 
 * @param {string} category - Diagnostic category (battery, storage, network, hardware, security, software)
 * @param {string} checkId - Specific check ID
 * @body {string} deviceSerial - Device serial number
 */
router.post('/:category/:checkId', async (req, res) => {
  const { category, checkId } = req.params;
  const { deviceSerial } = req.body;

  if (!deviceSerial) {
    return res.status(400).sendEnvelope({ error: 'deviceSerial is required' });
  }

  try {
    const result = await runDiagnosticCheck(category, checkId, deviceSerial);
    res.sendEnvelope(result);
  } catch (error) {
    const message = error.message || 'Diagnostics failed';
    const isUnsupported = message.includes('not supported') || message.includes('Unsupported');
    res.status(isUnsupported ? 501 : 500).sendEnvelope({
      error: message,
      status: 'unknown',
      value: 'N/A'
    });
  }
});

/**
 * POST /api/v1/diagnostics/full
 * Run all diagnostics on a device
 */
router.post('/full', async (req, res) => {
  const { deviceSerial } = req.body;

  if (!deviceSerial) {
    return res.status(400).sendEnvelope({ error: 'deviceSerial is required' });
  }

  try {
    const results = await runFullDiagnostics(deviceSerial);
    res.sendEnvelope(results);
  } catch (error) {
    res.status(500).sendEnvelope({ error: error.message });
  }
});

// Mount specialized diagnostic routers
router.use('/hardware', hardwareRouter);
router.use('/battery', batteryRouter);

/**
 * Run a specific diagnostic check
 */
async function runDiagnosticCheck(category, checkId, deviceSerial) {
  if (category === 'battery') {
    const battery = await getBatteryHealth(deviceSerial);
    if (!battery.success) {
      throw new Error(battery.error || 'Battery diagnostics failed');
    }

    const batteryChecks = {
      battery_level: {
        status: 'pass',
        value: `${battery.percentage ?? 0}%`
      },
      battery_health: {
        status: battery.healthPercentage !== null ? 'pass' : 'unknown',
        value: battery.healthPercentage !== null ? `${battery.healthPercentage}%` : 'Unavailable'
      },
      battery_temperature: {
        status: battery.temperature !== null ? 'pass' : 'unknown',
        value: battery.temperature !== null ? `${battery.temperature}°C` : 'Unavailable'
      },
      charging_status: {
        status: 'pass',
        value: battery.charging ? 'Charging' : 'Not Charging'
      }
    };

    const result = batteryChecks[checkId];
    if (!result) {
      throw new Error(`Unsupported battery checkId: ${checkId}`);
    }

    return {
      category,
      checkId,
      deviceSerial,
      ...result,
      timestamp: Date.now()
    };
  }

  if (category === 'hardware') {
    const hardware = await runComprehensiveDiagnostics(deviceSerial);
    if (!hardware || hardware.success === false) {
      throw new Error(hardware?.error || 'Hardware diagnostics failed');
    }

    const hasCamera = (position) =>
      Array.isArray(hardware.camera?.cameras) &&
      hardware.camera.cameras.some(cam => cam.position === position);

    const hardwareChecks = {
      display_test: hardware.screen?.error
        ? { status: 'fail', value: hardware.screen.error }
        : { status: 'pass', value: hardware.screen?.resolution || 'OK' },
      touch_test: { status: 'unknown', value: 'Requires interactive touch test' },
      camera_front: hasCamera('front')
        ? { status: 'pass', value: 'Detected' }
        : { status: 'warning', value: 'Not detected' },
      camera_rear: hasCamera('back')
        ? { status: 'pass', value: 'Detected' }
        : { status: 'warning', value: 'Not detected' },
      speaker_test: { status: 'unknown', value: 'Requires audio playback test' },
      microphone_test: { status: 'unknown', value: 'Requires audio capture test' },
      sensors_check: hardware.sensors?.error
        ? { status: 'fail', value: hardware.sensors.error }
        : { status: 'pass', value: `${hardware.sensors?.count ?? 0} sensors reported` }
    };

    const result = hardwareChecks[checkId];
    if (!result) {
      throw new Error(`Unsupported hardware checkId: ${checkId}`);
    }

    return {
      category,
      checkId,
      deviceSerial,
      ...result,
      timestamp: Date.now()
    };
  }

  throw new Error(`Diagnostics category not supported: ${category}`);
}

/**
 * Run full diagnostics on a device
 */
async function runFullDiagnostics(deviceSerial) {
  const categories = ['battery', 'hardware'];
  const allChecks = [];

  for (const category of categories) {
    const checks = getChecksForCategory(category);
    for (const checkId of checks) {
      const result = await runDiagnosticCheck(category, checkId, deviceSerial);
      allChecks.push(result);
    }
  }

  const passed = allChecks.filter(c => c.status === 'pass').length;
  const warnings = allChecks.filter(c => c.status === 'warning').length;
  const failed = allChecks.filter(c => c.status === 'fail').length;

  return {
    deviceSerial,
    generatedAt: Date.now(),
    checks: allChecks,
    summary: {
      total: allChecks.length,
      passed,
      warnings,
      failed,
      unknown: allChecks.length - passed - warnings - failed,
    },
    overallHealth: Math.round((passed * 100 + warnings * 50) / allChecks.length),
  };
}

/**
 * Get check IDs for a category
 */
function getChecksForCategory(category) {
  const checkMap = {
    battery: ['battery_level', 'battery_health', 'battery_temperature', 'charging_status'],
    hardware: ['display_test', 'touch_test', 'camera_front', 'camera_rear', 'speaker_test', 'microphone_test', 'sensors_check']
  };
  return checkMap[category] || [];
}

export default router;

