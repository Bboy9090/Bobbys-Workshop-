/**
 * Universal Legend Status - Distributed Tracing
 * Enterprise-grade distributed tracing for end-to-end operation tracking
 * 
 * Features:
 * - Trace context propagation
 * - Span creation and management
 * - Parent-child span relationships
 * - Timing and duration tracking
 * - Metadata and tags
 */

class TraceContext {
  constructor(traceId, spanId, parentSpanId = null) {
    this.traceId = traceId;
    this.spanId = spanId;
    this.parentSpanId = parentSpanId;
    this.startTime = Date.now();
    this.tags = {};
    this.events = [];
    this.status = 'started';
  }

  addTag(key, value) {
    this.tags[key] = value;
  }

  addEvent(name, attributes = {}) {
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
  }

  finish(status = 'success', error = null) {
    this.status = status;
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    
    if (error) {
      this.addTag('error', true);
      this.addTag('error.message', error.message);
      this.addTag('error.type', error.name);
    }
  }

  toJSON() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      status: this.status,
      tags: this.tags,
      events: this.events
    };
  }
}

class Tracer {
  constructor() {
    this.activeTraces = new Map();
    this.completedTraces = new Map();
    this.maxTraces = 1000; // Keep last 1000 traces
  }

  /**
   * Generate trace ID
   */
  generateTraceId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate span ID
   */
  generateSpanId() {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Start a new trace
   */
  startTrace(name, parentContext = null) {
    const traceId = parentContext?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    const parentSpanId = parentContext?.spanId || null;

    const context = new TraceContext(traceId, spanId, parentSpanId);
    context.addTag('operation.name', name);
    context.addTag('operation.start', new Date().toISOString());

    this.activeTraces.set(spanId, context);

    return context;
  }

  /**
   * Start a child span
   */
  startSpan(name, parentContext) {
    if (!parentContext) {
      return this.startTrace(name);
    }

    const spanId = this.generateSpanId();
    const context = new TraceContext(parentContext.traceId, spanId, parentContext.spanId);
    context.addTag('operation.name', name);
    context.addTag('operation.start', new Date().toISOString());

    this.activeTraces.set(spanId, context);

    return context;
  }

  /**
   * Finish a span
   */
  finishSpan(context, status = 'success', error = null) {
    if (!context) return;

    context.finish(status, error);

    // Move to completed traces
    this.activeTraces.delete(context.spanId);
    
    // Store completed trace
    if (!this.completedTraces.has(context.traceId)) {
      this.completedTraces.set(context.traceId, []);
    }
    this.completedTraces.get(context.traceId).push(context);

    // Cleanup old traces
    if (this.completedTraces.size > this.maxTraces) {
      const oldestTraceId = Array.from(this.completedTraces.keys())[0];
      this.completedTraces.delete(oldestTraceId);
    }
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId) {
    return this.completedTraces.get(traceId) || [];
  }

  /**
   * Get all active traces
   */
  getActiveTraces() {
    return Array.from(this.activeTraces.values()).map(ctx => ctx.toJSON());
  }

  /**
   * Get trace context from headers (for HTTP propagation)
   */
  fromHeaders(headers) {
    const traceId = headers['x-trace-id'];
    const spanId = headers['x-span-id'];
    const parentSpanId = headers['x-parent-span-id'];

    if (traceId && spanId) {
      return new TraceContext(traceId, spanId, parentSpanId || null);
    }

    return null;
  }

  /**
   * Convert trace context to headers (for HTTP propagation)
   */
  toHeaders(context) {
    return {
      'x-trace-id': context.traceId,
      'x-span-id': context.spanId,
      'x-parent-span-id': context.parentSpanId || ''
    };
  }

  /**
   * Get trace summary
   */
  getSummary() {
    return {
      active_traces: this.activeTraces.size,
      completed_traces: this.completedTraces.size,
      total_spans: Array.from(this.completedTraces.values()).reduce((sum, spans) => sum + spans.length, 0)
    };
  }
}

// Singleton instance
const tracer = new Tracer();

export default tracer;
export { TraceContext };
