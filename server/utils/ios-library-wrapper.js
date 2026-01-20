/**
 * iOS Library Wrapper
 * Provides compatibility layer for IOSLibrary interface
 * Wraps core/lib/ios.js functions to match expected API
 */

import { getIOSDevices, getDeviceInfo as getIOSDeviceInfo, isLibimobiledeviceAvailable } from '../../core/lib/ios.js';
import { commandExistsInPath } from './safe-exec.js';

class IOSLibrary {
  /**
   * Check if libimobiledevice tools are installed
   */
  isInstalled() {
    return commandExistsInPath('idevice_id') && 
           commandExistsInPath('ideviceinfo') &&
           commandExistsInPath('idevicediagnostics');
  }

  /**
   * Get connected iOS devices (synchronous wrapper for async function)
   */
  listDevices() {
    // Return a promise that will be awaited
    return this.getDevices();
  }

  /**
   * Get connected iOS devices
   */
  async getDevices() {
    try {
      if (!this.isInstalled()) {
        return {
          success: false,
          devices: [],
          error: 'libimobiledevice tools not installed'
        };
      }

      const devices = await getIOSDevices();
      return {
        success: true,
        devices: devices.map(d => ({
          udid: d.udid,
          name: d.name,
          state: d.state
        })),
        count: devices.length
      };
    } catch (error) {
      return {
        success: false,
        devices: [],
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Get device info
   */
  async getDeviceInfo(udid) {
    try {
      if (!this.isInstalled()) {
        return {
          success: false,
          error: 'libimobiledevice tools not installed'
        };
      }

      const info = await getIOSDeviceInfo(udid);
      return {
        success: true,
        info,
        udid
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const iosLibrary = new IOSLibrary();
export default iosLibrary;
