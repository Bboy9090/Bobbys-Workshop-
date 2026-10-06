/**
 * BobFWTools diagnostics router.
 * Production rule: observed hardware facts only. Unsupported checks fail closed.
 */
import express from 'express';
import hardwareRouter from './hardware.js';
import batteryRouter from './battery.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.sendEnvelope({
    available: true,
    features: {
      hardware: {
        available: true,
        source: 'adb',
        endpoint: '/api/v1/diagnostics/hardware/:serial',
        description: 'ADB-observed hardware properties and inventories'
      },
      battery: {
        available: true,
        source: 'adb',
        endpoint: '/api/v1/diagnostics/battery/:serial',
        description: 'ADB dumpsys/sysfs battery observations'
      },
      storage: { available: false, reason: 'No production storage diagnostic backend is wired yet' },
      network: { available: false, reason: 'No production network diagnostic backend is wired yet' },
      security: { available: false, reason: 'No production security diagnostic backend is wired yet' },
      software: { available: false, reason: 'Use device-info/getprop endpoints until a dedicated backend is wired' },
      performance: { available: false, reason: 'No production performance sampling backend is wired yet' }
    },
    policy: 'unsupported checks return unavailable; no synthetic diagnostic values'
  });
});

router.post('/full', (req, res) => {
  return res.sendError(
    'DIAGNOSTIC_AGGREGATE_UNAVAILABLE',
    'Full aggregate diagnostics are disabled until every included check has a real data source.',
    { supported: ['hardware', 'battery'] },
    501
  );
});

router.post('/:category/:checkId', (req, res) => {
  const { category, checkId } = req.params;
  const { deviceSerial } = req.body ?? {};
  if (!deviceSerial) {
    return res.sendError('VALIDATION_ERROR', 'deviceSerial is required', { category, checkId }, 400);
  }
  return res.sendError(
    'DIAGNOSTIC_CHECK_UNAVAILABLE',
    'This generic diagnostic check has no verified production backend.',
    { category, checkId, deviceSerial },
    501
  );
});

router.use('/hardware', hardwareRouter);
router.use('/battery', batteryRouter);

export default router;
