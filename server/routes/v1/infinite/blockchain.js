/**
 * ♾️ Infinite Legendary - Blockchain API (Production-Grade)
 */

import express from 'express';
import blockchainAudit from '../../../utils/infinite/blockchain-audit.js';
import { validateInfiniteFeature, manageInfiniteResources } from '../../../middleware/infinite-validation.js';
import infiniteErrorHandler from '../../../utils/infinite/error-handler.js';
import infinitePerformanceMonitor from '../../../utils/infinite/performance-monitor.js';
import infiniteRateLimiter from '../../../middleware/infinite-rate-limit.js';

const router = express.Router();

// Apply production-grade middleware
router.use(manageInfiniteResources);
router.use(infiniteRateLimiter.createRateLimitMiddleware('blockchain'));

/**
 * POST /api/v1/infinite/blockchain/init
 * Initialize blockchain
 */
router.post('/init', (req, res) => {
  try {
    const genesis = blockchainAudit.createGenesisBlock();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'init_blockchain',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: { genesis, message: 'Blockchain initialized' },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'init_blockchain',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/infinite/blockchain/audit
 * Add audit entry to blockchain
 */
router.post('/audit', async (req, res) => {
  try {
    const transaction = await blockchainAudit.addAuditTransaction(req.body);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'add_blockchain_audit',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: transaction,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'add_blockchain_audit',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/infinite/blockchain/mine
 * Mine block
 */
router.post('/mine', async (req, res) => {
  try {
    const block = await blockchainAudit.mineBlock();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'mine_block',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: block,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'mine_block',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/infinite/blockchain/verify
 * Verify blockchain integrity
 */
router.get('/verify', (req, res) => {
  try {
    const verification = blockchainAudit.verifyChain();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'verify_blockchain',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: verification,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'verify_blockchain',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/infinite/blockchain/history
 * Get blockchain audit history
 */
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = blockchainAudit.getAuditHistory(limit);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_blockchain_history',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: { history, count: history.length },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_blockchain_history',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/infinite/blockchain/stats
 * Get blockchain statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = blockchainAudit.getStats();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_blockchain_stats',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_blockchain_stats',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

export default router;
