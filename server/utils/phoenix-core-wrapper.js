/**
 * Phoenix Core Wrapper for Node.js
 * =================================
 * Bridges Python core modules to Node.js/Express.
 * 
 * This wrapper allows Express routes to use the canonical
 * Phoenix Core without duplicating logic.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check if Phoenix Core is available
 */
export function isCoreAvailable() {
    const corePath = path.join(__dirname, '../../core');
    return fs.existsSync(path.join(corePath, 'core.py'));
}

/**
 * Verify license token using Python core
 */
export function verifyLicense(token) {
    if (!token) {
        return {
            active: false,
            tier: 'free',
            seats: 1
        };
    }
    
    if (!isCoreAvailable()) {
        return {
            active: false,
            tier: 'free',
            error: 'Core not available'
        };
    }
    
    try {
        const corePath = path.join(__dirname, '../../core');
        const script = `
import sys
import os
sys.path.insert(0, '${corePath.replace(/\\/g, '/')}')
from core.core import PhoenixCore
import json

key = os.environ.get('LICENSE_SIGNING_KEY', '').encode() if os.environ.get('LICENSE_SIGNING_KEY') else b'dev-key'
core = PhoenixCore(key)

try:
    license_obj = core.authorize('${token}', 'status.check', 'system')
    print(json.dumps({
        'active': True,
        'tier': license_obj.tier,
        'seats': license_obj.seats,
        'capabilities': license_obj.capabilities,
        'exp': license_obj.exp,
        'org_id': license_obj.org_id
    }))
except Exception as e:
    print(json.dumps({
        'active': False,
        'tier': 'free',
        'error': str(e)
    }))
`;
        
        const result = execSync(`python3 -c "${script.replace(/"/g, '\\"')}"`, {
            encoding: 'utf-8',
            timeout: 5000,
            windowsHide: true
        });
        
        return JSON.parse(result.trim());
    } catch (error) {
        return {
            active: false,
            tier: 'free',
            error: error.message
        };
    }
}

/**
 * Check feature access
 */
export function checkFeatureAccess(token, feature) {
    if (!isCoreAvailable()) {
        return { allowed: true, tier: 'free' }; // Graceful degradation
    }
    
    try {
        const corePath = path.join(__dirname, '../../core');
        const script = `
import sys
import os
sys.path.insert(0, '${corePath.replace(/\\/g, '/')}')
from core.core import PhoenixCore
import json

key = os.environ.get('LICENSE_SIGNING_KEY', '').encode() if os.environ.get('LICENSE_SIGNING_KEY') else b'dev-key'
core = PhoenixCore(key)

try:
    license_obj = core.authorize('${token}', '${feature}', 'api')
    print(json.dumps({
        'allowed': True,
        'tier': license_obj.tier
    }))
except Exception as e:
    print(json.dumps({
        'allowed': False,
        'tier': 'free',
        'error': str(e)
    }))
`;
        
        const result = execSync(`python3 -c "${script.replace(/"/g, '\\"')}"`, {
            encoding: 'utf-8',
            timeout: 5000,
            windowsHide: true
        });
        
        return JSON.parse(result.trim());
    } catch (error) {
        return {
            allowed: false,
            tier: 'free',
            error: error.message
        };
    }
}
