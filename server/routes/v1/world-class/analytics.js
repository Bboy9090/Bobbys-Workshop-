/**
 * 🌟 World Class Universal Legend - Analytics API
 * 
 * Business intelligence and reporting endpoints
 */

import express from 'express';
import analyticsEngine from '../../../utils/world-class/analytics.js';

const router = express.Router();

/**
 * POST /api/v1/world-class/analytics/reports
 * Generate custom report
 */
router.post('/reports', async (req, res) => {
  try {
    const report = await analyticsEngine.generateReport(req.body);
    res.json({
      envelope: {
        version: '1.0',
        operation: 'generate_report',
        mode: 'write',
        timestamp: new Date().toISOString(),
      },
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'generate_report',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/world-class/analytics/reports
 * Get all reports
 */
router.get('/reports', (req, res) => {
  try {
    const reports = analyticsEngine.getAllReports();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_reports',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: { reports },
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_reports',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/world-class/analytics/reports/:reportId
 * Get specific report
 */
router.get('/reports/:reportId', (req, res) => {
  try {
    const { reportId } = req.params;
    const report = analyticsEngine.getReport(reportId);
    
    if (!report) {
      return res.status(404).json({
        envelope: {
          version: '1.0',
          operation: 'get_report',
          mode: 'error',
          timestamp: new Date().toISOString(),
        },
        error: { message: 'Report not found' },
      });
    }

    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_report',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_report',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/world-class/analytics/reports/:reportId/export
 * Export report in various formats
 */
router.get('/reports/:reportId/export', (req, res) => {
  try {
    const { reportId } = req.params;
    const { format = 'json' } = req.query;

    const exported = analyticsEngine.exportReport(reportId, format);

    // Set appropriate content type
    const contentType = {
      json: 'application/json',
      csv: 'text/csv',
      pdf: 'application/pdf',
    }[format] || 'application/json';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.${format}"`);
    res.send(exported);
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'export_report',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * GET /api/v1/world-class/analytics/insights
 * Get performance insights
 */
router.get('/insights', (req, res) => {
  try {
    const insights = analyticsEngine.getPerformanceInsights();
    res.json({
      envelope: {
        version: '1.0',
        operation: 'get_insights',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: insights,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'get_insights',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

/**
 * POST /api/v1/world-class/analytics/trends
 * Analyze trends for a metric
 */
router.post('/trends', (req, res) => {
  try {
    const { metric, timeRange } = req.body;
    const trends = analyticsEngine.analyzeTrends(metric, timeRange);
    
    res.json({
      envelope: {
        version: '1.0',
        operation: 'analyze_trends',
        mode: 'read',
        timestamp: new Date().toISOString(),
      },
      data: trends,
    });
  } catch (error) {
    res.status(500).json({
      envelope: {
        version: '1.0',
        operation: 'analyze_trends',
        mode: 'error',
        timestamp: new Date().toISOString(),
      },
      error: { message: error.message },
    });
  }
});

export default router;
