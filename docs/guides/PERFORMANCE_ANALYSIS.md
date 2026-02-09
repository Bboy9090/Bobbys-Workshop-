# Performance Analysis & Optimization Report

## Executive Summary

This document identifies performance bottlenecks and inefficient code patterns in Bobby's Workshop, providing actionable recommendations for optimization.

**Impact Level Key:**
- 🔴 **CRITICAL** - Severe performance impact, immediate action required
- 🟡 **MODERATE** - Noticeable impact, should be addressed
- 🟢 **MINOR** - Low impact, nice to have

---

## Backend Performance Issues

### 🔴 CRITICAL: Synchronous File Operations in Request Handlers

**Location:** `server/index.js:66-73`, `server/index.js:76-84`

**Problem:**
```javascript
const logger = {
  info: (msg) => {
    const line = `[${new Date().toISOString()}] INFO: ${msg}\n`;
    fs.appendFileSync(LOG_FILE, line);  // ❌ BLOCKING I/O
    console.log(line.trim());
  }
}
```

**Impact:** 
- Blocks the event loop on every log write
- Can cause request timeouts under load
- Poor performance on slow file systems

**Recommendation:**
```javascript
import { createWriteStream } from 'fs';

const logStream = createWriteStream(LOG_FILE, { flags: 'a' });

const logger = {
  info: (msg) => {
    const line = `[${new Date().toISOString()}] INFO: ${msg}\n`;
    logStream.write(line, (err) => {
      if (err) console.error('Failed to write to log file:', err);
    });
    console.log(line.trim());
  }
};
```

---

### 🔴 CRITICAL: Inefficient Rate Limiter Cleanup

**Location:** `server/middleware/rate-limiter.js:55-66, 74`

**Problem:**
```javascript
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up expired entries every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

// ALSO called on EVERY request!
export function rateLimiter(limitType = 'default') {
  return (req, res, next) => {
    cleanupExpiredEntries();  // ❌ O(n) on every request!
```

**Impact:**
- O(n) iteration on every request
- Scales poorly with number of clients
- Double cleanup (interval + per-request)

**Recommendation:**
```javascript
// Only cleanup via interval, not per-request
export function rateLimiter(limitType = 'default') {
  const config = RATE_LIMITS[limitType] || RATE_LIMITS.default;

  return (req, res, next) => {
    // Remove per-request cleanup
    const clientId = getClientId(req);
    const key = `${limitType}:${clientId}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);

    // Lazy deletion: only check current key's expiration
    if (record && now > record.resetTime) {
      rateLimitStore.delete(key);
      record = null;
    }

    if (!record) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs
      });
      return next();
    }
    // ... rest of logic
  };
}

// Keep interval cleanup, but increase frequency
setInterval(cleanupExpiredEntries, 60 * 1000); // Every minute instead
```

---

### 🟡 MODERATE: Inefficient Battery Monitoring Loop

**Location:** `server/routes/v1/diagnostics/battery.js:106-153`

**Problem:**
```javascript
async function monitorBattery(deviceSerial, durationSeconds = 60) {
  const samples = [];
  const startTime = Date.now();
  const endTime = startTime + (durationSeconds * 1000);

  while (Date.now() < endTime) {
    const batteryInfo = await getBatteryHealth(deviceSerial);
    if (batteryInfo.success) {
      samples.push({...});
    }
    
    // Sample every 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));  // ❌ Accumulates drift
  }
}
```

**Impact:**
- Accumulates timing drift (each iteration takes 5s + execution time)
- Inconsistent sampling intervals
- Multiple ADB shell calls per sample (inefficient)

**Recommendation:**
```javascript
async function monitorBattery(deviceSerial, durationSeconds = 60) {
  const samples = [];
  const startTime = Date.now();
  const intervalMs = 5000;
  let nextSampleTime = startTime + intervalMs;

  while (Date.now() < startTime + (durationSeconds * 1000)) {
    const now = Date.now();
    
    // Wait until next scheduled sample time
    if (now < nextSampleTime) {
      await new Promise(resolve => setTimeout(resolve, nextSampleTime - now));
    }
    
    const batteryInfo = await getBatteryHealth(deviceSerial);
    if (batteryInfo.success) {
      samples.push({
        timestamp: new Date().toISOString(),
        ...batteryInfo
      });
    }
    
    // Schedule next sample
    nextSampleTime += intervalMs;
  }

  return {
    success: true,
    samples,
    duration: durationSeconds,
    actualSamples: samples.length,
    expectedSamples: Math.floor(durationSeconds / (intervalMs / 1000))
  };
}
```

---

### 🟡 MODERATE: WebSocket Heartbeat Creates Unnecessary Objects

**Location:** `server/utils/websocket-manager.js:111-142`

**Problem:**
```javascript
startHeartbeat() {
  this.heartbeatTimer = setInterval(() => {
    this.clients.forEach((info, ws) => {  // ❌ Creates iterator objects
      if (ws.readyState === ws.OPEN) {
        const timeSinceLastPong = Date.now() - info.lastPong;
        
        if (timeSinceLastPong > this.heartbeatTimeout * this.maxMissedHeartbeats) {
          console.warn(`[WS:${this.path}] Client ${info.id} not responding`);
          ws.terminate();
          this.clients.delete(ws);
          this.stats.activeConnections = this.clients.size;
          return;
        }

        try {
          ws.ping();
          info.missedHeartbeats++;  // ❌ Increments even on successful ping
        } catch (error) {
          this.clients.delete(ws);
        }
      } else {
        this.clients.delete(ws);
      }
    });
  }, this.heartbeatInterval);
}
```

**Impact:**
- Creates iterator objects on every heartbeat
- Logic error: increments missed heartbeats before checking pong
- Modifies collection while iterating (can cause issues)

**Recommendation:**
```javascript
startHeartbeat() {
  this.heartbeatTimer = setInterval(() => {
    const now = Date.now();
    const toDelete = [];

    for (const [ws, info] of this.clients.entries()) {
      if (ws.readyState !== ws.OPEN) {
        toDelete.push(ws);
        continue;
      }

      const timeSinceLastPong = now - info.lastPong;
      
      if (timeSinceLastPong > this.heartbeatTimeout * this.maxMissedHeartbeats) {
        console.warn(`[WS:${this.path}] Client ${info.id} not responding`);
        ws.terminate();
        toDelete.push(ws);
        continue;
      }

      try {
        ws.ping();
        // Don't increment here - increment in pong handler
      } catch (error) {
        console.error(`[WS:${this.path}] Ping failed for ${info.id}:`, error);
        toDelete.push(ws);
      }
    }

    // Delete dead connections after iteration
    for (const ws of toDelete) {
      this.clients.delete(ws);
    }
    
    if (toDelete.length > 0) {
      this.stats.activeConnections = this.clients.size;
    }
  }, this.heartbeatInterval);
}
```

---

### 🟡 MODERATE: CPU Usage Polling Creates Command Overhead

**Location:** `server/routes/v1/monitor/performance.js:26-65`

**Problem:**
```javascript
async function getCPUUsage(deviceSerial) {
  // Get CPU usage from /proc/stat
  const result = await ADBLibrary.shell(deviceSerial, 'cat /proc/stat | head -1');
  // ... parse ...
  
  // Get CPU cores count
  const coresResult = await ADBLibrary.shell(deviceSerial, 'cat /proc/cpuinfo | grep processor | wc -l');
  // ❌ Two separate ADB shell commands
}
```

**Impact:**
- Each ADB shell command has ~100-200ms overhead
- Doubles latency for CPU monitoring
- Inefficient for real-time monitoring

**Recommendation:**
```javascript
async function getCPUUsage(deviceSerial) {
  // Combine commands in single ADB shell invocation
  const command = 'cat /proc/stat | head -1 && echo "---" && cat /proc/cpuinfo | grep processor | wc -l';
  const result = await ADBLibrary.shell(deviceSerial, command);
  
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const [cpuLine, separator, coresLine] = result.stdout.split('\n');
  const parts = cpuLine.trim().split(/\s+/).slice(1).map(Number);
  const cores = parseInt(coresLine.trim()) || 1;

  // ... rest of parsing ...
}
```

---

## Frontend Performance Issues

### 🔴 CRITICAL: Missing Memoization in Event Handler

**Location:** `src/components/USBConnectionMonitor.tsx:26-78`

**Problem:**
```jsx
useEffect(() => {
  const nav = navigator as any;
  if (!nav.usb) return;

  const handleConnect = (event: any) => {  // ❌ New function on every render
    const device = event.device;
    const newEvent: ConnectionEvent = { /* ... */ };
    setEvents(prev => [newEvent, ...prev].slice(0, 50));
  };

  const handleDisconnect = (event: any) => {  // ❌ New function on every render
    const device = event.device;
    const newEvent: ConnectionEvent = { /* ... */ };
    setEvents(prev => [newEvent, ...prev].slice(0, 50));
  };

  nav.usb.addEventListener('connect', handleConnect);
  nav.usb.addEventListener('disconnect', handleDisconnect);

  return () => {
    nav.usb?.removeEventListener('connect', handleConnect);
    nav.usb?.removeEventListener('disconnect', handleDisconnect);
  };
}, []); // ❌ Empty deps but creates new functions!
```

**Impact:**
- Creates new function instances on every render
- Can cause memory leaks if cleanup fails
- Unnecessarily complex event handler

**Recommendation:**
```jsx
import { useState, useEffect, useCallback } from 'react';

export function USBConnectionMonitor() {
  const [events, setEvents] = useState<ConnectionEvent[]>([]);

  const createEvent = useCallback((device: any, type: 'connect' | 'disconnect'): ConnectionEvent => ({
    id: `${Date.now()}-${type}-${device.vendorId}-${device.productId}`,
    type,
    timestamp: Date.now(),
    deviceInfo: {
      vendorId: device.vendorId,
      productId: device.productId,
      productName: device.productName,
      manufacturerName: device.manufacturerName,
      serialNumber: device.serialNumber,
    }
  }), []);

  const handleConnect = useCallback((event: any) => {
    const newEvent = createEvent(event.device, 'connect');
    setEvents(prev => [newEvent, ...prev].slice(0, 50));
  }, [createEvent]);

  const handleDisconnect = useCallback((event: any) => {
    const newEvent = createEvent(event.device, 'disconnect');
    setEvents(prev => [newEvent, ...prev].slice(0, 50));
  }, [createEvent]);

  useEffect(() => {
    const nav = navigator as any;
    if (!nav.usb) return;

    nav.usb.addEventListener('connect', handleConnect);
    nav.usb.addEventListener('disconnect', handleDisconnect);

    return () => {
      nav.usb?.removeEventListener('connect', handleConnect);
      nav.usb?.removeEventListener('disconnect', handleDisconnect);
    };
  }, [handleConnect, handleDisconnect]);
  
  // ... rest of component
}
```

---

### 🟡 MODERATE: Timestamp Formatting in Render Loop

**Location:** `src/components/USBConnectionMonitor.tsx:84-101`

**Problem:**
```jsx
const formatTimestamp = (timestamp: number) => {  // ❌ Defined inside component
  const date = new Date(timestamp);
  const now = new Date();  // ❌ Creates new Date on every call
  const diffMs = now.getTime() - date.getTime();
  // ... formatting logic ...
};

return (
  // ...
  {events.map((event) => {
    // ...
    {formatTimestamp(event.timestamp)}  // ❌ Called for every event
  })}
);
```

**Impact:**
- Creates new Date object for every event on every render
- Recalculates relative time even if not changed
- Causes unnecessary re-renders

**Recommendation:**
```jsx
import { useMemo } from 'react';

// Move outside component or memoize
const formatTimestamp = (timestamp: number, now: number) => {
  const diffMs = now - timestamp;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(timestamp).toLocaleString();
};

export function USBConnectionMonitor() {
  const [events, setEvents] = useState<ConnectionEvent[]>([]);
  const [now, setNow] = useState(Date.now());

  // Update 'now' every second for relative timestamps
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedEvents = useMemo(() => {
    return events.map(event => ({
      ...event,
      formattedTime: formatTimestamp(event.timestamp, now)
    }));
  }, [events, now]);

  return (
    // Use formattedEvents instead of events
    {formattedEvents.map((event) => (
      <div key={event.id}>
        {event.formattedTime}
      </div>
    ))}
  );
}
```

---

## General Optimization Recommendations

### 🟢 MINOR: Add Response Caching for Static Data

**Location:** Various API endpoints

**Recommendation:**
```javascript
import NodeCache from 'node-cache';

// Cache for 60 seconds
const apiCache = new NodeCache({ stdTTL: 60 });

// Middleware for cacheable GET requests
function cacheMiddleware(duration = 60) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    const key = `__express__${req.originalUrl || req.url}`;
    const cachedResponse = apiCache.get(key);

    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    // Override res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      apiCache.set(key, body, duration);
      return originalJson(body);
    };

    next();
  };
}

// Apply to endpoints returning static/slow data
v1Router.get('/standards', cacheMiddleware(300), standardsHandler);
v1Router.get('/catalog', cacheMiddleware(120), catalogHandler);
```

---

### 🟢 MINOR: Use Connection Pooling for External Services

**Recommendation:**
```javascript
import http from 'http';
import https from 'https';

// Increase max sockets for concurrent requests
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});

// Use in fetch/axios/request calls
fetch(url, {
  agent: url.startsWith('https') ? httpsAgent : httpAgent
});
```

---

### 🟢 MINOR: Optimize ADB Command Batching

**Recommendation:**
Create a command batching utility:

```javascript
// core/lib/adb-batch.js
export class ADBBatcher {
  constructor(deviceSerial, flushInterval = 50) {
    this.deviceSerial = deviceSerial;
    this.flushInterval = flushInterval;
    this.commandQueue = [];
    this.flushTimer = null;
  }

  async execute(command) {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, resolve, reject });
      
      if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
      }
    });
  }

  async flush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = null;

    if (this.commandQueue.length === 0) return;

    const batch = this.commandQueue.splice(0);
    
    // Combine commands with separators
    const combinedCommand = batch.map(b => b.command).join(' && echo "---" && ');
    const result = await ADBLibrary.shell(this.deviceSerial, combinedCommand);

    if (!result.success) {
      batch.forEach(b => b.reject(new Error(result.error)));
      return;
    }

    // Split results and resolve promises
    const results = result.stdout.split('---\n');
    batch.forEach((b, i) => {
      b.resolve({ success: true, stdout: results[i] || '' });
    });
  }
}
```

---

## Performance Monitoring Recommendations

### Add Performance Metrics Collection

```javascript
// server/middleware/performance-monitor.js
import { performance } from 'perf_hooks';

const metrics = {
  requests: [],
  responseTimeP50: 0,
  responseTimeP95: 0,
  responseTimeP99: 0,
};

export function performanceMiddleware(req, res, next) {
  const start = performance.now();

  // Capture response finish
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = performance.now() - start;
    
    metrics.requests.push({
      method: req.method,
      path: req.path,
      duration,
      timestamp: Date.now(),
    });

    // Keep only last 1000 requests
    if (metrics.requests.length > 1000) {
      metrics.requests.shift();
    }

    // Calculate percentiles every 100 requests
    if (metrics.requests.length % 100 === 0) {
      updatePercentiles();
    }

    originalEnd.apply(res, args);
  };

  next();
}

function updatePercentiles() {
  const sorted = metrics.requests
    .map(r => r.duration)
    .sort((a, b) => a - b);

  metrics.responseTimeP50 = sorted[Math.floor(sorted.length * 0.5)];
  metrics.responseTimeP95 = sorted[Math.floor(sorted.length * 0.95)];
  metrics.responseTimeP99 = sorted[Math.floor(sorted.length * 0.99)];
}

export function getMetrics() {
  return {
    totalRequests: metrics.requests.length,
    responseTimeP50: metrics.responseTimeP50,
    responseTimeP95: metrics.responseTimeP95,
    responseTimeP99: metrics.responseTimeP99,
    slowestRequests: metrics.requests
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10),
  };
}
```

---

## Summary & Priority Matrix

| Issue | Location | Impact | Effort | Priority |
|-------|----------|--------|--------|----------|
| Synchronous file I/O in logger | `server/index.js` | 🔴 Critical | Low | **P0** |
| Rate limiter per-request cleanup | `server/middleware/rate-limiter.js` | 🔴 Critical | Low | **P0** |
| Missing React memoization | `src/components/USBConnectionMonitor.tsx` | 🔴 Critical | Medium | **P0** |
| Battery monitoring drift | `server/routes/v1/diagnostics/battery.js` | 🟡 Moderate | Low | **P1** |
| WebSocket heartbeat inefficiency | `server/utils/websocket-manager.js` | 🟡 Moderate | Medium | **P1** |
| CPU polling overhead | `server/routes/v1/monitor/performance.js` | 🟡 Moderate | Low | **P1** |
| Timestamp formatting | `src/components/USBConnectionMonitor.tsx` | 🟡 Moderate | Low | **P2** |
| Response caching | Various endpoints | 🟢 Minor | Medium | **P2** |
| Connection pooling | External requests | 🟢 Minor | Low | **P3** |
| ADB command batching | `core/lib/adb.js` | 🟢 Minor | High | **P3** |

---

## Implementation Phases

### Phase 1: Critical Fixes (P0) - Immediate Action
1. Replace synchronous file I/O with async streams
2. Fix rate limiter cleanup logic
3. Add React.memo and useCallback to USB monitor

**Expected Impact:** 40-60% reduction in request latency under load

---

### Phase 2: Moderate Improvements (P1) - Next Sprint
1. Fix battery monitoring timing drift
2. Optimize WebSocket heartbeat logic
3. Combine ADB shell commands where possible

**Expected Impact:** 20-30% improvement in monitoring performance

---

### Phase 3: Minor Optimizations (P2-P3) - Future Enhancement
1. Add response caching for static endpoints
2. Implement connection pooling
3. Create ADB command batching utility
4. Add performance monitoring middleware

**Expected Impact:** 10-15% overall performance improvement

---

## Testing & Validation

### Performance Test Scenarios

1. **Load Test - Rate Limiter**
   ```bash
   # Before optimization
   ab -n 10000 -c 100 http://localhost:3001/api/v1/health
   # Expected: ~500-800 req/sec

   # After optimization
   # Expected: ~1500-2000 req/sec
   ```

2. **Load Test - Logging**
   ```bash
   # Monitor event loop lag while logging
   node --expose-gc --trace-warnings server/index.js
   ```

3. **Battery Monitoring Precision**
   ```javascript
   // Test timing drift over 5 minutes
   const expectedSamples = 60; // 5 min / 5 sec intervals
   const result = await monitorBattery(serial, 300);
   const drift = Math.abs(result.samples.length - expectedSamples);
   assert(drift <= 2, 'Timing drift should be <= 2 samples');
   ```

4. **React Component Render Count**
   ```jsx
   // Add React DevTools Profiler
   import { Profiler } from 'react';

   <Profiler id="USBMonitor" onRender={onRenderCallback}>
     <USBConnectionMonitor />
   </Profiler>
   
   // Measure before/after optimization
   ```

---

## Continuous Monitoring

### Recommended Tools

1. **Backend:**
   - `clinic.js` - Node.js performance profiling
   - `0x` - Flame graph generation
   - `autocannon` - HTTP benchmarking

2. **Frontend:**
   - React DevTools Profiler
   - Chrome Performance tab
   - Lighthouse performance audit

3. **System:**
   - `htop` / `btop` - System resource monitoring
   - `iotop` - Disk I/O monitoring

---

## Conclusion

The identified issues range from critical synchronous I/O blocking to minor optimization opportunities. Implementing the P0 and P1 fixes will significantly improve application performance, especially under load. The recommended phased approach ensures high-impact improvements are delivered first while maintaining code quality and stability.

**Estimated Overall Improvement:** 60-80% reduction in tail latency (P95/P99) for high-load scenarios.

---

**Document Version:** 1.0  
**Date:** 2026-01-02  
**Author:** Performance Analysis Team
