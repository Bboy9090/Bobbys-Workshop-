/**
 * Pandora Codex - Secret Room #10
 * 
 * Hardware manipulation, DFU detection, jailbreak automation.
 * Proxies to FastAPI backend.
 * 
 * @module trapdoor-pandora
 */

import express from 'express';
import { requireTrapdoorPasscode } from '../../../middleware/trapdoor-auth.js';
import ShadowLogger from '../../../../core/lib/shadow-logger.js';

const router = express.Router({ mergeParams: true });
const shadowLogger = new ShadowLogger();

// FastAPI backend URL
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';

/**
 * Proxy request to FastAPI backend using fetch
 */
async function proxyToFastAPI(req, res, endpoint, method = 'GET', data = null) {
  try {
    const url = `${FASTAPI_URL}${endpoint}`;
    const headers = {
      'X-Secret-Room-Passcode': req.headers['x-secret-room-passcode'] || req.headers['x-api-key']
    };

    let response;
    if (method === 'POST') {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: data ? JSON.stringify(data) : undefined
      });
    } else if (method === 'GET') {
      response = await fetch(url, { headers });
    }

    const responseData = await response.json();
    
    if (response.ok) {
      return res.sendEnvelope(responseData);
    } else {
      return res.status(response.status).json({
        ok: false,
        error: responseData.error || { code: 'BACKEND_ERROR', message: 'Backend request failed' }
      });
    }
  } catch (error) {
    return res.sendError('BACKEND_ERROR', 'Failed to connect to FastAPI backend', {
      error: error.message
    }, 503);
  }
}

/**
 * GET /api/v1/trapdoor/pandora
 * Get Pandora Codex information
 */
router.get('/', requireTrapdoorPasscode, (req, res) => {
  res.sendEnvelope({
    name: 'Pandora Codex',
    description: 'Hardware manipulation and Chain-Breaker',
    features: [
      'Chain-Breaker UI',
      'DFU detection',
      'Hardware manipulation',
      'Jailbreak automation'
    ],
    endpoints: {
      chainbreaker: '/api/v1/trapdoor/pandora/chainbreaker',
      dfu: '/api/v1/trapdoor/pandora/dfu/detect',
      manipulate: '/api/v1/trapdoor/pandora/manipulate',
      jailbreak: '/api/v1/trapdoor/pandora/jailbreak/execute',
      devices: '/api/v1/trapdoor/pandora/devices'
    },
    status: 'available',
    requiresAuth: true,
    backend: 'FastAPI',
    legal: {
      note: 'All operations are for owner devices only. Use responsibly and in compliance with applicable laws.',
      disclaimer: 'Hardware manipulation tools are for diagnostic repair and device restoration purposes only.'
    }
  });
});

/**
 * POST /api/v1/trapdoor/pandora/chainbreaker
 * Chain-Breaker operation (bypass activation/security)
 */
router.post('/chainbreaker', requireTrapdoorPasscode, async (req, res) => {
  await shadowLogger.logShadow({
    operation: 'pandora_chainbreaker',
    userId: req.ip,
    authorization: 'TRAPDOOR',
    success: false,
    metadata: { method: req.method, path: req.path, params: req.body }
  });

  return proxyToFastAPI(req, res, '/api/v1/trapdoor/pandora/chainbreaker', 'POST', req.body);
});

/**
 * POST /api/v1/trapdoor/pandora/dfu/detect
 * Detect DFU mode
 */
router.post('/dfu/detect', requireTrapdoorPasscode, async (req, res) => {
  return proxyToFastAPI(req, res, '/api/v1/trapdoor/pandora/dfu/detect', 'POST', req.body);
});

/**
 * POST /api/v1/trapdoor/pandora/dfu/enter
 * Enter DFU mode
 */
router.post('/dfu/enter', requireTrapdoorPasscode, async (req, res) => {
  return proxyToFastAPI(req, res, '/api/v1/trapdoor/pandora/dfu/enter', 'POST', req.body);
});

/**
 * GET /api/v1/trapdoor/pandora/devices
 * List detected devices
 */
router.get('/devices', requireTrapdoorPasscode, async (req, res) => {
  return proxyToFastAPI(req, res, '/api/v1/trapdoor/pandora/devices');
});

/**
 * POST /api/v1/trapdoor/pandora/manipulate
 * Hardware manipulation operations
 */
router.post('/manipulate', requireTrapdoorPasscode, async (req, res) => {
  await shadowLogger.logShadow({
    operation: 'pandora_manipulate',
    userId: req.ip,
    authorization: 'TRAPDOOR',
    success: false,
    metadata: { method: req.method, path: req.path, params: req.body }
  });

  return proxyToFastAPI(req, res, '/api/v1/trapdoor/pandora/manipulate', 'POST', req.body);
});

/**
 * POST /api/v1/trapdoor/pandora/jailbreak/execute
 * Execute jailbreak automation
 */
router.post('/jailbreak/execute', requireTrapdoorPasscode, async (req, res) => {
  await shadowLogger.logShadow({
    operation: 'pandora_jailbreak',
    userId: req.ip,
    authorization: 'TRAPDOOR',
    success: false,
    metadata: { method: req.method, path: req.path, params: req.body }
  });

  return proxyToFastAPI(req, res, '/api/v1/trapdoor/pandora/jailbreak/execute', 'POST', req.body);
});

/**
 * GET /api/v1/trapdoor/pandora/jailbreak/methods
 * List available jailbreak methods
 */
router.get('/jailbreak/methods', requireTrapdoorPasscode, async (req, res) => {
  return proxyToFastAPI(req, res, '/api/v1/trapdoor/pandora/jailbreak/methods');
});

export default router;
