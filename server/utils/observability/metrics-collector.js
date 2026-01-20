/**
 * Universal Legend Status - Metrics Collector
 * Enterprise-grade metrics collection with Prometheus-compatible format
 * 
 * Features:
 * - Real-time metrics collection
 * - Counter, Gauge, Histogram support
 * - Prometheus-compatible export
 * - In-memory storage with optional persistence
 */

class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
    this.initialized = false;
  }

  /**
   * Initialize metrics collector
   */
  initialize() {
    if (this.initialized) return;
    
    // System metrics
    this.registerCounter('http_requests_total', 'Total HTTP requests', ['method', 'route', 'status']);
    this.registerCounter('operations_total', 'Total operations executed', ['operation', 'status']);
    this.registerCounter('device_connections_total', 'Total device connections', ['type', 'status']);
    this.registerCounter('errors_total', 'Total errors', ['type', 'severity']);
    
    this.registerGauge('http_requests_active', 'Active HTTP requests');
    this.registerGauge('operations_active', 'Active operations');
    this.registerGauge('devices_connected', 'Connected devices');
    this.registerGauge('system_memory_usage_bytes', 'System memory usage in bytes');
    this.registerGauge('system_cpu_usage_percent', 'System CPU usage percentage');
    
    this.registerHistogram('http_request_duration_seconds', 'HTTP request duration', [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]);
    this.registerHistogram('operation_duration_seconds', 'Operation duration', [0.01, 0.1, 0.5, 1, 5, 10, 30, 60]);
    this.registerHistogram('device_response_time_seconds', 'Device response time', [0.01, 0.1, 0.5, 1, 2, 5]);
    
    // Start periodic system metrics collection
    this.startSystemMetricsCollection();
    
    this.initialized = true;
  }

  /**
   * Register a counter metric
   */
  registerCounter(name, help, labels = []) {
    this.metrics.set(name, {
      type: 'counter',
      name,
      help,
      labels,
      values: new Map(),
      createdAt: Date.now()
    });
  }

  /**
   * Register a gauge metric
   */
  registerGauge(name, help, labels = []) {
    this.metrics.set(name, {
      type: 'gauge',
      name,
      help,
      labels,
      values: new Map(),
      createdAt: Date.now()
    });
  }

  /**
   * Register a histogram metric
   */
  registerHistogram(name, help, buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
    this.metrics.set(name, {
      type: 'histogram',
      name,
      help,
      buckets,
      values: new Map(),
      createdAt: Date.now()
    });
  }

  /**
   * Increment a counter
   */
  incrementCounter(name, labels = {}, value = 1) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') {
      console.warn(`[Metrics] Counter ${name} not found`);
      return;
    }

    const labelKey = this.getLabelKey(labels);
    const current = metric.values.get(labelKey) || { labels, value: 0 };
    current.value += value;
    metric.values.set(labelKey, current);
  }

  /**
   * Set a gauge value
   */
  setGauge(name, labels = {}, value) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') {
      console.warn(`[Metrics] Gauge ${name} not found`);
      return;
    }

    const labelKey = this.getLabelKey(labels);
    metric.values.set(labelKey, { labels, value, timestamp: Date.now() });
  }

  /**
   * Observe a histogram value
   */
  observeHistogram(name, labels = {}, value) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') {
      console.warn(`[Metrics] Histogram ${name} not found`);
      return;
    }

    const labelKey = this.getLabelKey(labels);
    const current = metric.values.get(labelKey) || { labels, buckets: new Map(), sum: 0, count: 0 };
    
    // Update buckets
    for (const bucket of metric.buckets) {
      if (value <= bucket) {
        const bucketKey = `le="${bucket}"`;
        current.buckets.set(bucketKey, (current.buckets.get(bucketKey) || 0) + 1);
      }
    }
    // Add to +Inf bucket
    current.buckets.set('le="+Inf"', (current.buckets.get('le="+Inf"') || 0) + 1);
    
    current.sum += value;
    current.count += 1;
    metric.values.set(labelKey, current);
  }

  /**
   * Get label key for metric storage
   */
  getLabelKey(labels) {
    if (Object.keys(labels).length === 0) return '{}';
    return JSON.stringify(labels);
  }

  /**
   * Start periodic system metrics collection
   */
  startSystemMetricsCollection() {
    setInterval(() => {
      try {
        // Memory usage
        const memUsage = process.memoryUsage();
        this.setGauge('system_memory_usage_bytes', { type: 'heap_used' }, memUsage.heapUsed);
        this.setGauge('system_memory_usage_bytes', { type: 'heap_total' }, memUsage.heapTotal);
        this.setGauge('system_memory_usage_bytes', { type: 'external' }, memUsage.external);
        this.setGauge('system_memory_usage_bytes', { type: 'rss' }, memUsage.rss);

        // CPU usage (simplified - Node.js doesn't have built-in CPU usage)
        // This would need os-utils or similar for real CPU metrics
      } catch (error) {
        console.error('[Metrics] Error collecting system metrics:', error);
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Get all metrics in Prometheus format
   */
  getPrometheusFormat() {
    const lines = [];
    
    for (const [name, metric] of this.metrics.entries()) {
      // Add help comment
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} ${metric.type}`);
      
      // Add metric values
      for (const [labelKey, data] of metric.values.entries()) {
        if (metric.type === 'counter' || metric.type === 'gauge') {
          const labels = this.formatLabels(data.labels);
          lines.push(`${name}${labels} ${data.value}`);
        } else if (metric.type === 'histogram') {
          const labels = this.formatLabels(data.labels);
          // Add bucket values
          for (const [bucket, count] of data.buckets.entries()) {
            lines.push(`${name}_bucket${labels},${bucket} ${count}`);
          }
          lines.push(`${name}_sum${labels} ${data.sum}`);
          lines.push(`${name}_count${labels} ${data.count}`);
        }
      }
      
      lines.push(''); // Empty line between metrics
    }
    
    return lines.join('\n');
  }

  /**
   * Format labels for Prometheus
   */
  formatLabels(labels) {
    if (!labels || Object.keys(labels).length === 0) return '';
    const parts = Object.entries(labels).map(([k, v]) => `${k}="${String(v)}"`);
    return `{${parts.join(',')}}`;
  }

  /**
   * Get metrics as JSON (for API responses)
   */
  getMetricsJSON() {
    const result = {
      timestamp: new Date().toISOString(),
      uptime_seconds: (Date.now() - this.startTime) / 1000,
      metrics: {}
    };

    for (const [name, metric] of this.metrics.entries()) {
      result.metrics[name] = {
        type: metric.type,
        help: metric.help,
        values: Array.from(metric.values.values())
      };
    }

    return result;
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      uptime_seconds: (Date.now() - this.startTime) / 1000,
      total_metrics: this.metrics.size,
      counters: 0,
      gauges: 0,
      histograms: 0,
      total_data_points: 0
    };

    for (const metric of this.metrics.values()) {
      summary[`${metric.type}s`]++;
      summary.total_data_points += metric.values.size;
    }

    return summary;
  }

  /**
   * Reset all metrics (use with caution)
   */
  reset() {
    for (const metric of this.metrics.values()) {
      metric.values.clear();
    }
    this.startTime = Date.now();
  }
}

// Singleton instance
const metricsCollector = new MetricsCollector();
metricsCollector.initialize();

export default metricsCollector;
