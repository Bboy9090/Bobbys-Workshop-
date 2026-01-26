/**
 * Offline Storage System
 * 
 * GOD MODE: Full offline functionality with IndexedDB and sync.
 * Never lose data, always work, seamlessly sync when online.
 */

import { createLogger } from '@/lib/debug-logger';

const logger = createLogger('OfflineStorage');

// Database configuration
const DB_NAME = 'BobbysWorkshop';
const DB_VERSION = 1;

// Store names
const STORES = {
  DEVICES: 'devices',
  OPERATIONS: 'operations',
  REPORTS: 'reports',
  WORKFLOWS: 'workflows',
  SETTINGS: 'settings',
  QUEUE: 'syncQueue',
} as const;

// Sync queue item
interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  store: string;
  data: unknown;
  createdAt: number;
  attempts: number;
  lastAttempt?: number;
}

// Cached device data
export interface CachedDevice {
  id: string;
  serial: string;
  platform: string;
  model?: string;
  manufacturer?: string;
  lastSeen: number;
  mode?: string;
}

// Cached operation
export interface CachedOperation {
  id: string;
  deviceSerial: string;
  type: string;
  status: 'pending' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  result?: unknown;
}

/**
 * Initialize IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      logger.error('Failed to open database', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object stores
      if (!db.objectStoreNames.contains(STORES.DEVICES)) {
        db.createObjectStore(STORES.DEVICES, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(STORES.OPERATIONS)) {
        const opStore = db.createObjectStore(STORES.OPERATIONS, { keyPath: 'id' });
        opStore.createIndex('deviceSerial', 'deviceSerial', { unique: false });
        opStore.createIndex('status', 'status', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.REPORTS)) {
        db.createObjectStore(STORES.REPORTS, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(STORES.WORKFLOWS)) {
        db.createObjectStore(STORES.WORKFLOWS, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
      
      if (!db.objectStoreNames.contains(STORES.QUEUE)) {
        const queueStore = db.createObjectStore(STORES.QUEUE, { keyPath: 'id' });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      logger.info('Database schema upgraded');
    };
  });
}

/**
 * Generic database operations
 */
class OfflineDB<T extends { id: string }> {
  private storeName: string;
  
  constructor(storeName: string) {
    this.storeName = storeName;
  }
  
  async getAll(): Promise<T[]> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  async get(id: string): Promise<T | undefined> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  async put(item: T): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(item);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async delete(id: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  async clear(): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Store instances
export const deviceStore = new OfflineDB<CachedDevice>(STORES.DEVICES);
export const operationStore = new OfflineDB<CachedOperation>(STORES.OPERATIONS);

/**
 * Settings store with typed keys
 */
class SettingsStore {
  private db = new OfflineDB<{ key: string; value: unknown; id: string }>(STORES.SETTINGS);
  
  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const item = await this.db.get(key);
    return (item?.value as T) ?? defaultValue;
  }
  
  async set<T>(key: string, value: T): Promise<void> {
    await this.db.put({ id: key, key, value });
  }
  
  async remove(key: string): Promise<void> {
    await this.db.delete(key);
  }
}

export const settingsStore = new SettingsStore();

/**
 * Sync queue for offline operations
 */
class SyncQueue {
  private db = new OfflineDB<SyncQueueItem>(STORES.QUEUE);
  private isSyncing = false;
  
  async add(action: SyncQueueItem['action'], store: string, data: unknown): Promise<void> {
    await this.db.put({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      action,
      store,
      data,
      createdAt: Date.now(),
      attempts: 0,
    });
    
    // Try to sync immediately if online
    if (navigator.onLine) {
      this.sync();
    }
  }
  
  async getPending(): Promise<SyncQueueItem[]> {
    return this.db.getAll();
  }
  
  /**
   * Sync a single queued item to the server
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    const endpoint = `/api/v1/sync/${item.store}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: item.action,
        data: item.data,
        queuedAt: item.createdAt,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
  }
  
  async sync(): Promise<void> {
    if (this.isSyncing || !navigator.onLine) return;
    
    this.isSyncing = true;
    logger.info('Starting sync...');
    
    try {
      const items = await this.getPending();
      
      for (const item of items) {
        try {
          await this.syncItem(item);
          await this.db.delete(item.id);
          logger.debug(`Synced item ${item.id}`);
        } catch (e) {
          // Update retry count
          await this.db.put({
            ...item,
            attempts: item.attempts + 1,
            lastAttempt: Date.now(),
          });
          logger.warn(`Failed to sync item ${item.id}`, e);
        }
      }
      
      logger.info(`Sync complete: ${items.length} items processed`);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncQueue = new SyncQueue();

/**
 * Online/Offline status manager
 */
class NetworkStatus {
  private listeners: Set<(online: boolean) => void> = new Set();
  private _online = navigator.onLine;
  
  constructor() {
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false));
  }
  
  get online(): boolean {
    return this._online;
  }
  
  private setOnline(online: boolean): void {
    this._online = online;
    logger.info(`Network status: ${online ? 'online' : 'offline'}`);
    this.listeners.forEach(l => l(online));
    
    // Sync when coming online
    if (online) {
      syncQueue.sync();
    }
  }
  
  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const networkStatus = new NetworkStatus();

/**
 * Cache devices for offline access
 */
export async function cacheDevices(devices: CachedDevice[]): Promise<void> {
  for (const device of devices) {
    await deviceStore.put(device);
  }
  logger.debug(`Cached ${devices.length} devices`);
}

/**
 * Get cached devices
 */
export async function getCachedDevices(): Promise<CachedDevice[]> {
  return deviceStore.getAll();
}

/**
 * Clear all offline data
 */
export async function clearOfflineData(): Promise<void> {
  await deviceStore.clear();
  await operationStore.clear();
  logger.info('Offline data cleared');
}

/**
 * Initialize offline storage
 */
export async function initOfflineStorage(): Promise<void> {
  try {
    await openDatabase();
    logger.info('Offline storage initialized');
  } catch (e) {
    logger.error('Failed to initialize offline storage', e);
  }
}
