/**
 * 🏆 Production-Grade Performance Monitoring for Infinite Legendary Features
 */

class InfinitePerformanceMonitor {
  constructor() {
    this.metrics = {
      operations: new Map(),
      performance: {
        quantum: { count: 0, totalTime: 0, avgTime: 0, minTime: Infinity, maxTime: 0 },
        forecast: { count: 0, totalTime: 0, avgTime: 0, minTime: Infinity, maxTime: 0 },
        swarm: { count: 0, totalTime: 0, avgTime: 0, minTime: Infinity, maxTime: 0 },
        causal: { count: 0, totalTime: 0, avgTime: 0, minTime: Infinity, maxTime: 0 },
        consciousness: { count: 0, totalTime: 0, avgTime: 0, minTime: Infinity, maxTime: 0 },
        replicate: { count: 0, totalTime: 0, avgTime: 0, minTime: Infinity, maxTime: 0 },
        neuromorphic: { count: 0, totalTime: 0, avgTime: 0, minTime: Infinity, maxTime: 0 },
        simulation: { count: 0, totalTime: 0, avgTime: 0, minTime: Infinity, maxTime: 0 },
        multiOptimize: { count: 0, totalTime: 0, avgTime: 0, minTime: Infinity, maxTime: 0 },
        blockchain: { count: 0, totalTime: 0, avgTime: 0, minTime: Infinity, maxTime: 0 },
      },
      errors: {
        total: 0,
        byType: {},
        byFeature: {},
      },
      throughput: {
        requestsPerSecond: 0,
        peakRequestsPerSecond: 0,
      },
    };
    
    this.requestTimestamps = [];
    this.windowSize = 60000; // 1 minute window
  }

  // Record operation performance
  recordOperation(feature, operation, duration, success = true) {
    const perf = this.metrics.performance[feature];
    if (!perf) return;

    perf.count++;
    perf.totalTime += duration;
    perf.avgTime = perf.totalTime / perf.count;
    perf.minTime = Math.min(perf.minTime, duration);
    perf.maxTime = Math.max(perf.maxTime, duration);

    // Track request rate
    const now = Date.now();
    this.requestTimestamps.push(now);
    
    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      ts => now - ts < this.windowSize
    );

    // Calculate throughput
    this.metrics.throughput.requestsPerSecond = 
      this.requestTimestamps.length / (this.windowSize / 1000);
    this.metrics.throughput.peakRequestsPerSecond = Math.max(
      this.metrics.throughput.peakRequestsPerSecond,
      this.metrics.throughput.requestsPerSecond
    );

    // Track errors
    if (!success) {
      this.metrics.errors.total++;
      this.metrics.errors.byFeature[feature] = 
        (this.metrics.errors.byFeature[feature] || 0) + 1;
    }
  }

  // Get performance metrics
  getPerformanceMetrics(feature = null) {
    if (feature) {
      return {
        feature,
        ...this.metrics.performance[feature],
      };
    }

    return {
      performance: { ...this.metrics.performance },
      errors: { ...this.metrics.errors },
      throughput: { ...this.metrics.throughput },
    };
  }

  // Get slow operations
  getSlowOperations(threshold = 1000) {
    const slow = [];
    
    for (const [feature, perf] of Object.entries(this.metrics.performance)) {
      if (perf.avgTime > threshold) {
        slow.push({
          feature,
          avgTime: perf.avgTime,
          count: perf.count,
        });
      }
    }

    return slow.sort((a, b) => b.avgTime - a.avgTime);
  }

  // Reset metrics
  resetMetrics() {
    for (const feature of Object.keys(this.metrics.performance)) {
      this.metrics.performance[feature] = {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
      };
    }
    
    this.metrics.errors = {
      total: 0,
      byType: {},
      byFeature: {},
    };
    
    this.requestTimestamps = [];
  }
}

export default new InfinitePerformanceMonitor();
