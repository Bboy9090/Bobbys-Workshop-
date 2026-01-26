/**
 * 🌟 World Class Universal Legend - Performance Profiler
 * 
 * Advanced performance profiling and optimization
 * Features:
 * - Request profiling
 * - Slow query detection
 * - Performance recommendations
 * - Bottleneck identification
 */

import { performance } from 'perf_hooks';
import metricsCollector from '../observability/metrics-collector.js';

class PerformanceProfiler {
  constructor() {
    this.profiles = new Map();
    this.slowThreshold = 100; // ms
    this.recommendations = [];
  }

  startProfile(requestId, operation) {
    const profile = {
      requestId,
      operation,
      startTime: performance.now(),
      steps: [],
      metadata: {},
    };
    this.profiles.set(requestId, profile);
    return requestId;
  }

  addStep(requestId, stepName, metadata = {}) {
    const profile = this.profiles.get(requestId);
    if (!profile) return;

    const stepStart = performance.now();
    const step = {
      name: stepName,
      startTime: stepStart,
      duration: 0,
      metadata,
    };
    profile.steps.push(step);

    return () => {
      step.duration = performance.now() - stepStart;
      if (step.duration > this.slowThreshold) {
        this._recordSlowStep(profile, step);
      }
    };
  }

  endProfile(requestId) {
    const profile = this.profiles.get(requestId);
    if (!profile) return null;

    profile.duration = performance.now() - profile.startTime;
    profile.endTime = performance.now();

    // Record metrics
    metricsCollector.recordHistogram('request_duration_ms', profile.duration, {
      operation: profile.operation,
    });

    // Check for performance issues
    if (profile.duration > this.slowThreshold) {
      this._analyzeSlowRequest(profile);
    }

    // Clean up old profiles (keep last 1000)
    if (this.profiles.size > 1000) {
      const firstKey = this.profiles.keys().next().value;
      this.profiles.delete(firstKey);
    }

    return profile;
  }

  _recordSlowStep(profile, step) {
    metricsCollector.incrementCounter('slow_steps_total', {
      operation: profile.operation,
      step: step.name,
    });
  }

  _analyzeSlowRequest(profile) {
    const slowSteps = profile.steps.filter(s => s.duration > this.slowThreshold);
    
    if (slowSteps.length > 0) {
      const recommendations = this._generateRecommendations(profile, slowSteps);
      this.recommendations.push({
        timestamp: new Date().toISOString(),
        requestId: profile.requestId,
        operation: profile.operation,
        duration: profile.duration,
        slowSteps,
        recommendations,
      });

      // Keep only last 100 recommendations
      if (this.recommendations.length > 100) {
        this.recommendations.shift();
      }
    }
  }

  _generateRecommendations(profile, slowSteps) {
    const recommendations = [];

    // Database query optimization
    const dbSteps = slowSteps.filter(s => s.name.includes('db') || s.name.includes('query'));
    if (dbSteps.length > 0) {
      recommendations.push({
        type: 'database',
        severity: 'high',
        message: `${dbSteps.length} slow database operations detected`,
        suggestion: 'Consider adding database indexes or optimizing queries',
      });
    }

    // External API calls
    const apiSteps = slowSteps.filter(s => s.name.includes('api') || s.name.includes('http'));
    if (apiSteps.length > 0) {
      recommendations.push({
        type: 'external_api',
        severity: 'medium',
        message: `${apiSteps.length} slow external API calls detected`,
        suggestion: 'Consider implementing caching or connection pooling',
      });
    }

    // Cache misses
    const cacheSteps = slowSteps.filter(s => s.name.includes('cache') && s.metadata.miss);
    if (cacheSteps.length > 0) {
      recommendations.push({
        type: 'caching',
        severity: 'medium',
        message: `${cacheSteps.length} cache misses detected`,
        suggestion: 'Consider implementing cache warming or increasing cache TTL',
      });
    }

    return recommendations;
  }

  getSlowRequests(limit = 10) {
    return Array.from(this.profiles.values())
      .filter(p => p.duration > this.slowThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  getRecommendations(limit = 10) {
    return this.recommendations.slice(-limit).reverse();
  }

  getStats() {
    const profiles = Array.from(this.profiles.values());
    const durations = profiles.map(p => p.duration);
    
    return {
      totalProfiles: profiles.length,
      slowRequests: profiles.filter(p => p.duration > this.slowThreshold).length,
      averageDuration: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      p50: this._percentile(durations, 50),
      p95: this._percentile(durations, 95),
      p99: this._percentile(durations, 99),
      recommendations: this.recommendations.length,
    };
  }

  _percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

export default new PerformanceProfiler();
