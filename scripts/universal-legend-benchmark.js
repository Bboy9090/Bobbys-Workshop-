#!/usr/bin/env node

/**
 * Universal Legend Status Performance Benchmarking Suite
 * 
 * Benchmarks all 5 phases of Universal Legend Status:
 * 1. Observability Foundation
 * 2. Universal Compatibility Layer
 * 3. Performance Optimization
 * 4. Reliability Systems
 * 5. Integration & Polish
 * 
 * Run with: node scripts/universal-legend-benchmark.js
 */

import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function formatDuration(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printHeader(text) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ${text}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);
}

function printSection(text) {
  console.log(`\n${colors.bright}${colors.magenta}${'─'.repeat(80)}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}  ${text}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}${'─'.repeat(80)}${colors.reset}\n`);
}

function printResult(name, duration, target, status) {
  const symbol = status === 'PASS' ? '✓' : (status === 'WARN' ? '⚠' : '✗');
  const color = status === 'PASS' ? colors.green : (status === 'WARN' ? colors.yellow : colors.red);
  const targetText = target ? ` (target: ${formatDuration(target)})` : '';
  console.log(`${color}${symbol}${colors.reset} ${name}: ${colors.blue}${formatDuration(duration)}${colors.reset}${targetText}`);
}

async function benchmarkEndpoint(name, endpoint, method = 'GET', body = null, iterations = 10) {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const end = performance.now();
      
      if (response.ok) {
        times.push(end - start);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`${colors.red}✗${colors.reset} ${name}: Error - ${error.message}`);
      return null;
    }
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
  
  return { avg, min, max, p95, times };
}

async function benchmarkConcurrent(name, endpoint, concurrency = 10) {
  const start = performance.now();
  try {
    const requests = Array(concurrency).fill(null).map(() => 
      fetch(`${API_BASE}${endpoint}`)
    );
    await Promise.all(requests);
    const duration = performance.now() - start;
    return { duration, success: true };
  } catch (error) {
    return { duration: null, success: false, error: error.message };
  }
}

async function main() {
  printHeader('🌟 Universal Legend Status - Performance Benchmarking Suite');
  
  const results = {
    phase1: {},
    phase2: {},
    phase3: {},
    phase4: {},
    phase5: {},
  };

  // Phase 1: Observability Foundation
  printSection('Phase 1: Observability Foundation');
  
  console.log('Benchmarking Metrics API...');
  const metricsResult = await benchmarkEndpoint('Metrics API (JSON)', '/api/v1/observability/metrics?format=json');
  if (metricsResult) {
    printResult('Metrics API - Average', metricsResult.avg, 100, metricsResult.avg < 100 ? 'PASS' : 'WARN');
    printResult('Metrics API - P95', metricsResult.p95, 200, metricsResult.p95 < 200 ? 'PASS' : 'WARN');
    results.phase1.metrics = metricsResult;
  }

  const metricsSummaryResult = await benchmarkEndpoint('Metrics Summary', '/api/v1/observability/metrics/summary');
  if (metricsSummaryResult) {
    printResult('Metrics Summary - Average', metricsSummaryResult.avg, 50, metricsSummaryResult.avg < 50 ? 'PASS' : 'WARN');
    results.phase1.metricsSummary = metricsSummaryResult;
  }

  const tracesResult = await benchmarkEndpoint('Traces API', '/api/v1/observability/traces/active');
  if (tracesResult) {
    printResult('Traces API - Average', tracesResult.avg, 50, tracesResult.avg < 50 ? 'PASS' : 'WARN');
    results.phase1.traces = tracesResult;
  }

  // Phase 2: Universal Compatibility Layer
  printSection('Phase 2: Universal Compatibility Layer');
  
  console.log('Benchmarking Platform API...');
  const platformResult = await benchmarkEndpoint('Platform API', '/api/v1/universal/platform');
  if (platformResult) {
    printResult('Platform API - Average', platformResult.avg, 50, platformResult.avg < 50 ? 'PASS' : 'WARN');
    printResult('Platform API - P95', platformResult.p95, 100, platformResult.p95 < 100 ? 'PASS' : 'WARN');
    results.phase2.platform = platformResult;
  }

  const capabilitiesResult = await benchmarkEndpoint('Platform Capabilities', '/api/v1/universal/platform/capabilities');
  if (capabilitiesResult) {
    printResult('Capabilities API - Average', capabilitiesResult.avg, 50, capabilitiesResult.avg < 50 ? 'PASS' : 'WARN');
    results.phase2.capabilities = capabilitiesResult;
  }

  const devicesResult = await benchmarkEndpoint('Universal Devices API', '/api/v1/universal/devices');
  if (devicesResult) {
    printResult('Devices API - Average', devicesResult.avg, 100, devicesResult.avg < 100 ? 'PASS' : 'WARN');
    results.phase2.devices = devicesResult;
  }

  // Phase 3: Performance Optimization
  printSection('Phase 3: Performance Optimization');
  
  console.log('Testing cache performance...');
  // Warm up cache
  await fetch(`${API_BASE}/api/v1/universal/platform`);
  
  const cachedResult = await benchmarkEndpoint('Cached Platform API', '/api/v1/universal/platform', 'GET', null, 20);
  if (cachedResult) {
    printResult('Cached Request - Average', cachedResult.avg, 10, cachedResult.avg < 10 ? 'PASS' : 'WARN');
    printResult('Cached Request - P95', cachedResult.p95, 20, cachedResult.p95 < 20 ? 'PASS' : 'WARN');
    results.phase3.cache = cachedResult;
  }

  console.log('Testing connection pooling...');
  const concurrentResult = await benchmarkConcurrent('Concurrent Requests (10)', '/api/v1/health', 10);
  if (concurrentResult.success) {
    printResult('Concurrent Requests (10)', concurrentResult.duration, 1000, concurrentResult.duration < 1000 ? 'PASS' : 'WARN');
    results.phase3.concurrent = concurrentResult;
  }

  // Phase 4: Reliability Systems
  printSection('Phase 4: Reliability Systems');
  
  console.log('Benchmarking Health Check API...');
  const healthResult = await benchmarkEndpoint('Health Check', '/api/v1/reliability/health');
  if (healthResult) {
    printResult('Health Check - Average', healthResult.avg, 100, healthResult.avg < 100 ? 'PASS' : 'WARN');
    results.phase4.health = healthResult;
  }

  const circuitBreakersResult = await benchmarkEndpoint('Circuit Breakers Status', '/api/v1/reliability/health/circuit-breakers');
  if (circuitBreakersResult) {
    printResult('Circuit Breakers - Average', circuitBreakersResult.avg, 50, circuitBreakersResult.avg < 50 ? 'PASS' : 'WARN');
    results.phase4.circuitBreakers = circuitBreakersResult;
  }

  const recoveryResult = await benchmarkEndpoint('Recovery Statistics', '/api/v1/reliability/health/recovery');
  if (recoveryResult) {
    printResult('Recovery Stats - Average', recoveryResult.avg, 50, recoveryResult.avg < 50 ? 'PASS' : 'WARN');
    results.phase4.recovery = recoveryResult;
  }

  // Phase 5: Integration & Polish
  printSection('Phase 5: Integration & Polish');
  
  console.log('Testing end-to-end performance...');
  const e2eStart = performance.now();
  
  // Simulate a complete workflow
  await fetch(`${API_BASE}/api/v1/universal/platform`);
  await fetch(`${API_BASE}/api/v1/observability/metrics/summary`);
  await fetch(`${API_BASE}/api/v1/reliability/health`);
  
  const e2eDuration = performance.now() - e2eStart;
  printResult('End-to-End Workflow', e2eDuration, 300, e2eDuration < 300 ? 'PASS' : 'WARN');
  results.phase5.e2e = { duration: e2eDuration };

  // Summary
  printSection('🌟 Benchmark Summary');
  
  const allPhases = [
    { name: 'Phase 1: Observability', results: results.phase1 },
    { name: 'Phase 2: Universal Compatibility', results: results.phase2 },
    { name: 'Phase 3: Performance Optimization', results: results.phase3 },
    { name: 'Phase 4: Reliability Systems', results: results.phase4 },
    { name: 'Phase 5: Integration & Polish', results: results.phase5 },
  ];

  let totalTests = 0;
  let passedTests = 0;

  for (const phase of allPhases) {
    console.log(`\n${colors.bright}${phase.name}${colors.reset}`);
    for (const [key, result] of Object.entries(phase.results)) {
      if (result && result.avg !== undefined) {
        totalTests++;
        const passed = result.avg < 100; // Target: sub-100ms
        if (passed) passedTests++;
        const status = passed ? 'PASS' : 'WARN';
        const color = passed ? colors.green : colors.yellow;
        console.log(`  ${color}${status}${colors.reset} ${key}: ${formatDuration(result.avg)}`);
      } else if (result && result.duration !== undefined) {
        totalTests++;
        const passed = result.duration < 1000;
        if (passed) passedTests++;
        const status = passed ? 'PASS' : 'WARN';
        const color = passed ? colors.green : colors.yellow;
        console.log(`  ${color}${status}${colors.reset} ${key}: ${formatDuration(result.duration)}`);
      }
    }
  }

  console.log(`\n${colors.bright}Overall: ${passedTests}/${totalTests} tests passed${colors.reset}`);
  
  // Save results to file
  const resultsFile = path.join(__dirname, '..', 'benchmark-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    summary: {
      totalTests,
      passedTests,
      passRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`
    }
  }, null, 2));
  
  console.log(`\n${colors.cyan}Results saved to: ${resultsFile}${colors.reset}\n`);
  
  if (passedTests === totalTests) {
    console.log(`${colors.bright}${colors.green}🌟 Universal Legend Status: ALL BENCHMARKS PASSED 🌟${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.bright}${colors.yellow}⚠ Universal Legend Status: Some benchmarks need optimization ⚠${colors.reset}\n`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`${colors.red}Error running benchmarks: ${error.message}${colors.reset}`);
  process.exit(1);
});
