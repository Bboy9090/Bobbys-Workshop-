// Trapdoor API - Secure REST endpoints for sensitive operations
// Requires admin-level authentication for all operations
// Includes throttling, monitoring, and batch workflow execution

import express from 'express';
import WorkflowEngine from '../tasks/workflow-engine.js';
import ShadowLogger from '../lib/shadow-logger.js';

const router = express.Router();
const workflowEngine = new WorkflowEngine();
const shadowLogger = new ShadowLogger();

// API usage tracking for monitoring and throttling
const apiUsageStats = {
  requests: {},
  totalRequests: 0,
  throttledRequests: 0,
  failedRequests: 0,
  successfulRequests: 0
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;
const rateLimitMap = new Map();

/**
 * Throttling middleware - Rate limit API calls
 */
function throttleRequests(req, res, next) {
  const clientId = req.ip;
  const now = Date.now();

  if (!rateLimitMap.has(clientId)) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  } else {
    const clientData = rateLimitMap.get(clientId);

    if (now > clientData.resetTime) {
      // Reset window
      clientData.count = 1;
      clientData.resetTime = now + RATE_LIMIT_WINDOW;
    } else {
      clientData.count++;

      if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
        apiUsageStats.throttledRequests++;

        shadowLogger.logShadow({
          operation: 'rate_limit_exceeded',
          deviceSerial: 'N/A',
          userId: req.ip,
          authorization: 'THROTTLED',
          success: false,
          metadata: {
            endpoint: req.path,
            requestCount: clientData.count,
            resetTime: new Date(clientData.resetTime).toISOString()
          }
        }).catch(err => console.error('Shadow log error:', err));

        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
        });
      }
    }
  }

  next();
}

/**
 * Monitoring middleware - Track API usage
 */
function monitorUsage(req, res, next) {
  const endpoint = req.path;

  // Track request
  if (!apiUsageStats.requests[endpoint]) {
    apiUsageStats.requests[endpoint] = 0;
  }
  apiUsageStats.requests[endpoint]++;
  apiUsageStats.totalRequests++;

  // Track response
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      apiUsageStats.successfulRequests++;
    } else {
      apiUsageStats.failedRequests++;
    }
    return originalJson(data);
  };

  next();
}

/**
 * Admin authentication middleware
 * In production, this should use JWT or similar
 */
function requireAdmin(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const adminKey = process.env.ADMIN_API_KEY || 'dev-admin-key';

  if (!apiKey || apiKey !== adminKey) {
    shadowLogger.logShadow({
      operation: 'unauthorized_access_attempt',
      deviceSerial: 'N/A',
      userId: req.ip,
      authorization: 'DENIED',
      success: false,
      metadata: {
        endpoint: req.path,
        method: req.method,
        ip: req.ip
      }
    }).catch(err => console.error('Shadow log error:', err));

    return res.status(403).json({
      error: 'Unauthorized',
      message: 'Admin access required'
    });
  }

  next();
}

// Apply throttling and monitoring to all routes
router.use(throttleRequests);
router.use(monitorUsage);

/**
 * POST /api/trapdoor/frp
 * Execute FRP bypass workflow
 */
router.post('/frp', requireAdmin, async (req, res) => {
  try {
    const { deviceSerial, authorization } = req.body;

    if (!deviceSerial) {
      return res.status(400).json({
        error: 'Device serial required'
      });
    }

    if (!authorization || !authorization.confirmed) {
      return res.status(400).json({
        error: 'Authorization required',
        message: 'User must explicitly confirm FRP bypass operation',
        prompt: "Type 'I OWN THIS DEVICE' to confirm you have legal authorization"
      });
    }

    // Log the operation request
    await shadowLogger.logShadow({
      operation: 'frp_bypass_requested',
      deviceSerial,
      userId: req.ip,
      authorization: authorization.userInput,
      success: true,
      metadata: {
        timestamp: new Date().toISOString(),
        endpoint: req.path
      }
    });

    // Execute workflow
    const result = await workflowEngine.executeWorkflow('bypass', 'frp-bypass', {
      deviceSerial,
      userId: req.ip,
      authorization
    });

    // Log completion
    await shadowLogger.logShadow({
      operation: 'frp_bypass_completed',
      deviceSerial,
      userId: req.ip,
      authorization: authorization.userInput,
      success: result.success,
      metadata: {
        timestamp: new Date().toISOString(),
        results: result.results
      }
    });

    return res.json(result);
  } catch (error) {
    console.error('FRP bypass error:', error);

    await shadowLogger.logShadow({
      operation: 'frp_bypass_error',
      deviceSerial: req.body.deviceSerial || 'unknown',
      userId: req.ip,
      authorization: 'ERROR',
      success: false,
      metadata: {
        error: error.message
      }
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/trapdoor/unlock
 * Execute bootloader unlock workflow
 */
router.post('/unlock', requireAdmin, async (req, res) => {
  try {
    const { deviceSerial, authorization } = req.body;

    if (!deviceSerial) {
      return res.status(400).json({
        error: 'Device serial required'
      });
    }

    if (!authorization || !authorization.confirmed) {
      return res.status(400).json({
        error: 'Authorization required',
        message: 'User must explicitly confirm bootloader unlock (ERASES ALL DATA)',
        prompt: "Type 'UNLOCK' to confirm"
      });
    }

    // Log the operation request
    await shadowLogger.logShadow({
      operation: 'bootloader_unlock_requested',
      deviceSerial,
      userId: req.ip,
      authorization: authorization.userInput,
      success: true,
      metadata: {
        timestamp: new Date().toISOString(),
        endpoint: req.path
      }
    });

    // Execute workflow
    const result = await workflowEngine.executeWorkflow('android', 'fastboot-unlock', {
      deviceSerial,
      userId: req.ip,
      authorization
    });

    // Log completion
    await shadowLogger.logShadow({
      operation: 'bootloader_unlock_completed',
      deviceSerial,
      userId: req.ip,
      authorization: authorization.userInput,
      success: result.success,
      metadata: {
        timestamp: new Date().toISOString(),
        results: result.results
      }
    });

    return res.json(result);
  } catch (error) {
    console.error('Bootloader unlock error:', error);

    await shadowLogger.logShadow({
      operation: 'bootloader_unlock_error',
      deviceSerial: req.body.deviceSerial || 'unknown',
      userId: req.ip,
      authorization: 'ERROR',
      success: false,
      metadata: {
        error: error.message
      }
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/trapdoor/logs/shadow
 * Retrieve shadow logs (admin only)
 */
router.get('/logs/shadow', requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;

    // Log the access
    await shadowLogger.logShadow({
      operation: 'shadow_logs_accessed',
      deviceSerial: 'N/A',
      userId: req.ip,
      authorization: 'ADMIN',
      success: true,
      metadata: {
        date: date || 'today',
        timestamp: new Date().toISOString()
      }
    });

    const result = await shadowLogger.readShadowLogs(date);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.json({
      success: true,
      date: date || new Date().toISOString().split('T')[0],
      entries: result.entries,
      count: result.entries.length
    });
  } catch (error) {
    console.error('Error retrieving shadow logs:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/trapdoor/workflow/execute
 * Execute arbitrary workflow (admin only)
 */
router.post('/workflow/execute', requireAdmin, async (req, res) => {
  try {
    const { category, workflowId, deviceSerial, authorization } = req.body;

    if (!category || !workflowId || !deviceSerial) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['category', 'workflowId', 'deviceSerial']
      });
    }

    // Log the operation request
    await shadowLogger.logShadow({
      operation: 'workflow_execute_requested',
      deviceSerial,
      userId: req.ip,
      authorization: authorization?.userInput || 'ADMIN',
      success: true,
      metadata: {
        category,
        workflowId,
        timestamp: new Date().toISOString()
      }
    });

    // Execute workflow
    const result = await workflowEngine.executeWorkflow(category, workflowId, {
      deviceSerial,
      userId: req.ip,
      authorization
    });

    return res.json(result);
  } catch (error) {
    console.error('Workflow execution error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/trapdoor/workflows
 * List available workflows
 */
router.get('/workflows', requireAdmin, async (req, res) => {
  try {
    const result = await workflowEngine.listWorkflows();
    return res.json(result);
  } catch (error) {
    console.error('Error listing workflows:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/trapdoor/batch/execute
 * Execute multiple workflows in batch (admin only)
 */
router.post('/batch/execute', requireAdmin, async (req, res) => {
  try {
    const { workflows, authorization } = req.body;

    if (!workflows || !Array.isArray(workflows) || workflows.length === 0) {
      return res.status(400).json({
        error: 'Invalid batch request',
        message: 'workflows array is required and must contain at least one workflow'
      });
    }

    if (workflows.length > 10) {
      return res.status(400).json({
        error: 'Batch size limit exceeded',
        message: 'Maximum 10 workflows per batch'
      });
    }

    // Log batch operation start
    await shadowLogger.logShadow({
      operation: 'batch_workflow_started',
      deviceSerial: 'batch',
      userId: req.ip,
      authorization: authorization?.userInput || 'ADMIN',
      success: true,
      metadata: {
        workflowCount: workflows.length,
        workflows: workflows.map(w => ({ category: w.category, id: w.workflowId })),
        timestamp: new Date().toISOString()
      }
    });

    // Execute workflows in sequence
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const workflow of workflows) {
      const { category, workflowId, deviceSerial } = workflow;

      if (!category || !workflowId || !deviceSerial) {
        results.push({
          category,
          workflowId,
          deviceSerial,
          success: false,
          error: 'Missing required parameters (category, workflowId, deviceSerial)'
        });
        failureCount++;
        continue;
      }

      try {
        const result = await workflowEngine.executeWorkflow(category, workflowId, {
          deviceSerial,
          userId: req.ip,
          authorization
        });

        results.push({
          category,
          workflowId,
          deviceSerial,
          ...result
        });

        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        results.push({
          category,
          workflowId,
          deviceSerial,
          success: false,
          error: error.message
        });
        failureCount++;
      }
    }

    // Log batch completion
    await shadowLogger.logShadow({
      operation: 'batch_workflow_completed',
      deviceSerial: 'batch',
      userId: req.ip,
      authorization: authorization?.userInput || 'ADMIN',
      success: successCount > 0,
      metadata: {
        totalWorkflows: workflows.length,
        successCount,
        failureCount,
        timestamp: new Date().toISOString(),
        results: results.map(r => ({
          category: r.category,
          id: r.workflowId,
          success: r.success
        }))
      }
    });

    return res.json({
      success: true,
      batchSize: workflows.length,
      successCount,
      failureCount,
      results
    });
  } catch (error) {
    console.error('Batch workflow execution error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/trapdoor/monitoring/stats
 * Get API usage and monitoring statistics (admin only)
 */
router.get('/monitoring/stats', requireAdmin, async (req, res) => {
  try {
    const logStats = await shadowLogger.getLogStats();

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      apiUsage: {
        totalRequests: apiUsageStats.totalRequests,
        successfulRequests: apiUsageStats.successfulRequests,
        failedRequests: apiUsageStats.failedRequests,
        throttledRequests: apiUsageStats.throttledRequests,
        requestsByEndpoint: apiUsageStats.requests
      },
      rateLimiting: {
        windowSize: RATE_LIMIT_WINDOW / 1000 + 's',
        maxRequestsPerWindow: MAX_REQUESTS_PER_WINDOW,
        activeClients: rateLimitMap.size
      },
      logging: logStats.success ? logStats.stats : { error: 'Failed to retrieve log stats' }
    });
  } catch (error) {
    console.error('Error retrieving monitoring stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/trapdoor/logs/cleanup
 * Clean up old shadow logs based on retention policy (admin only)
 */
router.post('/logs/cleanup', requireAdmin, async (req, res) => {
  try {
    const result = await shadowLogger.cleanupOldLogs();

    await shadowLogger.logShadow({
      operation: 'log_cleanup_executed',
      deviceSerial: 'N/A',
      userId: req.ip,
      authorization: 'ADMIN',
      success: result.success,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });

    return res.json(result);
  } catch (error) {
    console.error('Error cleaning up logs:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
