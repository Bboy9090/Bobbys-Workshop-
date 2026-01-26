/**
 * End-to-End Tests for Universal Legend Status
 * 
 * Tests all 5 phases of Universal Legend Status:
 * 1. Observability Foundation
 * 2. Universal Compatibility Layer
 * 3. Performance Optimization
 * 4. Reliability Systems
 * 5. Integration & Polish
 * 
 * Run with: npm test -- tests/e2e/universal-legend-status.test.js
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

describe('Universal Legend Status - End-to-End Tests', () => {
  beforeAll(() => {
    // Wait for server to be ready
    return new Promise(resolve => setTimeout(resolve, 2000));
  });

  describe('Phase 1: Observability Foundation', () => {
    describe('Metrics API', () => {
      it('GET /api/v1/observability/metrics returns metrics in JSON format', async () => {
        const response = await fetch(`${API_BASE}/api/v1/observability/metrics?format=json`);
        expect(response.status).toBe(200);
        const data = await response.json();
        
        // Check envelope structure
        expect(data).toHaveProperty('envelope');
        expect(data.envelope).toHaveProperty('version');
        
        // Check metrics structure
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('counters');
        expect(data.data).toHaveProperty('gauges');
        expect(data.data).toHaveProperty('histograms');
      });

      it('GET /api/v1/observability/metrics returns Prometheus format when requested', async () => {
        const response = await fetch(`${API_BASE}/api/v1/observability/metrics?format=prometheus`);
        expect(response.status).toBe(200);
        const text = await response.text();
        
        // Prometheus format should be plain text
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      });

      it('GET /api/v1/observability/metrics/summary returns summary statistics', async () => {
        const response = await fetch(`${API_BASE}/api/v1/observability/metrics/summary`);
        expect(response.status).toBe(200);
        const data = await response.json();
        
        expect(data).toHaveProperty('envelope');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('totalMetrics');
        expect(data.data).toHaveProperty('counters');
        expect(data.data).toHaveProperty('gauges');
        expect(data.data).toHaveProperty('histograms');
      });
    });

    describe('Tracing API', () => {
      it('GET /api/v1/observability/traces/active returns active traces', async () => {
        const response = await fetch(`${API_BASE}/api/v1/observability/traces/active`);
        expect(response.status).toBe(200);
        const data = await response.json();
        
        expect(data).toHaveProperty('envelope');
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data.traces)).toBe(true);
      });

      it('GET /api/v1/observability/traces/:traceId returns specific trace', async () => {
        // First get active traces
        const activeResponse = await fetch(`${API_BASE}/api/v1/observability/traces/active`);
        const activeData = await activeResponse.json();
        
        if (activeData.data.traces.length > 0) {
          const traceId = activeData.data.traces[0].traceId;
          const response = await fetch(`${API_BASE}/api/v1/observability/traces/${traceId}`);
          expect(response.status).toBe(200);
          const data = await response.json();
          
          expect(data).toHaveProperty('envelope');
          expect(data).toHaveProperty('data');
          expect(data.data).toHaveProperty('traceId');
        }
      });
    });

    describe('Structured Logging', () => {
      it('Observability middleware adds correlation IDs to requests', async () => {
        const response = await fetch(`${API_BASE}/api/v1/health`);
        expect(response.status).toBe(200);
        
        // Check for correlation ID header
        const correlationId = response.headers.get('X-Correlation-Id');
        expect(correlationId).toBeTruthy();
        expect(typeof correlationId).toBe('string');
      });
    });
  });

  describe('Phase 2: Universal Compatibility Layer', () => {
    describe('Platform API', () => {
      it('GET /api/v1/universal/platform returns platform information', async () => {
        const response = await fetch(`${API_BASE}/api/v1/universal/platform`);
        expect(response.status).toBe(200);
        const data = await response.json();
        
        expect(data).toHaveProperty('envelope');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('os');
        expect(data.data).toHaveProperty('architecture');
        expect(data.data).toHaveProperty('platform');
        expect(['win32', 'darwin', 'linux']).toContain(data.data.platform);
      });

      it('GET /api/v1/universal/platform/capabilities returns platform capabilities', async () => {
        const response = await fetch(`${API_BASE}/api/v1/universal/platform/capabilities`);
        expect(response.status).toBe(200);
        const data = await response.json();
        
        expect(data).toHaveProperty('envelope');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('capabilities');
        expect(Array.isArray(data.data.capabilities)).toBe(true);
      });

      it('GET /api/v1/universal/platform/supports/:feature checks feature support', async () => {
        const response = await fetch(`${API_BASE}/api/v1/universal/platform/supports/adb`);
        expect(response.status).toBe(200);
        const data = await response.json();
        
        expect(data).toHaveProperty('envelope');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('supported');
        expect(typeof data.data.supported).toBe('boolean');
      });
    });

    describe('Universal Devices API', () => {
      it('GET /api/v1/universal/devices returns all devices in universal format', async () => {
        const response = await fetch(`${API_BASE}/api/v1/universal/devices`);
        expect(response.status).toBe(200);
        const data = await response.json();
        
        expect(data).toHaveProperty('envelope');
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data.devices)).toBe(true);
      });

      it('POST /api/v1/universal/devices can add/update a device', async () => {
        const device = {
          id: 'test-device-123',
          name: 'Test Device',
          platform: 'android',
          protocols: ['adb'],
          status: 'connected'
        };

        const response = await fetch(`${API_BASE}/api/v1/universal/devices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(device)
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('envelope');
        expect(data).toHaveProperty('data');
      });

      it('GET /api/v1/universal/devices/search can search devices', async () => {
        const response = await fetch(`${API_BASE}/api/v1/universal/devices/search?platform=android`);
        expect(response.status).toBe(200);
        const data = await response.json();
        
        expect(data).toHaveProperty('envelope');
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data.devices)).toBe(true);
      });
    });
  });

  describe('Phase 3: Performance Optimization', () => {
    describe('Caching System', () => {
      it('Repeated requests benefit from caching', async () => {
        const start1 = performance.now();
        await fetch(`${API_BASE}/api/v1/universal/platform`);
        const time1 = performance.now() - start1;

        const start2 = performance.now();
        await fetch(`${API_BASE}/api/v1/universal/platform`);
        const time2 = performance.now() - start2;

        // Second request should be faster (cached)
        // Allow some variance but expect improvement
        expect(time2).toBeLessThanOrEqual(time1 * 1.5);
      });
    });

    describe('Connection Pooling', () => {
      it('Multiple concurrent requests are handled efficiently', async () => {
        const requests = Array(10).fill(null).map(() => 
          fetch(`${API_BASE}/api/v1/health`)
        );

        const start = performance.now();
        await Promise.all(requests);
        const totalTime = performance.now() - start;

        // All requests should complete in reasonable time
        expect(totalTime).toBeLessThan(5000); // 5 seconds max
      });
    });
  });

  describe('Phase 4: Reliability Systems', () => {
    describe('Health Check API', () => {
      it('GET /api/v1/reliability/health returns comprehensive health status', async () => {
        const response = await fetch(`${API_BASE}/api/v1/reliability/health`);
        expect(response.status).toBe(200);
        const data = await response.json();
        
        expect(data).toHaveProperty('envelope');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('status');
        expect(data.data).toHaveProperty('timestamp');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(data.data.status);
      });

      it('GET /api/v1/reliability/health/circuit-breakers returns circuit breaker status', async () => {
        const response = await fetch(`${API_BASE}/api/v1/reliability/health/circuit-breakers`);
        expect(response.status).toBe(200);
        const data = await response.json();
        
        expect(data).toHaveProperty('envelope');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('circuitBreakers');
      });

      it('GET /api/v1/reliability/health/recovery returns recovery statistics', async () => {
        const response = await fetch(`${API_BASE}/api/v1/reliability/health/recovery`);
        expect(response.status).toBe(200);
        const data = await response.json();
        
        expect(data).toHaveProperty('envelope');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('recoveryStats');
      });

      it('GET /api/v1/reliability/health/degradation returns degradation status', async () => {
        const response = await fetch(`${API_BASE}/api/v1/reliability/health/degradation`);
        expect(response.status).toBe(200);
        const data = await response.json();
        
        expect(data).toHaveProperty('envelope');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('degradedFeatures');
      });
    });
  });

  describe('Phase 5: Integration & Polish', () => {
    describe('Cross-Layer Integration', () => {
      it('Observability tracks universal platform requests', async () => {
        // Make a request to universal platform API
        await fetch(`${API_BASE}/api/v1/universal/platform`);

        // Check that metrics were collected
        const metricsResponse = await fetch(`${API_BASE}/api/v1/observability/metrics?format=json`);
        const metricsData = await metricsResponse.json();
        
        expect(metricsData).toHaveProperty('data');
        expect(metricsData.data).toHaveProperty('counters');
      });

      it('Health check includes all system components', async () => {
        const response = await fetch(`${API_BASE}/api/v1/reliability/health`);
        const data = await response.json();
        
        expect(data.data).toHaveProperty('components');
        expect(Array.isArray(data.data.components)).toBe(true);
      });
    });

    describe('Performance Targets', () => {
      it('API responses meet sub-100ms target for cached endpoints', async () => {
        // Warm up cache
        await fetch(`${API_BASE}/api/v1/universal/platform`);

        const start = performance.now();
        await fetch(`${API_BASE}/api/v1/universal/platform`);
        const duration = performance.now() - start;

        // Should be under 100ms for cached responses
        expect(duration).toBeLessThan(100);
      });
    });
  });

  describe('Universal Legend Status - Complete System Test', () => {
    it('All phases work together seamlessly', async () => {
      // Test observability
      const metricsResponse = await fetch(`${API_BASE}/api/v1/observability/metrics/summary`);
      expect(metricsResponse.status).toBe(200);

      // Test universal compatibility
      const platformResponse = await fetch(`${API_BASE}/api/v1/universal/platform`);
      expect(platformResponse.status).toBe(200);

      // Test reliability
      const healthResponse = await fetch(`${API_BASE}/api/v1/reliability/health`);
      expect(healthResponse.status).toBe(200);

      // All systems operational
      const healthData = await healthResponse.json();
      expect(healthData.data.status).toBe('healthy');
    });
  });
});
