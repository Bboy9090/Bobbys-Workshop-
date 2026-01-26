/**
 * 🌟 World Class Universal Legend - Load Balancer
 * 
 * Intelligent load balancing with:
 * - Round-robin
 * - Least connections
 * - Weighted round-robin
 * - Health checks
 * - Session affinity
 */

class LoadBalancer {
  constructor() {
    this.backends = [];
    this.algorithm = 'round-robin'; // 'round-robin', 'least-connections', 'weighted'
    this.currentIndex = 0;
    this.healthChecks = new Map();
    this.connectionCounts = new Map();
  }

  // Add backend server
  addBackend(backend) {
    const backendId = backend.id || `backend-${this.backends.length + 1}`;
    const fullBackend = {
      id: backendId,
      url: backend.url,
      weight: backend.weight || 1,
      healthCheckUrl: backend.healthCheckUrl || `${backend.url}/health`,
      healthy: true,
      connections: 0,
      ...backend,
    };

    this.backends.push(fullBackend);
    this.connectionCounts.set(backendId, 0);
    this.healthChecks.set(backendId, { lastCheck: null, healthy: true });

    return backendId;
  }

  // Remove backend server
  removeBackend(backendId) {
    const index = this.backends.findIndex(b => b.id === backendId);
    if (index !== -1) {
      this.backends.splice(index, 1);
      this.connectionCounts.delete(backendId);
      this.healthChecks.delete(backendId);
      return true;
    }
    return false;
  }

  // Get next backend based on algorithm
  getNextBackend(sessionId = null) {
    // Filter healthy backends
    const healthyBackends = this.backends.filter(b => b.healthy);

    if (healthyBackends.length === 0) {
      throw new Error('No healthy backends available');
    }

    // Session affinity
    if (sessionId) {
      const affinityBackend = this._getAffinityBackend(sessionId);
      if (affinityBackend && affinityBackend.healthy) {
        return affinityBackend;
      }
    }

    // Apply load balancing algorithm
    let selectedBackend;
    switch (this.algorithm) {
      case 'round-robin':
        selectedBackend = this._roundRobin(healthyBackends);
        break;
      case 'least-connections':
        selectedBackend = this._leastConnections(healthyBackends);
        break;
      case 'weighted':
        selectedBackend = this._weightedRoundRobin(healthyBackends);
        break;
      default:
        selectedBackend = this._roundRobin(healthyBackends);
    }

    // Increment connection count
    const count = this.connectionCounts.get(selectedBackend.id) || 0;
    this.connectionCounts.set(selectedBackend.id, count + 1);

    return selectedBackend;
  }

  _roundRobin(backends) {
    const backend = backends[this.currentIndex % backends.length];
    this.currentIndex = (this.currentIndex + 1) % backends.length;
    return backend;
  }

  _leastConnections(backends) {
    return backends.reduce((min, backend) => {
      const minConnections = this.connectionCounts.get(min.id) || 0;
      const backendConnections = this.connectionCounts.get(backend.id) || 0;
      return backendConnections < minConnections ? backend : min;
    });
  }

  _weightedRoundRobin(backends) {
    const totalWeight = backends.reduce((sum, b) => sum + b.weight, 0);
    let random = Math.random() * totalWeight;

    for (const backend of backends) {
      random -= backend.weight;
      if (random <= 0) {
        return backend;
      }
    }

    return backends[0]; // Fallback
  }

  _getAffinityBackend(sessionId) {
    // Simple hash-based affinity
    const hash = this._hashString(sessionId);
    const index = hash % this.backends.length;
    return this.backends[index];
  }

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Release connection
  releaseConnection(backendId) {
    const count = this.connectionCounts.get(backendId) || 0;
    if (count > 0) {
      this.connectionCounts.set(backendId, count - 1);
    }
  }

  // Health check
  async checkHealth(backendId) {
    const backend = this.backends.find(b => b.id === backendId);
    if (!backend) return false;

    try {
      const response = await fetch(backend.healthCheckUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const healthy = response.ok;
      backend.healthy = healthy;

      this.healthChecks.set(backendId, {
        lastCheck: new Date().toISOString(),
        healthy,
        statusCode: response.status,
      });

      return healthy;
    } catch (error) {
      backend.healthy = false;
      this.healthChecks.set(backendId, {
        lastCheck: new Date().toISOString(),
        healthy: false,
        error: error.message,
      });
      return false;
    }
  }

  // Check all backends
  async checkAllHealth() {
    const checks = await Promise.all(
      this.backends.map(b => this.checkHealth(b.id))
    );
    return checks.every(c => c);
  }

  // Get status
  getStatus() {
    return {
      algorithm: this.algorithm,
      backends: this.backends.map(b => ({
        id: b.id,
        url: b.url,
        healthy: b.healthy,
        connections: this.connectionCounts.get(b.id) || 0,
        weight: b.weight,
        lastHealthCheck: this.healthChecks.get(b.id)?.lastCheck,
      })),
      totalBackends: this.backends.length,
      healthyBackends: this.backends.filter(b => b.healthy).length,
    };
  }

  setAlgorithm(algorithm) {
    if (['round-robin', 'least-connections', 'weighted'].includes(algorithm)) {
      this.algorithm = algorithm;
      return true;
    }
    return false;
  }
}

export default new LoadBalancer();
