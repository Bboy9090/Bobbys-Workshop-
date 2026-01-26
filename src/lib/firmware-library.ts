/**
 * Firmware Library System
 * 
 * GOD MODE: Comprehensive firmware database and download manager.
 * Access stock ROMs, custom recoveries, and firmware for any device.
 */

import { createLogger } from '@/lib/debug-logger';
import { safeAsync } from '@/lib/error-handler';

const logger = createLogger('FirmwareLibrary');

// Firmware types
export type FirmwareType = 
  | 'stock_rom'
  | 'custom_rom'
  | 'recovery'
  | 'bootloader'
  | 'kernel'
  | 'gapps'
  | 'magisk'
  | 'twrp'
  | 'ipsw'
  | 'factory_image';

// Firmware platforms
export type FirmwarePlatform = 'android' | 'ios';

// Firmware status
export type FirmwareStatus = 'available' | 'downloading' | 'downloaded' | 'verifying' | 'failed';

// Firmware entry
export interface FirmwareEntry {
  id: string;
  name: string;
  version: string;
  type: FirmwareType;
  platform: FirmwarePlatform;
  manufacturer: string;
  device: string;
  model: string;
  region?: string;
  carrier?: string;
  buildNumber?: string;
  androidVersion?: string;
  iosVersion?: string;
  securityPatch?: string;
  size: number; // bytes
  checksum: string; // MD5 or SHA256
  checksumType: 'md5' | 'sha256';
  downloadUrl?: string;
  mirrorUrls?: string[];
  releaseDate: string;
  changelog?: string;
  tags: string[];
}

// Download progress
export interface DownloadProgress {
  firmwareId: string;
  status: FirmwareStatus;
  progress: number; // 0-100
  bytesDownloaded: number;
  totalBytes: number;
  speed: number; // bytes/sec
  eta: number; // seconds
  error?: string;
}

// Download queue item
interface DownloadQueueItem {
  firmware: FirmwareEntry;
  progress: DownloadProgress;
  abortController?: AbortController;
}

// Popular manufacturers
export const MANUFACTURERS = [
  'Samsung',
  'Google',
  'OnePlus',
  'Xiaomi',
  'Huawei',
  'Motorola',
  'LG',
  'Sony',
  'ASUS',
  'Nokia',
  'Oppo',
  'Vivo',
  'Realme',
  'Apple',
] as const;

// Firmware data is loaded from the backend. No local mock data.
const SAMPLE_FIRMWARE: FirmwareEntry[] = [];

/**
 * Firmware Library Manager
 */
class FirmwareLibraryManager {
  private cache: FirmwareEntry[] = [];
  private downloadQueue: Map<string, DownloadQueueItem> = new Map();
  private listeners: Set<(downloads: DownloadProgress[]) => void> = new Set();

  constructor() {
    this.cache = SAMPLE_FIRMWARE;
  }

  /**
   * Search firmware by various criteria
   */
  async search(options: {
    query?: string;
    manufacturer?: string;
    device?: string;
    type?: FirmwareType;
    platform?: FirmwarePlatform;
  }): Promise<FirmwareEntry[]> {
    const { query, manufacturer, device, type, platform } = options;

    // Try fetching from API first
    const apiResult = await safeAsync(async () => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (manufacturer) params.set('manufacturer', manufacturer);
      if (device) params.set('device', device);
      if (type) params.set('type', type);
      if (platform) params.set('platform', platform);

      const response = await fetch(`/api/v1/firmware/library/search?${params}`);
      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      return data.data?.results || [];
    });

    if (apiResult.success) {
      return apiResult.data;
    }

    return [];
  }

  /**
   * Get firmware by ID
   */
  async getById(id: string): Promise<FirmwareEntry | null> {
    const apiResult = await safeAsync(async () => {
      const response = await fetch(`/api/v1/firmware/library/${id}`);
      if (!response.ok) throw new Error('Not found');
      const data = await response.json();
      return data.data;
    });

    return apiResult.success ? apiResult.data : null;
  }

  /**
   * Get available manufacturers
   */
  getManufacturers(): string[] {
    const manufacturers = new Set(this.cache.map(fw => fw.manufacturer));
    return Array.from(manufacturers).sort();
  }

  /**
   * Get devices for a manufacturer
   */
  getDevices(manufacturer: string): string[] {
    const devices = new Set(
      this.cache
        .filter(fw => fw.manufacturer === manufacturer)
        .map(fw => fw.device)
    );
    return Array.from(devices).sort();
  }

  /**
   * Start downloading firmware
   */
  async download(firmware: FirmwareEntry): Promise<void> {
    if (this.downloadQueue.has(firmware.id)) {
      logger.warn(`Already downloading ${firmware.id}`);
      return;
    }

    const abortController = new AbortController();
    
    const progress: DownloadProgress = {
      firmwareId: firmware.id,
      status: 'downloading',
      progress: 0,
      bytesDownloaded: 0,
      totalBytes: firmware.size,
      speed: 0,
      eta: 0,
    };

    const item: DownloadQueueItem = {
      firmware,
      progress,
      abortController,
    };

    this.downloadQueue.set(firmware.id, item);
    this.notifyListeners();

    logger.info(`Starting download: ${firmware.name}`);

    try {
      // Real download via backend API
      await this.executeRealDownload(item);
      
      item.progress.status = 'downloaded';
      item.progress.progress = 100;
      logger.info(`Download complete: ${firmware.name}`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        item.progress.status = 'failed';
        item.progress.error = 'Download cancelled';
      } else {
        item.progress.status = 'failed';
        item.progress.error = error instanceof Error ? error.message : 'Download failed';
      }
      logger.error(`Download failed: ${firmware.name}`, error);
    }

    this.notifyListeners();
  }

  /**
   * Cancel download
   */
  cancelDownload(firmwareId: string): void {
    const item = this.downloadQueue.get(firmwareId);
    if (item && item.abortController) {
      item.abortController.abort();
      item.progress.status = 'failed';
      item.progress.error = 'Cancelled by user';
      this.notifyListeners();
    }
  }

  /**
   * Get download progress
   */
  getDownloadProgress(firmwareId: string): DownloadProgress | null {
    return this.downloadQueue.get(firmwareId)?.progress || null;
  }

  /**
   * Get all active downloads
   */
  getActiveDownloads(): DownloadProgress[] {
    return Array.from(this.downloadQueue.values()).map(item => item.progress);
  }

  /**
   * Subscribe to download updates
   */
  onDownloadUpdate(callback: (downloads: DownloadProgress[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Execute real firmware download via backend API
   * NO SIMULATION - Real file download with progress tracking
   */
  private async executeRealDownload(item: DownloadQueueItem): Promise<void> {
    const downloadUrl = item.firmware.downloadUrl;
    
    if (!downloadUrl) {
      throw new Error('No download URL available for this firmware');
    }

    // Use backend download endpoint for proxied/managed downloads
    const apiUrl = `/api/v1/firmware/download/${item.firmware.id}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firmwareId: item.firmware.id,
        url: downloadUrl,
      }),
      signal: item.abortController?.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Download failed: HTTP ${response.status}`);
    }

    // If backend returns a stream, track progress
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body for download');
    }

    const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);
    const totalBytes = contentLength || item.firmware.size;
    let receivedBytes = 0;
    let lastTime = Date.now();
    let lastBytes = 0;

    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      if (value) {
        chunks.push(value);
        receivedBytes += value.length;

        // Calculate speed
        const now = Date.now();
        const timeDelta = (now - lastTime) / 1000;
        if (timeDelta >= 0.5) {
          const bytesDelta = receivedBytes - lastBytes;
          item.progress.speed = bytesDelta / timeDelta;
          lastTime = now;
          lastBytes = receivedBytes;
        }

        // Update progress
        item.progress.bytesDownloaded = receivedBytes;
        item.progress.progress = totalBytes > 0 
          ? Math.round((receivedBytes / totalBytes) * 100) 
          : 0;
        item.progress.eta = item.progress.speed > 0 
          ? Math.round((totalBytes - receivedBytes) / item.progress.speed) 
          : 0;

        this.notifyListeners();
      }
    }

    logger.info(`Downloaded ${receivedBytes} bytes for ${item.firmware.name}`);
  }

  private notifyListeners(): void {
    const downloads = this.getActiveDownloads();
    this.listeners.forEach(cb => cb(downloads));
  }
}

// Singleton instance
export const firmwareLibrary = new FirmwareLibraryManager();

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Format download speed
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`;
}

/**
 * Format ETA
 */
export function formatETA(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
