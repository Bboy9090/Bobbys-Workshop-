/**
 * 🌟 World Class Universal Legend - Advanced Analytics Engine
 * 
 * Business intelligence and reporting system
 * Features:
 * - Custom report builder
 * - Trend analysis
 * - Performance insights
 * - Data aggregation
 * - Export capabilities
 */

import metricsCollector from '../observability/metrics-collector.js';
import performanceProfiler from './performance-profiler.js';
import advancedCache from './advanced-cache.js';

class AnalyticsEngine {
  constructor() {
    this.reports = new Map();
    this.scheduledReports = new Map();
  }

  // Generate custom report
  async generateReport(config) {
    const {
      name,
      metrics,
      timeRange,
      aggregations,
      filters,
    } = config;

    const report = {
      id: `report-${Date.now()}-${Math.random()}`,
      name,
      generatedAt: new Date().toISOString(),
      timeRange,
      data: {},
    };

    // Collect metrics
    const allMetrics = metricsCollector.getMetricsJSON();
    const profilerStats = performanceProfiler.getStats();
    const cacheStats = advancedCache.getStats();

    // Aggregate data based on config
    for (const metric of metrics) {
      report.data[metric] = await this._aggregateMetric(
        metric,
        allMetrics,
        profilerStats,
        cacheStats,
        timeRange,
        aggregations
      );
    }

    // Apply filters
    if (filters) {
      report.data = this._applyFilters(report.data, filters);
    }

    // Store report
    this.reports.set(report.id, report);

    return report;
  }

  async _aggregateMetric(metric, allMetrics, profilerStats, cacheStats, timeRange, aggregations) {
    let value = null;

    // Get metric value from appropriate source
    switch (metric) {
      case 'request_count':
        value = allMetrics.counters?.['http_requests_total']?.value || 0;
        break;
      case 'average_response_time':
        value = profilerStats.averageDuration || 0;
        break;
      case 'cache_hit_rate':
        value = parseFloat(cacheStats.hitRate) || 0;
        break;
      case 'error_rate':
        value = allMetrics.counters?.['errors_total']?.value || 0;
        break;
      case 'p95_response_time':
        value = profilerStats.p95 || 0;
        break;
      case 'p99_response_time':
        value = profilerStats.p99 || 0;
        break;
      default:
        value = this._getMetricValue(metric, allMetrics, profilerStats, cacheStats);
    }

    // Apply aggregations
    if (aggregations) {
      return this._applyAggregations(value, aggregations);
    }

    return value;
  }

  _getMetricValue(metric, allMetrics, profilerStats, cacheStats) {
    // Try to find metric in various sources
    const metricPath = metric.split('.');
    let value = allMetrics;

    for (const part of metricPath) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return typeof value === 'number' ? value : null;
  }

  _applyAggregations(value, aggregations) {
    const result = {};

    for (const agg of aggregations) {
      switch (agg) {
        case 'sum':
          result.sum = value;
          break;
        case 'avg':
          result.avg = value;
          break;
        case 'min':
          result.min = value;
          break;
        case 'max':
          result.max = value;
          break;
        case 'count':
          result.count = value;
          break;
      }
    }

    return result;
  }

  _applyFilters(data, filters) {
    let filtered = { ...data };

    for (const filter of filters) {
      const { field, operator, value } = filter;

      switch (operator) {
        case 'gt':
          if (filtered[field] <= value) delete filtered[field];
          break;
        case 'lt':
          if (filtered[field] >= value) delete filtered[field];
          break;
        case 'eq':
          if (filtered[field] !== value) delete filtered[field];
          break;
        case 'contains':
          if (!String(filtered[field]).includes(value)) delete filtered[field];
          break;
      }
    }

    return filtered;
  }

  // Trend analysis
  analyzeTrends(metric, timeRange) {
    // Simplified trend analysis
    // In production, would analyze historical data
    return {
      metric,
      trend: 'stable', // 'increasing', 'decreasing', 'stable'
      change: 0,
      changePercent: 0,
      forecast: null,
    };
  }

  // Performance insights
  getPerformanceInsights() {
    const stats = performanceProfiler.getStats();
    const recommendations = performanceProfiler.getRecommendations(10);
    const cacheStats = advancedCache.getStats();

    return {
      overall: {
        averageResponseTime: stats.averageDuration,
        p95ResponseTime: stats.p95,
        p99ResponseTime: stats.p99,
        slowRequests: stats.slowRequests,
      },
      cache: {
        hitRate: cacheStats.hitRate,
        l1Size: cacheStats.l1Size,
        l2Available: cacheStats.l2Available,
      },
      recommendations: recommendations.map(r => ({
        type: r.recommendations[0]?.type,
        severity: r.recommendations[0]?.severity,
        message: r.recommendations[0]?.message,
        suggestion: r.recommendations[0]?.suggestion,
      })),
    };
  }

  // Export report
  exportReport(reportId, format = 'json') {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'csv':
        return this._toCSV(report);
      case 'pdf':
        // In production, would use PDF generation library
        return JSON.stringify(report, null, 2);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  _toCSV(report) {
    const lines = ['Metric,Value'];
    for (const [key, value] of Object.entries(report.data)) {
      lines.push(`${key},${typeof value === 'object' ? JSON.stringify(value) : value}`);
    }
    return lines.join('\n');
  }

  getReport(reportId) {
    return this.reports.get(reportId);
  }

  getAllReports() {
    return Array.from(this.reports.values());
  }

  deleteReport(reportId) {
    return this.reports.delete(reportId);
  }
}

export default new AnalyticsEngine();
