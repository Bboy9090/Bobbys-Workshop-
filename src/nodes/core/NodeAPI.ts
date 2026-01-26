/**
 * Node API Integration
 * 
 * Centralized API client for nodes to communicate with backend
 * ALL endpoints are real and functional - no placeholders
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface APIResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  meta?: any;
}

export class NodeAPI {
  private static baseURL = API_BASE_URL;

  /**
   * Make API request with envelope handling
   */
  static async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          ok: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          meta: errorData.meta
        };
      }

      const data = await response.json();
      
      // Handle envelope format
      if (data.ok !== undefined) {
        return {
          ok: data.ok,
          data: data.data,
          meta: data.meta
        };
      }

      // Direct response
      return {
        ok: true,
        data
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * GET request
   */
  static async get<T = any>(endpoint: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  static async post<T = any>(endpoint: string, body?: any): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  /**
   * PUT request
   */
  static async put<T = any>(endpoint: string, body?: any): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  /**
   * DELETE request
   */
  static async delete<T = any>(endpoint: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Security API endpoints
  static async getEncryptionStatus(serial: string): Promise<APIResponse> {
    return this.get(`/api/v1/security/encryption-status/${serial}`);
  }

  static async getSecurityPatch(serial: string): Promise<APIResponse> {
    return this.get(`/api/v1/security/security-patch/${serial}`);
  }

  static async getRootDetection(serial: string): Promise<APIResponse> {
    return this.get(`/api/v1/security/root-detection/${serial}`);
  }

  static async getBootloaderStatus(serial: string): Promise<APIResponse> {
    return this.get(`/api/v1/security/bootloader-status/${serial}`);
  }

  // Device API endpoints
  static async scanDevices(): Promise<APIResponse> {
    return this.get('/api/v1/adb/devices');
  }

  static async getAndroidDevices(): Promise<APIResponse> {
    return this.get('/api/v1/android-devices/all');
  }

  static async getFastbootDevices(): Promise<APIResponse> {
    return this.get('/api/v1/fastboot/devices');
  }

  static async getDeviceInfo(serial: string): Promise<APIResponse> {
    return this.get(`/api/v1/fastboot/device-info/${serial}`);
  }

  // Monitoring API endpoints
  static async getPerformanceMetrics(serial: string): Promise<APIResponse> {
    return this.get(`/api/v1/monitor/performance/${serial}`);
  }

  // Firmware API endpoints
  static async getFirmwareLibrary(): Promise<APIResponse> {
    return this.get('/api/v1/firmware/library/brands');
  }

  static async searchFirmware(query: Record<string, string>): Promise<APIResponse> {
    const params = new URLSearchParams(query);
    return this.get(`/api/v1/firmware/library/search?${params.toString()}`);
  }

  static async downloadFirmware(brand: string, model: string, version: string): Promise<APIResponse> {
    return this.post('/api/v1/firmware/library/download', { brand, model, version });
  }

  // Flashing API endpoints
  static async fastbootFlash(serial: string, partition: string, imagePath: string): Promise<APIResponse> {
    return this.post('/api/v1/fastboot/flash', { serial, partition, imagePath });
  }

  static async fastbootUnlock(serial: string): Promise<APIResponse> {
    return this.post('/api/v1/fastboot/unlock', { serial });
  }

  static async fastbootReboot(serial: string, mode?: string): Promise<APIResponse> {
    return this.post('/api/v1/fastboot/reboot', { serial, mode });
  }

  static async fastbootErase(serial: string, partition: string): Promise<APIResponse> {
    return this.post('/api/v1/fastboot/erase', { serial, partition });
  }

  static async odinFlash(serial: string, files: Record<string, string>): Promise<APIResponse> {
    return this.post('/api/v1/flash/odin/flash', { serial, files });
  }

  static async mtkFlash(serial: string, scatterFile: string, images: Record<string, string>): Promise<APIResponse> {
    return this.post('/api/v1/flash/mtk/flash', { serial, scatterFile, images });
  }

  static async edlFlash(serial: string, programmer: string, images: Record<string, string>): Promise<APIResponse> {
    return this.post('/api/v1/flash/edl/flash', { serial, programmer, images });
  }

  // iOS API endpoints
  static async iosScan(): Promise<APIResponse> {
    return this.get('/api/v1/ios/scan');
  }

  static async iosDFUEnter(serial: string): Promise<APIResponse> {
    return this.post('/api/v1/ios/dfu/enter', { serial });
  }

  // Health check
  static async healthCheck(): Promise<APIResponse> {
    return this.get('/api/health');
  }
}

export default NodeAPI;
