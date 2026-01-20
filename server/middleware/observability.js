/**
 * Universal Legend Status - Observability Middleware
 * Middleware for automatic metrics collection, logging, and tracing
 */

import metricsCollector from '../utils/observability/metrics-collector.js';
import structuredLogger from '../utils/observability/structured-logger.js';
import tracer from '../utils/observability/tracing.js';

/**
 * Observability middleware - collects metrics, logs, and traces
 */
export function observabilityMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Get or create correlation ID
  const correlationId = req.correlationId || req.headers['x-correlation-id'] || 
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.correlationId = correlationId;
  
  // Get trace context from headers or create new
  let traceContext = tracer.fromHeaders(req.headers);
  if (!traceContext) {
    traceContext = tracer.startTrace(`${req.method} ${req.path}`);
  }
  req.traceContext = traceContext;
  
  // Set trace headers in response
  res.set(tracer.toHeaders(traceContext));
  
  // Log request start
  structuredLogger.info('HTTP Request Started', {
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent')
  }, correlationId);
  
  // Increment active requests
  metricsCollector.incrementCounter('http_requests_total', {
    method: req.method,
    route: req.route?.path || req.path,
    status: 'pending'
  });
  metricsCollector.setGauge('http_requests_active', {}, 1);
  
  // Override res.end to capture response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Finish trace
    tracer.finishSpan(traceContext, statusCode < 400 ? 'success' : 'error');
    
    // Update metrics
    metricsCollector.incrementCounter('http_requests_total', {
      method: req.method,
      route: req.route?.path || req.path,
      status: statusCode
    });
    metricsCollector.setGauge('http_requests_active', {}, -1);
    metricsCollector.observeHistogram('http_request_duration_seconds', {
      method: req.method,
      route: req.route?.path || req.path,
      status: statusCode
    }, duration / 1000);
    
    // Log request completion
    structuredLogger.logRequest(req, res, duration, correlationId);
    
    // Call original end
    originalEnd(chunk, encoding);
  };
  
  next();
}

/**
 * Operation tracing middleware
 */
export function operationTracingMiddleware(operationName) {
  return (req, res, next) => {
    const traceContext = req.traceContext || tracer.startTrace(operationName);
    const operationSpan = tracer.startSpan(operationName, traceContext);
    
    req.operationSpan = operationSpan;
    
    // Override res.json to finish span
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      const status = res.statusCode < 400 ? 'success' : 'error';
      tracer.finishSpan(operationSpan, status);
      return originalJson(data);
    };
    
    next();
  };
}

export default observabilityMiddleware;
