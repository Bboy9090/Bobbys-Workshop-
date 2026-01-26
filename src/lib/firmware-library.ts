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

// Sample firmware database (in production, this would come from the backend)
const SAMPLE_FIRMWARE: FirmwareEntry[] = [
  {
    id: 'samsung-s23-ultra-stock-one-ui-6',
    name: 'One UI 6.0 Stock ROM',
    version: 'S918BXXU4CWK1',
    type: 'stock_rom',
    platform: 'android',
    manufacturer: 'Samsung',
    device: 'Galaxy S23 Ultra',
    model: 'SM-S918B',
    region: 'Global',
    buildNumber: 'S918BXXU4CWK1',
    androidVersion: '14',
    securityPatch: '2024-11-01',
    size: 6_800_000_000, // ~6.8 GB
    checksum: 'a1b2c3d4e5f6...',
    checksumType: 'sha256',
    releaseDate: '2024-11-15',
    changelog: 'One UI 6.0 update with Android 14',
    tags: ['official', 'stable', 'android-14'],
  },
  {
    id: 'pixel-8-pro-factory-image',
    name: 'Android 14 Factory Image',
    version: 'AP2A.240905.003',
    type: 'factory_image',
    platform: 'android',
    manufacturer: 'Google',
    device: 'Pixel 8 Pro',
    model: 'husky',
    region: 'Global',
    buildNumber: 'AP2A.240905.003',
    androidVersion: '14',
    securityPatch: '2024-09-05',
    size: 2_100_000_000, // ~2.1 GB
    checksum: 'f1e2d3c4b5a6...',
    checksumType: 'sha256',
    releaseDate: '2024-09-05',
    tags: ['official', 'factory', 'android-14'],
  },
  {
    id: 'twrp-3-7-0-universal',
    name: 'TWRP Recovery 3.7.0',
    version: '3.7.0_12-0',
    type: 'twrp',
    platform: 'android',
    manufacturer: 'TeamWin',
    device: 'Universal',
    model: 'Various',
    size: 35_000_000, // ~35 MB
    checksum: 'abc123def456...',
    checksumType: 'md5',
    releaseDate: '2023-02-15',
    changelog: 'TWRP 3.7.0 with Android 12 support',
    tags: ['recovery', 'twrp', 'universal'],
  },
  {
    id: 'magisk-27-0',
    name: 'Magisk v27.0',
    version: '27.0',
    type: 'magisk',
    platform: 'android',
    manufacturer: 'topjohnwu',
    device: 'Universal',
    model: 'Various',
    size: 12_000_000, // ~12 MB
    checksum: 'magisk27checksum...',
    checksumType: 'sha256',
    releaseDate: '2024-03-01',
    changelog: 'Magisk 27.0 with improved Zygisk',
    tags: ['root', 'magisk', 'universal'],
  },
  {
    id: 'gapps-android-14',
    name: 'OpenGApps Android 14',
    version: '14.0-pico',
    type: 'gapps',
    platform: 'android',
    manufacturer: 'OpenGApps',
    device: 'Universal',
    model: 'ARM64',
    size: 150_000_000, // ~150 MB
    checksum: 'gappschecksum...',
    checksumType: 'md5',
    releaseDate: '2024-01-15',
    changelog: 'Minimal GApps package for Android 14',
    tags: ['gapps', 'pico', 'android-14'],
  },
  {
    id: 'iphone-15-pro-ios-17-2',
    name: 'iOS 17.2 IPSW',
    version: '17.2',
    type: 'ipsw',
    platform: 'ios',
    manufacturer: 'Apple',
    device: 'iPhone 15 Pro',
    model: 'iPhone16,1',
    iosVersion: '17.2',
    size: 7_500_000_000, // ~7.5 GB
    checksum: 'ioschecksum...',
    checksumType: 'sha256',
    releaseDate: '2023-12-11',
    changelog: 'iOS 17.2 with Journal app',
    tags: ['official', 'ipsw', 'ios-17'],
  },
];

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

    if (apiResult.success && apiResult.data.length > 0) {
      return apiResult.data;
    }

    // Fall back to local cache
    return this.cache.filter(fw => {
      if (query && !fw.name.toLowerCase().includes(query.toLowerCase()) &&
          !fw.device.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      if (manufacturer && fw.manufacturer !== manufacturer) return false;
      if (device && !fw.device.toLowerCase().includes(device.toLowerCase())) return false;
      if (type && fw.type !== type) return false;
      if (platform && fw.platform !== platform) return false;
      return true;
    });
  }

  /**
   * Get firmware by ID
   */
  async getById(id: string): Promise<FirmwareEntry | null> {
    const cached = this.cache.find(fw => fw.id === id);
    if (cached) return cached;

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
      // In production, this would actually download the file
      // For now, simulate download progress
      await this.simulateDownload(item);
      
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
   * Simulate download for demo purposes
   */
  private async simulateDownload(item: DownloadQueueItem): Promise<void> {
    const chunkSize = item.firmware.size / 20;
    const chunkDelay = 200;

    for (let i = 0; i <= 20; i++) {
      if (item.abortController?.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      item.progress.bytesDownloaded = Math.min(chunkSize * i, item.firmware.size);
      item.progress.progress = Math.round((item.progress.bytesDownloaded / item.firmware.size) * 100);
      item.progress.speed = chunkSize / (chunkDelay / 1000);
      item.progress.eta = Math.round((item.firmware.size - item.progress.bytesDownloaded) / item.progress.speed);

      this.notifyListeners();
      await new Promise(r => setTimeout(r, chunkDelay));
    }
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
