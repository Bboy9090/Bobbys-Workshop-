/**
 * Universal Legend Status - Device Abstraction Layer
 * Unified device interface across all platforms and protocols
 * 
 * Features:
 * - Unified device representation
 * - Protocol abstraction (ADB, Fastboot, iOS, WebUSB)
 * - Platform-agnostic device operations
 * - Automatic protocol selection
 */

class UniversalDevice {
  constructor(data) {
    // Core identifiers
    this.id = data.id || data.deviceUid || data.serial || this.generateId();
    this.serial = data.serial || data.deviceUid || this.id;
    this.udid = data.udid || null; // iOS specific
    
    // Platform information
    this.platform = data.platform || data.platformHint || 'unknown';
    this.brand = data.brand || data.manufacturer || null;
    this.model = data.model || data.product || null;
    
    // Connection information
    this.connectionType = data.connectionType || data.protocol || 'unknown';
    this.mode = data.mode || data.state || 'unknown';
    this.status = data.status || 'connected';
    
    // Capabilities
    this.capabilities = data.capabilities || {};
    this.protocols = data.protocols || [this.connectionType];
    
    // Metadata
    this.metadata = data.metadata || {};
    this.confidence = data.confidence || 0.5;
    this.sources = data.sources || [this.connectionType];
    
    // Timestamps
    this.firstSeen = data.firstSeen || Date.now();
    this.lastSeen = data.lastSeen || Date.now();
    
    // Protocol-specific data
    this.protocolData = {
      adb: data.adb || null,
      fastboot: data.fastboot || null,
      ios: data.ios || null,
      webusb: data.webusb || null
    };
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get unified device representation
   */
  toUniversal() {
    return {
      id: this.id,
      serial: this.serial,
      udid: this.udid,
      platform: this.platform,
      brand: this.brand,
      model: this.model,
      connectionType: this.connectionType,
      mode: this.mode,
      status: this.status,
      capabilities: this.capabilities,
      protocols: this.protocols,
      confidence: this.confidence,
      sources: this.sources,
      firstSeen: this.firstSeen,
      lastSeen: this.lastSeen
    };
  }

  /**
   * Check if device supports protocol
   */
  supportsProtocol(protocol) {
    return this.protocols.includes(protocol) || 
           this.connectionType === protocol ||
           (protocol === 'adb' && this.platform === 'android') ||
           (protocol === 'ios' && this.platform === 'ios');
  }

  /**
   * Get best protocol for operation
   */
  getBestProtocol(operation) {
    // Protocol priority based on operation
    const protocolPriority = {
      'flash': ['fastboot', 'odin', 'edl', 'mtk', 'adb'],
      'unlock': ['fastboot', 'adb'],
      'root': ['adb'],
      'jailbreak': ['ios'],
      'backup': ['adb', 'ios'],
      'restore': ['adb', 'ios', 'fastboot'],
      'info': ['adb', 'ios', 'fastboot'],
      'reboot': ['adb', 'fastboot', 'ios']
    };

    const priorities = protocolPriority[operation] || ['adb', 'fastboot', 'ios'];
    
    for (const protocol of priorities) {
      if (this.supportsProtocol(protocol)) {
        return protocol;
      }
    }

    return this.connectionType;
  }

  /**
   * Merge with another device (for correlation)
   */
  merge(other) {
    // Merge protocols
    this.protocols = [...new Set([...this.protocols, ...other.protocols])];
    
    // Merge sources
    this.sources = [...new Set([...this.sources, ...other.sources])];
    
    // Update confidence (higher if multiple sources)
    if (other.sources && other.sources.length > 0) {
      this.confidence = Math.min(1.0, this.confidence + 0.1 * other.sources.length);
    }
    
    // Merge metadata
    this.metadata = { ...this.metadata, ...other.metadata };
    
    // Update last seen
    this.lastSeen = Math.max(this.lastSeen, other.lastSeen || Date.now());
    
    // Merge protocol data
    for (const [protocol, data] of Object.entries(other.protocolData || {})) {
      if (data) {
        this.protocolData[protocol] = { ...this.protocolData[protocol], ...data };
      }
    }
    
    return this;
  }
}

/**
 * Device Abstraction Manager
 */
class DeviceAbstractionManager {
  constructor() {
    this.devices = new Map();
    this.protocolAdapters = new Map();
  }

  /**
   * Register protocol adapter
   */
  registerAdapter(protocol, adapter) {
    this.protocolAdapters.set(protocol, adapter);
  }

  /**
   * Create universal device from protocol-specific data
   */
  createDevice(protocol, data) {
    const adapter = this.protocolAdapters.get(protocol);
    if (adapter) {
      return adapter.normalize(data);
    }
    
    // Fallback to generic device
    return new UniversalDevice({
      ...data,
      connectionType: protocol,
      platform: this.detectPlatform(protocol, data)
    });
  }

  /**
   * Detect platform from protocol and data
   */
  detectPlatform(protocol, data) {
    if (protocol === 'ios' || protocol === 'dfu' || data.udid) {
      return 'ios';
    }
    if (protocol === 'adb' || protocol === 'fastboot' || data.serial) {
      return 'android';
    }
    return data.platform || 'unknown';
  }

  /**
   * Add or update device
   */
  addDevice(device) {
    const universalDevice = device instanceof UniversalDevice 
      ? device 
      : new UniversalDevice(device);
    
    const existing = this.devices.get(universalDevice.id);
    if (existing) {
      existing.merge(universalDevice);
      return existing;
    }
    
    this.devices.set(universalDevice.id, universalDevice);
    return universalDevice;
  }

  /**
   * Get device by ID
   */
  getDevice(id) {
    return this.devices.get(id);
  }

  /**
   * Get all devices
   */
  getAllDevices() {
    return Array.from(this.devices.values()).map(d => d.toUniversal());
  }

  /**
   * Remove device
   */
  removeDevice(id) {
    return this.devices.delete(id);
  }

  /**
   * Find devices by criteria
   */
  findDevices(criteria) {
    return Array.from(this.devices.values())
      .filter(device => {
        for (const [key, value] of Object.entries(criteria)) {
          if (device[key] !== value) {
            return false;
          }
        }
        return true;
      })
      .map(d => d.toUniversal());
  }
}

// Protocol adapters
const protocolAdapters = {
  adb: {
    normalize: (data) => {
      return new UniversalDevice({
        id: data.serial,
        serial: data.serial,
        platform: 'android',
        brand: data.manufacturer || data.brand,
        model: data.model || data.product,
        connectionType: 'adb',
        mode: data.state || 'normal',
        status: data.state === 'device' ? 'connected' : 'offline',
        capabilities: {
          shell: true,
          fileTransfer: true,
          install: true,
          backup: true
        },
        protocols: ['adb'],
        metadata: data,
        confidence: 0.9
      });
    }
  },
  
  fastboot: {
    normalize: (data) => {
      return new UniversalDevice({
        id: data.serial,
        serial: data.serial,
        platform: 'android',
        connectionType: 'fastboot',
        mode: 'fastboot',
        status: 'connected',
        capabilities: {
          flash: true,
          unlock: true,
          reboot: true
        },
        protocols: ['fastboot'],
        metadata: data,
        confidence: 0.9
      });
    }
  },
  
  ios: {
    normalize: (data) => {
      return new UniversalDevice({
        id: data.udid || data.serial,
        serial: data.serial,
        udid: data.udid,
        platform: 'ios',
        brand: 'Apple',
        model: data.name || data.productType,
        connectionType: 'ios',
        mode: data.state || 'normal',
        status: 'connected',
        capabilities: {
          backup: true,
          restore: true,
          info: true
        },
        protocols: ['ios'],
        metadata: data,
        confidence: 0.9
      });
    }
  },
  
  webusb: {
    normalize: (data) => {
      return new UniversalDevice({
        id: data.deviceUid || data.id,
        serial: data.serial,
        platform: data.platformHint || 'unknown',
        connectionType: 'webusb',
        mode: data.mode || 'unknown',
        status: 'connected',
        capabilities: {},
        protocols: ['webusb'],
        metadata: data,
        confidence: data.confidence || 0.5
      });
    }
  }
};

// Singleton instance
const deviceManager = new DeviceAbstractionManager();

// Register protocol adapters
for (const [protocol, adapter] of Object.entries(protocolAdapters)) {
  deviceManager.registerAdapter(protocol, adapter);
}

export default deviceManager;
export { UniversalDevice };
