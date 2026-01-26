/**
 * Sonic Codex - Secret Room #8
 * 
 * Audio capture, enhancement, transcription, and export.
 * Proxies to FastAPI backend.
 * 
 * @module trapdoor-sonic
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
 * GET /api/v1/trapdoor/sonic
 * Get Sonic Codex information
 */
router.get('/', requireTrapdoorPasscode, (req, res) => {
  res.sendEnvelope({
    name: 'Sonic Codex',
    description: 'Audio processing and transcription suite',
    features: [
      'Audio capture (Live/File/URL)',
      'Forensic enhancement',
      'Whisper transcription',
      'Speaker diarization',
      'Export package'
    ],
    endpoints: {
      upload: '/api/v1/trapdoor/sonic/upload',
      extract: '/api/v1/trapdoor/sonic/extract',
      capture: '/api/v1/trapdoor/sonic/capture/start',
      jobs: '/api/v1/trapdoor/sonic/jobs',
      download: '/api/v1/trapdoor/sonic/jobs/:jobId/download'
    },
    status: 'available',
    requiresAuth: true,
    backend: 'FastAPI'
  });
});

/**
 * POST /api/v1/trapdoor/sonic/upload
 * Upload audio/video file
 */
router.post('/upload', requireTrapdoorPasscode, async (req, res) => {
  await shadowLogger.logShadow({
    operation: 'sonic_upload',
    userId: req.ip,
    authorization: 'TRAPDOOR',
    success: false,
    metadata: { method: req.method, path: req.path }
  });

  // Note: File uploads should be handled directly by FastAPI
  // This is a simplified proxy - in production, files should be streamed
  return res.sendError('NOT_IMPLEMENTED', 'File uploads should be sent directly to FastAPI backend', {
    fastapi_url: FASTAPI_URL,
    endpoint: '/api/v1/trapdoor/sonic/upload'
  }, 501);
});

/**
 * POST /api/v1/trapdoor/sonic/capture/start
 * Start live audio capture
 */
router.post('/capture/start', requireTrapdoorPasscode, async (req, res) => {
  return proxyToFastAPI(req, res, '/api/v1/trapdoor/sonic/capture/start', 'POST', req.body);
});

/**
 * GET /api/v1/trapdoor/sonic/jobs
 * List all jobs
 */
router.get('/jobs', requireTrapdoorPasscode, async (req, res) => {
  return proxyToFastAPI(req, res, '/api/v1/trapdoor/sonic/jobs');
});

/**
 * GET /api/v1/trapdoor/sonic/jobs/:jobId
 * Get job details
 */
router.get('/jobs/:jobId', requireTrapdoorPasscode, async (req, res) => {
  return proxyToFastAPI(req, res, `/api/v1/trapdoor/sonic/jobs/${req.params.jobId}`);
});

/**
 * GET /api/v1/trapdoor/sonic/jobs/:jobId/download
 * Download job package
 */
router.get('/jobs/:jobId/download', requireTrapdoorPasscode, async (req, res) => {
  // Redirect to FastAPI for file download
  const fastapiUrl = `${FASTAPI_URL}/api/v1/trapdoor/sonic/jobs/${req.params.jobId}/download`;
  const passcode = req.headers['x-secret-room-passcode'] || req.headers['x-api-key'];
  
  // Proxy the download
  try {
    const response = await fetch(fastapiUrl, {
      headers: { 'X-Secret-Room-Passcode': passcode }
    });
    
    if (response.ok) {
      res.setHeader('Content-Type', 'application/zip');
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } else {
      return res.sendError('DOWNLOAD_FAILED', 'Failed to download package', {
        error: 'Backend download failed'
      }, 500);
    }
  } catch (error) {
    return res.sendError('DOWNLOAD_FAILED', 'Failed to download package', {
      error: error.message
    }, 500);
  }
});

export default router;
