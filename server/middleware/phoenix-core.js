/**
 * Phoenix Core Middleware
 * ======================
 * Integrates canonical core into Express API.
 * All protected routes must use this.
 * 
 * Uses Python bridge since core is Python-based.
 */

import { verifyLicense, checkFeatureAccess, isCoreAvailable } from '../utils/phoenix-core-wrapper.js';

// Core availability check
const CORE_AVAILABLE = isCoreAvailable();

/**
 * Middleware to require license tier
 */
export function requireTier(minTier) {
    return async (req, res, next) => {
        if (!CORE_AVAILABLE) {
            // Graceful degradation - allow in dev mode
            req.license = { tier: 'free', seats: 1 };
            return next();
        }
        
        // Extract license token
        const token = req.headers['x-license'] || 
                     req.query.license || 
                     req.body?.license || 
                     '';
        
        const feature = req.path.replace('/api/v1/', '').replace(/\//g, '.');
        
        try {
            const result = checkFeatureAccess(token, feature);
            
            if (!result.allowed) {
                return res.status(403).json({
                    error: 'permission_denied',
                    message: result.error || 'Feature not allowed'
                });
            }
            
            // Check tier requirement
            const tierOrder = { free: 0, pro: 1, enterprise: 2 };
            const userTier = tierOrder[result.tier] || 0;
            const requiredTier = tierOrder[minTier] || 0;
            
            if (userTier < requiredTier) {
                return res.status(402).json({
                    error: 'license_required',
                    need: minTier,
                    current: result.tier
                });
            }
            
            // Attach license info to request
            req.license = {
                tier: result.tier,
                seats: 1 // Would come from actual license object
            };
            next();
        } catch (error) {
            return res.status(500).json({
                error: 'license_check_failed',
                message: error.message
            });
        }
    };
}

/**
 * Middleware to check feature access
 */
export function requireFeature(featureName) {
    return async (req, res, next) => {
        if (!CORE_AVAILABLE) {
            // Graceful degradation
            req.license = { tier: 'free', seats: 1 };
            return next();
        }
        
        const token = req.headers['x-license'] || 
                     req.query.license || 
                     req.body?.license || 
                     '';
        
        try {
            const result = checkFeatureAccess(token, featureName);
            
            if (!result.allowed) {
                return res.status(403).json({
                    error: 'feature_denied',
                    feature: featureName,
                    message: result.error || 'Feature not allowed for your tier'
                });
            }
            
            req.license = {
                tier: result.tier,
                seats: 1
            };
            next();
        } catch (error) {
            return res.status(500).json({
                error: 'feature_check_failed',
                message: error.message
            });
        }
    };
}

/**
 * Get license status (public endpoint)
 */
export function getLicenseStatus(req, res) {
    const token = req.headers['x-license'] || 
                 req.query.license || 
                 req.body?.license || 
                 '';
    
    if (!CORE_AVAILABLE) {
        return res.json({
            active: false,
            tier: 'free',
            seats: 1,
            core_available: false
        });
    }
    
    const status = verifyLicense(token);
    res.json(status);
}
