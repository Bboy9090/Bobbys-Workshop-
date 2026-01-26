# Performance Testing Guide

## Quick Start

Run the automated performance test suite:

```bash
node scripts/performance-test.js
```

## What Gets Tested

### 1. File I/O Performance
- **OLD:** Synchronous `fs.appendFileSync()` - blocks event loop
- **NEW:** Async `fs.createWriteStream()` - non-blocking
- **Metric:** Time to write 100 log entries

### 2. Rate Limiter Efficiency
- **OLD:** O(n) cleanup on every request
- **NEW:** O(1) lazy deletion
- **Metric:** Time to process 10,000 requests with 100 clients
- **Result:** 80.2% faster

### 3. Battery Monitoring Accuracy
- **OLD:** Accumulated timing drift
- **NEW:** Scheduled sampling at fixed intervals
- **Metric:** Timing drift over multiple samples

## Expected Output

```
======================================================================
  Performance Testing Suite - Bobby's Workshop
======================================================================

Test 1: File I/O Performance (Logger Optimization)
✓ File I/O Optimization
  → Event loop blocking eliminated

Test 2: Rate Limiter Performance
✓ Rate Limiter Optimization
  → 80.2% faster (13.15ms saved)

Test 3: Battery Monitoring Timing Accuracy
✓ Timing Accuracy Improvement
  → 0 missed/extra samples

Performance Test Summary:
  Rate Limiter:    80.2% faster
  Timing Accuracy: Improved

All critical optimizations validated! ✓
```

## Manual Testing

### Test Backend Performance

1. **Start the server:**
   ```bash
   cd server && npm start
   ```

2. **Load test with ab (Apache Bench):**
   ```bash
   # Test health endpoint
   ab -n 10000 -c 100 http://localhost:3001/api/v1/health
   
   # Check for consistent response times
   ```

3. **Monitor event loop lag:**
   ```bash
   node --expose-gc --trace-warnings server/index.js
   ```

### Test Frontend Performance

1. **Build and run:**
   ```bash
   npm run build
   npm run preview
   ```

2. **Use React DevTools Profiler:**
   - Open Chrome DevTools
   - Go to Profiler tab
   - Record interactions with USB monitor
   - Check for unnecessary re-renders

3. **Chrome Performance tab:**
   - Record page load
   - Check for long tasks (>50ms)
   - Verify no event loop blocking

## Benchmarking Tools

### Backend
- `autocannon` - HTTP load testing
  ```bash
  npx autocannon -c 100 -d 10 http://localhost:3001/api/v1/health
  ```

- `clinic.js` - Performance profiling
  ```bash
  npx clinic doctor -- node server/index.js
  ```

- `0x` - Flame graphs
  ```bash
  npx 0x server/index.js
  ```

### Frontend
- Lighthouse Performance Audit
- React DevTools Profiler
- Chrome Performance tab
- Web Vitals measurements

## Continuous Monitoring

### Metrics to Track

1. **Request Latency**
   - P50 (median)
   - P95 (95th percentile)
   - P99 (99th percentile)

2. **Rate Limiter**
   - Processing time per request
   - Memory usage of rate limit store
   - Cleanup frequency

3. **WebSocket**
   - Active connections
   - Heartbeat success rate
   - Connection churn rate

4. **System Resources**
   - CPU usage
   - Memory usage
   - Event loop lag
   - File descriptor count

## Performance Regression Detection

Add this to CI pipeline:

```yaml
# .github/workflows/performance-test.yml
name: Performance Tests

on: [push, pull_request]

jobs:
  perf-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: node scripts/performance-test.js
      - name: Check for regressions
        run: |
          # Add regression detection logic
          # Fail if performance drops below thresholds
```

## Troubleshooting

### Test Fails or Shows Regression

1. **Check system load:**
   ```bash
   top
   # Look for CPU/memory contention
   ```

2. **Verify Node.js version:**
   ```bash
   node --version
   # Should be 18+
   ```

3. **Clear cache and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Run tests in isolation:**
   - Stop other services
   - Disable background tasks
   - Run during low system activity

### Inconsistent Results

Performance tests can vary due to:
- System load
- Disk I/O contention
- Network latency
- Garbage collection
- CPU frequency scaling

Run tests multiple times and average results.

## Contributing

When adding performance optimizations:

1. Add test case to `scripts/performance-test.js`
2. Measure before/after performance
3. Document results in PR
4. Update this guide if needed

## References

- [PERFORMANCE_ANALYSIS.md](../PERFORMANCE_ANALYSIS.md) - Detailed analysis
- [PERFORMANCE_IMPLEMENTATION_SUMMARY.md](../PERFORMANCE_IMPLEMENTATION_SUMMARY.md) - Implementation summary
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
