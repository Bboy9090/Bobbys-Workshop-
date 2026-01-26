/**
 * PHOENIX CORE — Memory Persistence
 * 
 * Persistent memory layer for device state, session data, and operation history.
 * Survives restarts and provides fast in-memory access with disk persistence.
 * 
 * @module core/lib/memory-persistence
 */

import fs from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import crypto from 'crypto';

/**
 * Memory entry with metadata
 */
class MemoryEntry {
  constructor(key, value, options = {}) {
    this.key = key;
    this.value = value;
    this.createdAt = options.createdAt || Date.now();
    this.updatedAt = Date.now();
    this.accessedAt = Date.now();
    this.accessCount = options.accessCount || 0;
    this.ttl = options.ttl || null; // null = never expires
    this.tags = options.tags || [];
    this.checksum = this._computeChecksum();
  }
  
  _computeChecksum() {
    const data = JSON.stringify(this.value);
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
  }
  
  isExpired() {
    if (this.ttl === null) return false;
    return Date.now() > this.createdAt + this.ttl;
  }
  
  touch() {
    this.accessedAt = Date.now();
    this.accessCount++;
  }
  
  update(value) {
    this.value = value;
    this.updatedAt = Date.now();
    this.checksum = this._computeChecksum();
  }
}

/**
 * Memory Namespace - Logical grouping of related data
 */
class MemoryNamespace {
  constructor(name) {
    this.name = name;
    this.entries = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      deletes: 0,
    };
  }
  
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (entry.isExpired()) {
      this.entries.delete(key);
      this.stats.misses++;
      return null;
    }
    entry.touch();
    this.stats.hits++;
    return entry.value;
  }
  
  set(key, value, options = {}) {
    const existing = this.entries.get(key);
    if (existing) {
      existing.update(value);
    } else {
      this.entries.set(key, new MemoryEntry(key, value, options));
    }
    this.stats.writes++;
  }
  
  delete(key) {
    const deleted = this.entries.delete(key);
    if (deleted) this.stats.deletes++;
    return deleted;
  }
  
  has(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.isExpired()) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }
  
  keys() {
    return Array.from(this.entries.keys());
  }
  
  values() {
    return Array.from(this.entries.values())
      .filter(e => !e.isExpired())
      .map(e => e.value);
  }
  
  clear() {
    this.entries.clear();
  }
  
  size() {
    return this.entries.size;
  }
  
  findByTag(tag) {
    const results = [];
    for (const [key, entry] of this.entries) {
      if (!entry.isExpired() && entry.tags.includes(tag)) {
        results.push({ key, value: entry.value });
      }
    }
    return results;
  }
  
  cleanup() {
    let cleaned = 0;
    for (const [key, entry] of this.entries) {
      if (entry.isExpired()) {
        this.entries.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
  
  toJSON() {
    const data = {};
    for (const [key, entry] of this.entries) {
      if (!entry.isExpired()) {
        data[key] = {
          value: entry.value,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          accessCount: entry.accessCount,
          ttl: entry.ttl,
          tags: entry.tags,
        };
      }
    }
    return data;
  }
  
  fromJSON(data) {
    this.entries.clear();
    for (const [key, entryData] of Object.entries(data)) {
      const entry = new MemoryEntry(key, entryData.value, {
        createdAt: entryData.createdAt,
        accessCount: entryData.accessCount,
        ttl: entryData.ttl,
        tags: entryData.tags,
      });
      entry.updatedAt = entryData.updatedAt;
      this.entries.set(key, entry);
    }
  }
}

/**
 * Phoenix Memory - Persistent memory manager
 */
class PhoenixMemory {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'memory');
    this.autoSaveInterval = options.autoSaveInterval || 60000; // 1 minute
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
    
    this.namespaces = new Map();
    this.isDirty = false;
    this.lastSave = null;
    this.autoSaveTimer = null;
    this.cleanupTimer = null;
    
    // Initialize default namespaces
    this._initDefaultNamespaces();
    
    // Ensure data directory exists
    this._ensureDataDir();
    
    // Load persisted data
    this._loadFromDisk();
    
    // Start auto-save and cleanup timers
    this._startTimers();
  }
  
  _initDefaultNamespaces() {
    // Device state persistence
    this.namespaces.set('devices', new MemoryNamespace('devices'));
    
    // Session data
    this.namespaces.set('sessions', new MemoryNamespace('sessions'));
    
    // Operation history
    this.namespaces.set('operations', new MemoryNamespace('operations'));
    
    // Cache for frequently accessed data
    this.namespaces.set('cache', new MemoryNamespace('cache'));
    
    // User preferences
    this.namespaces.set('preferences', new MemoryNamespace('preferences'));
    
    // Workflow state
    this.namespaces.set('workflows', new MemoryNamespace('workflows'));
  }
  
  _ensureDataDir() {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }
  
  _startTimers() {
    // Auto-save timer
    this.autoSaveTimer = setInterval(() => {
      if (this.isDirty) {
        this.save().catch(err => {
          console.error('[PhoenixMemory] Auto-save failed:', err.message);
        });
      }
    }, this.autoSaveInterval);
    
    // Cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }
  
  _stopTimers() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
  
  /**
   * Get a namespace
   */
  namespace(name) {
    if (!this.namespaces.has(name)) {
      this.namespaces.set(name, new MemoryNamespace(name));
    }
    return this.namespaces.get(name);
  }
  
  /**
   * Get value from a namespace
   */
  get(namespace, key) {
    return this.namespace(namespace).get(key);
  }
  
  /**
   * Set value in a namespace
   */
  set(namespace, key, value, options = {}) {
    this.namespace(namespace).set(key, value, options);
    this.isDirty = true;
  }
  
  /**
   * Delete value from a namespace
   */
  delete(namespace, key) {
    const deleted = this.namespace(namespace).delete(key);
    if (deleted) this.isDirty = true;
    return deleted;
  }
  
  /**
   * Check if key exists in namespace
   */
  has(namespace, key) {
    return this.namespace(namespace).has(key);
  }
  
  // ============ Device State Methods ============
  
  /**
   * Store device state
   */
  setDeviceState(deviceId, state) {
    this.set('devices', deviceId, {
      ...state,
      lastUpdated: Date.now(),
    });
  }
  
  /**
   * Get device state
   */
  getDeviceState(deviceId) {
    return this.get('devices', deviceId);
  }
  
  /**
   * Get all device states
   */
  getAllDeviceStates() {
    const ns = this.namespace('devices');
    const devices = {};
    for (const key of ns.keys()) {
      devices[key] = ns.get(key);
    }
    return devices;
  }
  
  // ============ Session Methods ============
  
  /**
   * Create or update session
   */
  setSession(sessionId, data) {
    this.set('sessions', sessionId, {
      ...data,
      lastActivity: Date.now(),
    }, { ttl: 24 * 60 * 60 * 1000 }); // 24 hour TTL
  }
  
  /**
   * Get session
   */
  getSession(sessionId) {
    return this.get('sessions', sessionId);
  }
  
  /**
   * End session
   */
  endSession(sessionId) {
    return this.delete('sessions', sessionId);
  }
  
  // ============ Operation History Methods ============
  
  /**
   * Record operation
   */
  recordOperation(operation) {
    const id = `op_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.set('operations', id, {
      id,
      ...operation,
      recordedAt: Date.now(),
    }, { ttl: 30 * 24 * 60 * 60 * 1000 }); // 30 day TTL
    return id;
  }
  
  /**
   * Get operation history
   */
  getOperationHistory(options = {}) {
    const ns = this.namespace('operations');
    let operations = ns.values();
    
    // Filter by device
    if (options.deviceId) {
      operations = operations.filter(op => op.deviceId === options.deviceId);
    }
    
    // Filter by type
    if (options.type) {
      operations = operations.filter(op => op.type === options.type);
    }
    
    // Filter by time range
    if (options.since) {
      operations = operations.filter(op => op.recordedAt >= options.since);
    }
    
    // Sort by time (newest first)
    operations.sort((a, b) => b.recordedAt - a.recordedAt);
    
    // Limit results
    if (options.limit) {
      operations = operations.slice(0, options.limit);
    }
    
    return operations;
  }
  
  // ============ Preferences Methods ============
  
  /**
   * Set preference
   */
  setPreference(key, value) {
    this.set('preferences', key, value);
  }
  
  /**
   * Get preference
   */
  getPreference(key, defaultValue = null) {
    return this.get('preferences', key) ?? defaultValue;
  }
  
  /**
   * Get all preferences
   */
  getAllPreferences() {
    const ns = this.namespace('preferences');
    const prefs = {};
    for (const key of ns.keys()) {
      prefs[key] = ns.get(key);
    }
    return prefs;
  }
  
  // ============ Workflow State Methods ============
  
  /**
   * Save workflow state
   */
  saveWorkflowState(workflowId, state) {
    this.set('workflows', workflowId, {
      ...state,
      savedAt: Date.now(),
    });
  }
  
  /**
   * Get workflow state
   */
  getWorkflowState(workflowId) {
    return this.get('workflows', workflowId);
  }
  
  /**
   * Clear workflow state
   */
  clearWorkflowState(workflowId) {
    return this.delete('workflows', workflowId);
  }
  
  // ============ Persistence Methods ============
  
  /**
   * Save all data to disk
   */
  async save() {
    const saveData = {
      version: 1,
      savedAt: Date.now(),
      namespaces: {},
    };
    
    for (const [name, ns] of this.namespaces) {
      saveData.namespaces[name] = ns.toJSON();
    }
    
    const filePath = path.join(this.dataDir, 'phoenix-memory.json');
    const tempPath = filePath + '.tmp';
    
    try {
      await fs.writeFile(tempPath, JSON.stringify(saveData, null, 2));
      await fs.rename(tempPath, filePath);
      this.isDirty = false;
      this.lastSave = Date.now();
      return { success: true, savedAt: this.lastSave };
    } catch (error) {
      console.error('[PhoenixMemory] Save failed:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Load data from disk
   */
  _loadFromDisk() {
    const filePath = path.join(this.dataDir, 'phoenix-memory.json');
    
    try {
      if (existsSync(filePath)) {
        const data = JSON.parse(readFileSync(filePath, 'utf8'));
        
        if (data.version === 1 && data.namespaces) {
          for (const [name, nsData] of Object.entries(data.namespaces)) {
            const ns = this.namespace(name);
            ns.fromJSON(nsData);
          }
          console.log(`[PhoenixMemory] Loaded ${Object.keys(data.namespaces).length} namespaces from disk`);
        }
      }
    } catch (error) {
      console.error('[PhoenixMemory] Load failed:', error.message);
    }
  }
  
  /**
   * Run cleanup on all namespaces
   */
  cleanup() {
    let totalCleaned = 0;
    for (const ns of this.namespaces.values()) {
      totalCleaned += ns.cleanup();
    }
    if (totalCleaned > 0) {
      this.isDirty = true;
    }
    return totalCleaned;
  }
  
  /**
   * Get memory statistics
   */
  getStats() {
    const stats = {
      namespaces: {},
      totalEntries: 0,
      lastSave: this.lastSave,
      isDirty: this.isDirty,
    };
    
    for (const [name, ns] of this.namespaces) {
      stats.namespaces[name] = {
        size: ns.size(),
        ...ns.stats,
      };
      stats.totalEntries += ns.size();
    }
    
    return stats;
  }
  
  /**
   * Clear all data (careful!)
   */
  clearAll() {
    for (const ns of this.namespaces.values()) {
      ns.clear();
    }
    this.isDirty = true;
  }
  
  /**
   * Shutdown gracefully
   */
  async shutdown() {
    this._stopTimers();
    if (this.isDirty) {
      await this.save();
    }
  }
}

// Singleton instance
let memoryInstance = null;

/**
 * Get the Phoenix Memory singleton
 */
export function getPhoenixMemory() {
  if (!memoryInstance) {
    memoryInstance = new PhoenixMemory();
  }
  return memoryInstance;
}

/**
 * Convenience function to get device state
 */
export function getDeviceState(deviceId) {
  return getPhoenixMemory().getDeviceState(deviceId);
}

/**
 * Convenience function to set device state
 */
export function setDeviceState(deviceId, state) {
  return getPhoenixMemory().setDeviceState(deviceId, state);
}

export { PhoenixMemory, MemoryNamespace, MemoryEntry };
export default PhoenixMemory;
