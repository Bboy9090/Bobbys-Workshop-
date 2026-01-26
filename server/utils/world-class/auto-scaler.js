/**
 * 🌟 World Class Universal Legend - Auto-Scaling Controller
 * 
 * Horizontal auto-scaling based on metrics
 * Features:
 * - CPU-based scaling
 * - Memory-based scaling
 * - Request rate scaling
 * - Custom metric scaling
 * - Cooldown periods
 */

import metricsCollector from '../observability/metrics-collector.js';

class AutoScaler {
  constructor() {
    this.config = {
      minInstances: 1,
      maxInstances: 10,
      targetCPU: 70, // percentage
      targetMemory: 80, // percentage
      targetRequestRate: 100, // requests per second
      scaleUpThreshold: 0.8, // 80% of target
      scaleDownThreshold: 0.3, // 30% of target
      cooldownPeriod: 300000, // 5 minutes
    };
    this.currentInstances = 1;
    this.lastScaleAction = null;
    this.scaleHistory = [];
  }

  // Check if scaling is needed
  async checkScaling() {
    // Check cooldown
    if (this.lastScaleAction && Date.now() - this.lastScaleAction < this.config.cooldownPeriod) {
      return { action: 'none', reason: 'cooldown' };
    }

    const metrics = metricsCollector.getMetricsJSON();
    const recommendations = [];

    // Check CPU
    const cpuUsage = this._getCPUUsage(metrics);
    if (cpuUsage > this.config.targetCPU * this.config.scaleUpThreshold) {
      recommendations.push({
        metric: 'cpu',
        value: cpuUsage,
        threshold: this.config.targetCPU,
        action: 'scale_up',
      });
    } else if (cpuUsage < this.config.targetCPU * this.config.scaleDownThreshold) {
      recommendations.push({
        metric: 'cpu',
        value: cpuUsage,
        threshold: this.config.targetCPU,
        action: 'scale_down',
      });
    }

    // Check Memory
    const memoryUsage = this._getMemoryUsage(metrics);
    if (memoryUsage > this.config.targetMemory * this.config.scaleUpThreshold) {
      recommendations.push({
        metric: 'memory',
        value: memoryUsage,
        threshold: this.config.targetMemory,
        action: 'scale_up',
      });
    } else if (memoryUsage < this.config.targetMemory * this.config.scaleDownThreshold) {
      recommendations.push({
        metric: 'memory',
        value: memoryUsage,
        threshold: this.config.targetMemory,
        action: 'scale_down',
      });
    }

    // Check Request Rate
    const requestRate = this._getRequestRate(metrics);
    if (requestRate > this.config.targetRequestRate * this.config.scaleUpThreshold) {
      recommendations.push({
        metric: 'request_rate',
        value: requestRate,
        threshold: this.config.targetRequestRate,
        action: 'scale_up',
      });
    } else if (requestRate < this.config.targetRequestRate * this.config.scaleDownThreshold) {
      recommendations.push({
        metric: 'request_rate',
        value: requestRate,
        threshold: this.config.targetRequestRate,
        action: 'scale_down',
      });
    }

    // Determine final action
    const scaleUpCount = recommendations.filter(r => r.action === 'scale_up').length;
    const scaleDownCount = recommendations.filter(r => r.action === 'scale_down').length;

    if (scaleUpCount > scaleDownCount && this.currentInstances < this.config.maxInstances) {
      return this._scaleUp(recommendations);
    } else if (scaleDownCount > scaleUpCount && this.currentInstances > this.config.minInstances) {
      return this._scaleDown(recommendations);
    }

    return { action: 'none', reason: 'no_scaling_needed', recommendations };
  }

  _scaleUp(recommendations) {
    const newInstances = Math.min(
      this.currentInstances + 1,
      this.config.maxInstances
    );

    const action = {
      action: 'scale_up',
      from: this.currentInstances,
      to: newInstances,
      recommendations,
      timestamp: new Date().toISOString(),
    };

    this.currentInstances = newInstances;
    this.lastScaleAction = Date.now();
    this.scaleHistory.push(action);

    // In production, this would trigger actual scaling (Kubernetes, Docker Swarm, etc.)
    console.log(`📈 Auto-scaling UP: ${action.from} → ${action.to} instances`);

    return action;
  }

  _scaleDown(recommendations) {
    const newInstances = Math.max(
      this.currentInstances - 1,
      this.config.minInstances
    );

    const action = {
      action: 'scale_down',
      from: this.currentInstances,
      to: newInstances,
      recommendations,
      timestamp: new Date().toISOString(),
    };

    this.currentInstances = newInstances;
    this.lastScaleAction = Date.now();
    this.scaleHistory.push(action);

    // In production, this would trigger actual scaling
    console.log(`📉 Auto-scaling DOWN: ${action.from} → ${action.to} instances`);

    return action;
  }

  _getCPUUsage(metrics) {
    // Extract CPU usage from metrics
    // This is a simplified version - in production, use actual system metrics
    const systemMetrics = metrics.system || {};
    return systemMetrics.cpuUsage || 0;
  }

  _getMemoryUsage(metrics) {
    const systemMetrics = metrics.system || {};
    if (systemMetrics.memoryTotal && systemMetrics.memoryUsed) {
      return (systemMetrics.memoryUsed / systemMetrics.memoryTotal) * 100;
    }
    return 0;
  }

  _getRequestRate(metrics) {
    const counters = metrics.counters || {};
    const requestCounter = counters['http_requests_total'] || { value: 0 };
    // Simplified - in production, calculate actual rate over time window
    return requestCounter.value / 60; // requests per second (simplified)
  }

  getStatus() {
    return {
      currentInstances: this.currentInstances,
      config: this.config,
      lastScaleAction: this.lastScaleAction,
      scaleHistory: this.scaleHistory.slice(-10), // Last 10 actions
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    return this.config;
  }
}

export default new AutoScaler();
