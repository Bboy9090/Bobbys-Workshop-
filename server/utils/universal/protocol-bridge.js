/**
 * Universal Legend Status - Protocol Bridge
 * Translates between different device protocols (ADB, Fastboot, iOS, WebUSB)
 * 
 * Features:
 * - Protocol translation
 * - Operation mapping
 * - Automatic protocol selection
 * - Fallback mechanisms
 */

import deviceManager from './device-abstraction.js';

class ProtocolBridge {
  constructor() {
    this.operationMappings = new Map();
    this.initializeMappings();
  }

  /**
   * Initialize operation mappings
   */
  initializeMappings() {
    // Flash operations
    this.operationMappings.set('flash', {
      adb: 'adb sideload',
      fastboot: 'fastboot flash',
      odin: 'odin flash',
      mtk: 'sp flash tool',
      edl: 'edl flash',
      ios: 'idevicerestore'
    });

    // Reboot operations
    this.operationMappings.set('reboot', {
      adb: 'adb reboot',
      fastboot: 'fastboot reboot',
      ios: 'idevice restart'
    });

    // Unlock operations
    this.operationMappings.set('unlock', {
      fastboot: 'fastboot oem unlock',
      adb: 'adb shell unlock'
    });

    // Info operations
    this.operationMappings.set('info', {
      adb: 'adb shell getprop',
      fastboot: 'fastboot getvar',
      ios: 'ideviceinfo'
    });

    // Backup operations
    this.operationMappings.set('backup', {
      adb: 'adb backup',
      ios: 'idevicebackup'
    });

    // Restore operations
    this.operationMappings.set('restore', {
      adb: 'adb restore',
      ios: 'idevicerestore'
    });
  }

  /**
   * Translate operation to protocol-specific command
   */
  translateOperation(operation, protocol, device, options = {}) {
    const mapping = this.operationMappings.get(operation);
    if (!mapping) {
      throw new Error(`Operation ${operation} not supported`);
    }

    const protocolCommand = mapping[protocol];
    if (!protocolCommand) {
      throw new Error(`Operation ${operation} not supported for protocol ${protocol}`);
    }

    return {
      operation,
      protocol,
      command: protocolCommand,
      device: device.serial || device.id,
      options
    };
  }

  /**
   * Execute operation on device with automatic protocol selection
   */
  async executeOperation(device, operation, options = {}) {
    // Get best protocol for operation
    const protocol = device.getBestProtocol ? device.getBestProtocol(operation) : 'adb';
    
    // Check if device supports protocol
    if (!device.supportsProtocol(protocol)) {
      // Try fallback protocols
      const fallbacks = this.getFallbackProtocols(operation, protocol);
      for (const fallback of fallbacks) {
        if (device.supportsProtocol(fallback)) {
          return this.executeWithProtocol(device, operation, fallback, options);
        }
      }
      throw new Error(`Device does not support protocol ${protocol} for operation ${operation}`);
    }

    return this.executeWithProtocol(device, operation, protocol, options);
  }

  /**
   * Get fallback protocols for operation
   */
  getFallbackProtocols(operation, preferredProtocol) {
    const fallbacks = {
      'flash': ['fastboot', 'adb', 'odin', 'mtk', 'edl'],
      'reboot': ['adb', 'fastboot', 'ios'],
      'unlock': ['fastboot', 'adb'],
      'info': ['adb', 'fastboot', 'ios'],
      'backup': ['adb', 'ios'],
      'restore': ['adb', 'ios', 'fastboot']
    };

    const protocols = fallbacks[operation] || ['adb', 'fastboot', 'ios'];
    return protocols.filter(p => p !== preferredProtocol);
  }

  /**
   * Execute operation with specific protocol
   */
  async executeWithProtocol(device, operation, protocol, options) {
    const command = this.translateOperation(operation, protocol, device, options);
    
    // Get protocol adapter
    const adapter = this.getProtocolAdapter(protocol);
    if (!adapter) {
      throw new Error(`Protocol adapter not found for ${protocol}`);
    }

    // Execute via adapter
    return adapter.execute(command);
  }

  /**
   * Get protocol adapter
   */
  getProtocolAdapter(protocol) {
    // This would integrate with actual protocol implementations
    // For now, return a mock adapter
    return {
      execute: async (command) => {
        return {
          success: true,
          protocol: command.protocol,
          operation: command.operation,
          command: command.command,
          device: command.device,
          result: 'Operation executed successfully'
        };
      }
    };
  }

  /**
   * Convert device between protocols
   */
  convertDevice(device, targetProtocol) {
    if (device.supportsProtocol(targetProtocol)) {
      return device;
    }

    // Try to find equivalent device in target protocol
    const universalDevice = deviceManager.getDevice(device.id);
    if (universalDevice && universalDevice.supportsProtocol(targetProtocol)) {
      return universalDevice;
    }

    throw new Error(`Cannot convert device to protocol ${targetProtocol}`);
  }

  /**
   * Get supported protocols for operation
   */
  getSupportedProtocols(operation) {
    const mapping = this.operationMappings.get(operation);
    if (!mapping) {
      return [];
    }
    return Object.keys(mapping);
  }
}

// Singleton instance
const protocolBridge = new ProtocolBridge();

export default protocolBridge;
