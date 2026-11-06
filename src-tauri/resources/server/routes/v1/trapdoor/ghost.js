/**
 * Ghost Codex - Secret Room #9
 * 
 * Metadata shredding, canary tokens, burner personas.
 * Proxies to FastAPI backend.
 * 
 * @module trapdoor-ghost
 */

import express from 'express';
import { requireTrapdoorPasscode } from '../../../middleware/trapdoor-auth.js';
import ShadowLogger from '../../../../core/lib/shadow-logger.js';

const router = express.Router({ mergeParams: true });
const shadowLogger = new ShadowLogger();

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';

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
    } else {
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

router.get('/', requireTrapdoorPasscode, (req, res) => {
  res.sendEnvelope({
    name: 'Ghost Codex',
    description: 'Metadata shredding and privacy tools',
    features: [
      'Metadata shredder',
      'Canary tokens',
      'Burner personas',
      'Hidden partitions'
    ],
    endpoints: {
      shred: '/api/v1/trapdoor/ghost/shred',
      canary: '/api/v1/trapdoor/ghost/canary/generate',
      persona: '/api/v1/trapdoor/ghost/persona/create',
      alerts: '/api/v1/trapdoor/ghost/alerts'
    },
    status: 'available',
    requiresAuth: true,
    backend: 'FastAPI'
  });
});

router.post('/shred', requireTrapdoorPasscode, async (req, res) => {
  await shadowLogger.logShadow({
    operation: 'ghost_shred',
    userId: req.ip,
    authorization: 'TRAPDOOR',
    success: false,
    metadata: { method: req.method, path: req.path }
  });

  return res.sendError('NOT_IMPLEMENTED', 'File uploads should be sent directly to FastAPI backend', {
    fastapi_url: FASTAPI_URL,
    endpoint: '/api/v1/trapdoor/ghost/shred'
  }, 501);
});

router.post('/canary/generate', requireTrapdoorPasscode, async (req, res) => {
  return proxyToFastAPI(req, res, '/api/v1/trapdoor/ghost/canary/generate', 'POST', req.body);
});

router.get('/trap/:tokenId', requireTrapdoorPasscode, async (req, res) => {
  return proxyToFastAPI(req, res, `/api/v1/trapdoor/ghost/trap/${req.params.tokenId}`);
});

router.get('/alerts', requireTrapdoorPasscode, async (req, res) => {
  return proxyToFastAPI(req, res, '/api/v1/trapdoor/ghost/alerts');
});

router.post('/persona/create', requireTrapdoorPasscode, async (req, res) => {
  return proxyToFastAPI(req, res, '/api/v1/trapdoor/ghost/persona/create', 'POST', req.body);
});

router.get('/personas', requireTrapdoorPasscode, async (req, res) => {
  return proxyToFastAPI(req, res, '/api/v1/trapdoor/ghost/personas');
});

export default router;
