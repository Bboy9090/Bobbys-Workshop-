/**
 * 🌟 World Class Universal Legend - TypeScript SDK
 * 
 * Official TypeScript SDK for Bobby's Secret Workshop API
 */

export interface ClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  envelope: {
    version: string;
    operation: string;
    mode: string;
    timestamp: string;
  };
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

export class UniversalLegendClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: ClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:3001';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  // Performance API
  async getPerformanceStats() {
    return this.request('GET', '/api/v1/world-class/performance/stats');
  }

  async getSlowRequests(limit = 10) {
    return this.request('GET', `/api/v1/world-class/performance/slow-requests?limit=${limit}`);
  }

  async getPerformanceRecommendations(limit = 10) {
    return this.request('GET', `/api/v1/world-class/performance/recommendations?limit=${limit}`);
  }

  async getCacheStats() {
    return this.request('GET', '/api/v1/world-class/performance/cache/stats');
  }

  async clearCache() {
    return this.request('POST', '/api/v1/world-class/performance/cache/clear');
  }

  // Alerting API
  async getAlertRules() {
    return this.request('GET', '/api/v1/world-class/alerts/rules');
  }

  async createAlertRule(rule: any) {
    return this.request('POST', '/api/v1/world-class/alerts/rules', rule);
  }

  async getActiveAlerts() {
    return this.request('GET', '/api/v1/world-class/alerts/active');
  }

  async getAlertHistory(limit = 100) {
    return this.request('GET', `/api/v1/world-class/alerts/history?limit=${limit}`);
  }

  // Security API
  async getRoles() {
    return this.request('GET', '/api/v1/world-class/security/rbac/roles');
  }

  async assignRole(userId: string, roleId: string) {
    return this.request('POST', `/api/v1/world-class/security/rbac/roles/${userId}`, { roleId });
  }

  async getUserPermissions(userId: string) {
    return this.request('GET', `/api/v1/world-class/security/rbac/users/${userId}/permissions`);
  }

  async setupMFA(userId: string) {
    return this.request('POST', '/api/v1/world-class/security/mfa/setup', { userId });
  }

  async enableMFA(userId: string, token: string) {
    return this.request('POST', '/api/v1/world-class/security/mfa/enable', { userId, token });
  }

  async getMFAStatus(userId: string) {
    return this.request('GET', `/api/v1/world-class/security/mfa/status/${userId}`);
  }

  async searchAuditLogs(query: string, limit = 100) {
    return this.request('GET', `/api/v1/world-class/security/audit/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async generateComplianceReport(startDate: string, endDate: string) {
    return this.request('GET', `/api/v1/world-class/security/audit/compliance-report?startDate=${startDate}&endDate=${endDate}`);
  }

  // Scalability API
  async getAutoScalerStatus() {
    return this.request('GET', '/api/v1/world-class/scalability/auto-scaler/status');
  }

  async checkScaling() {
    return this.request('POST', '/api/v1/world-class/scalability/auto-scaler/check');
  }

  async updateAutoScalerConfig(config: any) {
    return this.request('PUT', '/api/v1/world-class/scalability/auto-scaler/config', config);
  }

  async getLoadBalancerStatus() {
    return this.request('GET', '/api/v1/world-class/scalability/load-balancer/status');
  }

  async addBackend(backend: any) {
    return this.request('POST', '/api/v1/world-class/scalability/load-balancer/backends', backend);
  }

  async removeBackend(backendId: string) {
    return this.request('DELETE', `/api/v1/world-class/scalability/load-balancer/backends/${backendId}`);
  }

  async checkBackendHealth() {
    return this.request('POST', '/api/v1/world-class/scalability/load-balancer/health-check');
  }

  async setLoadBalancerAlgorithm(algorithm: string) {
    return this.request('PUT', '/api/v1/world-class/scalability/load-balancer/algorithm', { algorithm });
  }

  // Universal Legend Status API
  async getMetrics(format: 'json' | 'prometheus' = 'json') {
    return this.request('GET', `/api/v1/observability/metrics?format=${format}`);
  }

  async getMetricsSummary() {
    return this.request('GET', '/api/v1/observability/metrics/summary');
  }

  async getActiveTraces() {
    return this.request('GET', '/api/v1/observability/traces/active');
  }

  async getPlatformInfo() {
    return this.request('GET', '/api/v1/universal/platform');
  }

  async getHealth() {
    return this.request('GET', '/api/v1/reliability/health');
  }
}

// Export default instance
export default UniversalLegendClient;
