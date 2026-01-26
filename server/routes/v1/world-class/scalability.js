/**
 * 🌟 World Class Universal Legend - Scalability API
 * 
 * Auto-scaling and load balancing endpoints
 */

import express from 'express';
import autoScaler from '../../../utils/world-class/auto-scaler.js';
import loadBalancer from '../../../utils/world-class/load-balancer.js';

const router = express.Router();

// ============================================
// Auto-Scaling Endpoints
// ============================================

/**
 * GET /api/v1/world-class/scalability/auto-scaler/status
 * Get auto-scaler status
 */
router.get('/auto-scaler/status', (req, res) => {
  try {
    const status = autoScaler.getStatus();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_auto_scaler_status',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_auto_scaler_status',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/world-class/scalability/auto-scaler/check
 * Manually trigger scaling check
 */
router.post('/auto-scaler/check', async (req, res) => {
  try {
    const result = await autoScaler.checkScaling();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'check_scaling',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'check_scaling',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * PUT /api/v1/world-class/scalability/auto-scaler/config
 * Update auto-scaler configuration
 */
router.put('/auto-scaler/config', (req, res) => {
  try {
    const config = autoScaler.updateConfig(req.body);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'update_auto_scaler_config',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: { config },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'update_auto_scaler_config',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

// ============================================
// Load Balancer Endpoints
// ============================================

/**
 * GET /api/v1/world-class/scalability/load-balancer/status
 * Get load balancer status
 */
router.get('/load-balancer/status', (req, res) => {
  try {
    const status = loadBalancer.getStatus();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_load_balancer_status',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_load_balancer_status',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/world-class/scalability/load-balancer/backends
 * Add backend server
 */
router.post('/load-balancer/backends', (req, res) => {
  try {
    const backendId = loadBalancer.addBackend(req.body);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'add_backend',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: { backendId, message: 'Backend added successfully' },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'add_backend',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * DELETE /api/v1/world-class/scalability/load-balancer/backends/:backendId
 * Remove backend server
 */
router.delete('/load-balancer/backends/:backendId', (req, res) => {
  try {
    const { backendId } = req.params;
    const removed = loadBalancer.removeBackend(backendId);
    
    if (removed) {
      res.json({
        envelope: {
          version: '1.0',
          operation: 'remove_backend',
          mode: 'write',
          timestamp: new Date().toISOString(),
        },
        data: { message: 'Backend removed successfully' },
      });
    } else {
      res.status(404).json({
        envelope: {
          version: '1.0',
          operation: 'remove_backend',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        error: { message: 'Backend not found' },
      });
    }
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'remove_backend',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/world-class/scalability/load-balancer/health-check
 * Trigger health check for all backends
 */
router.post('/load-balancer/health-check', async (req, res) => {
  try {
    const allHealthy = await loadBalancer.checkAllHealth();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'health_check',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: {
        allHealthy,
        status: loadBalancer.getStatus(),
      },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'health_check',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * PUT /api/v1/world-class/scalability/load-balancer/algorithm
 * Set load balancing algorithm
 */
router.put('/load-balancer/algorithm', (req, res) => {
  try {
    const { algorithm } = req.body;
    const success = loadBalancer.setAlgorithm(algorithm);
    
    if (success) {
      res.json({
        envelope: {
          version: '1.0',
          operation: 'set_algorithm',
          mode: 'write',
          timestamp: new Date().toISOString(),
        },
        data: { algorithm, message: 'Algorithm updated successfully' },
      });
    } else {
      res.status(400).json({
        envelope: {
          version: '1.0',
          operation: 'set_algorithm',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        error: { message: 'Invalid algorithm. Use: round-robin, least-connections, weighted' },
      });
    }
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'set_algorithm',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

export default router;
