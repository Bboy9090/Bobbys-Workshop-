/**
 * License API Routes
 * ==================
 * License status, validation, and management endpoints.
 */

import express from 'express';
import { getLicenseStatus } from '../../middleware/phoenix-core.js';

const router = express.Router();

/**
 * GET /api/v1/license/status
 * Get current license status
 */
router.get('/status', (req, res) => {
    // Use Phoenix Core middleware if available
    try {
        getLicenseStatus(req, res);
    } catch (error) {
        // Fallback if core not available
        res.json({
            active: false,
            tier: 'free',
            seats: 1,
            error: 'License system not initialized'
        });
    }
});

/**
 * POST /api/v1/license/verify
 * Verify a license token
 */
router.post('/verify', async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({
            error: 'missing_token',
            message: 'License token required'
        });
    }
    
    // Try to use Phoenix Core
    try {
        // This would use the core verification
        // For now, return basic validation
        res.json({
            valid: token.length > 0,
            tier: 'free', // Would be determined by core
            message: 'License verification requires Phoenix Core integration'
        });
    } catch (error) {
        res.status(500).json({
            error: 'verification_failed',
            message: error.message
        });
    }
});

export default router;
