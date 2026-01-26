/**
 * 🚀 Beyond World Class - Predictive Analytics Engine
 * 
 * ML-based predictive analytics with:
 * - Anomaly detection
 * - Predictive scaling
 * - Capacity planning
 * - Failure prediction
 */

import metricsCollector from '../observability/metrics-collector.js';
import performanceProfiler from '../world-class/performance-profiler.js';

class PredictiveAnalytics {
  constructor() {
    this.models = new Map();
    this.historicalData = [];
    this.predictions = new Map();
    this.anomalies = [];
  }

  // Simple moving average for trend prediction
  predictTrend(metric, windowSize = 10) {
    const data = this._getHistoricalMetric(metric, windowSize);
    if (data.length < windowSize) {
      return { trend: 'insufficient_data', confidence: 0 };
    }

    // Calculate moving average
    const sum = data.reduce((a, b) => a + b, 0);
    const avg = sum / data.length;

    // Calculate trend
    const recent = data.slice(-5);
    const older = data.slice(0, 5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    const trend = change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable';

    return {
      trend,
      currentValue: data[data.length - 1],
      predictedValue: avg + (change / 100) * avg,
      confidence: Math.min(100, (data.length / windowSize) * 100),
      changePercent: change,
    };
  }

  // Anomaly detection using statistical methods
  detectAnomaly(metric, value) {
    const data = this._getHistoricalMetric(metric, 100);
    if (data.length < 10) {
      return { isAnomaly: false, reason: 'insufficient_data' };
    }

    // Calculate mean and standard deviation
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    // Z-score calculation
    const zScore = Math.abs((value - mean) / stdDev);

    // Anomaly if z-score > 3 (99.7% confidence)
    const isAnomaly = zScore > 3;

    if (isAnomaly) {
      const anomaly = {
        metric,
        value,
        mean,
        stdDev,
        zScore,
        timestamp: new Date().toISOString(),
        severity: zScore > 5 ? 'critical' : zScore > 4 ? 'high' : 'medium',
      };

      this.anomalies.push(anomaly);
      
      // Keep only last 1000 anomalies
      if (this.anomalies.length > 1000) {
        this.anomalies.shift();
      }

      return anomaly;
    }

    return { isAnomaly: false, zScore };
  }

  // Predict when scaling will be needed
  predictScalingNeeds(timeWindow = 3600000) { // 1 hour
    const metrics = metricsCollector.getMetricsJSON();
    const profilerStats = performanceProfiler.getStats();

    const predictions = {
      cpu: this.predictTrend('cpu_usage', 20),
      memory: this.predictTrend('memory_usage', 20),
      requestRate: this.predictTrend('request_rate', 20),
      responseTime: this.predictTrend('response_time', 20),
    };

    // Determine if scaling is needed
    const scalingRecommendation = {
      shouldScale: false,
      direction: null, // 'up' or 'down'
      confidence: 0,
      reason: null,
      predictedTime: null,
    };

    // Check if any metric predicts high load
    const highLoadMetrics = Object.entries(predictions).filter(
      ([_, pred]) => pred.trend === 'increasing' && pred.predictedValue > 80
    );

    if (highLoadMetrics.length > 0) {
      scalingRecommendation.shouldScale = true;
      scalingRecommendation.direction = 'up';
      scalingRecommendation.confidence = Math.max(...highLoadMetrics.map(([_, p]) => p.confidence));
      scalingRecommendation.reason = `High load predicted for: ${highLoadMetrics.map(([m]) => m).join(', ')}`;
      
      // Estimate when scaling will be needed
      const avgChangeRate = highLoadMetrics.reduce((sum, [_, p]) => sum + Math.abs(p.changePercent), 0) / highLoadMetrics.length;
      const timeToThreshold = (80 - highLoadMetrics[0][1].currentValue) / (avgChangeRate / 100);
      scalingRecommendation.predictedTime = Date.now() + (timeToThreshold * 60000); // Convert to milliseconds
    }

    // Check if metrics predict low load
    const lowLoadMetrics = Object.entries(predictions).filter(
      ([_, pred]) => pred.trend === 'decreasing' && pred.predictedValue < 30
    );

    if (lowLoadMetrics.length > 2 && !scalingRecommendation.shouldScale) {
      scalingRecommendation.shouldScale = true;
      scalingRecommendation.direction = 'down';
      scalingRecommendation.confidence = Math.max(...lowLoadMetrics.map(([_, p]) => p.confidence));
      scalingRecommendation.reason = `Low load predicted for: ${lowLoadMetrics.map(([m]) => m).join(', ')}`;
    }

    return {
      predictions,
      scalingRecommendation,
      timestamp: new Date().toISOString(),
    };
  }

  // Predict system failure
  predictFailure(metrics) {
    const indicators = {
      highErrorRate: metrics.counters?.errors_total?.value > 100,
      slowResponseTime: metrics.histograms?.request_duration_ms?.p95 > 1000,
      highMemoryUsage: metrics.gauges?.memory_usage?.value > 90,
      highCPUUsage: metrics.gauges?.cpu_usage?.value > 95,
    };

    const riskScore = Object.values(indicators).filter(Boolean).length;
    const failureProbability = (riskScore / Object.keys(indicators).length) * 100;

    return {
      failureProbability,
      riskScore,
      indicators,
      recommendation: failureProbability > 50 
        ? 'Immediate action required - system at high risk of failure'
        : failureProbability > 25
        ? 'Monitor closely - elevated risk detected'
        : 'System healthy',
      timestamp: new Date().toISOString(),
    };
  }

  // Capacity planning
  planCapacity(timeHorizon = 30) { // 30 days
    const trends = {
      cpu: this.predictTrend('cpu_usage', 30),
      memory: this.predictTrend('memory_usage', 30),
      storage: this.predictTrend('storage_usage', 30),
      requests: this.predictTrend('request_rate', 30),
    };

    const projections = {};
    for (const [metric, trend] of Object.entries(trends)) {
      if (trend.trend === 'increasing') {
        const dailyGrowth = trend.changePercent / 100;
        const projectedValue = trend.currentValue * Math.pow(1 + dailyGrowth, timeHorizon);
        projections[metric] = {
          current: trend.currentValue,
          projected: projectedValue,
          growth: ((projectedValue - trend.currentValue) / trend.currentValue) * 100,
        };
      }
    }

    return {
      timeHorizon,
      trends,
      projections,
      recommendations: this._generateCapacityRecommendations(projections),
      timestamp: new Date().toISOString(),
    };
  }

  _generateCapacityRecommendations(projections) {
    const recommendations = [];

    for (const [metric, proj] of Object.entries(projections)) {
      if (proj.projected > 80) {
        recommendations.push({
          metric,
          action: 'scale_up',
          urgency: proj.projected > 95 ? 'critical' : 'high',
          message: `${metric} projected to reach ${proj.projected.toFixed(1)}% in 30 days`,
        });
      }
    }

    return recommendations;
  }

  _getHistoricalMetric(metric, windowSize) {
    // In production, this would fetch from time-series database
    // For now, return mock data based on current metrics
    const current = this._getCurrentMetricValue(metric);
    const data = [];
    
    for (let i = windowSize; i > 0; i--) {
      // Simulate historical data with some variation
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
      data.push(current * (1 + variation));
    }

    return data;
  }

  _getCurrentMetricValue(metric) {
    const metrics = metricsCollector.getMetricsJSON();
    
    switch (metric) {
      case 'cpu_usage':
        return metrics.gauges?.cpu_usage?.value || 50;
      case 'memory_usage':
        return metrics.gauges?.memory_usage?.value || 60;
      case 'request_rate':
        return metrics.counters?.http_requests_total?.value / 60 || 10;
      case 'response_time':
        return performanceProfiler.getStats().averageDuration || 100;
      default:
        return 0;
    }
  }

  getAnomalies(limit = 100) {
    return this.anomalies.slice(-limit).reverse();
  }

  getPredictions() {
    return Array.from(this.predictions.values());
  }
}

export default new PredictiveAnalytics();
