/**
 * ADB Library Wrapper
 * Provides compatibility layer for ADBLibrary interface
 * Wraps core/lib/adb.js functions to match expected API
 */

import { executeAdbCommand, getDevices, isAdbAvailable, validateDeviceSerial } from '../../core/lib/adb.js';
import { commandExistsInPath } from './safe-exec.js';

class ADBLibrary {
  /**
   * Execute ADB shell command
   */
  async shell(serial, command) {
    try {
      validateDeviceSerial(serial);
      const output = await executeAdbCommand(serial, 'shell', [command]);
      return {
        success: true,
        stdout: output,
        stderr: '',
        exitCode: 0
      };
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error.message,
        exitCode: 1,
        error: error.message
      };
    }
  }

  /**
   * List connected devices
   */
  async listDevices() {
    try {
      const devices = await getDevices();
      return {
        success: true,
        devices: devices.map(d => ({
          serial: d.serial,
          state: d.state,
          info: d.info
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
   * Check if ADB is installed
   */
  async isInstalled() {
    const available = await isAdbAvailable();
    const inPath = commandExistsInPath('adb');
    return available && inPath;
  }

  /**
   * Get devices (alias for listDevices)
   */
  async getDevices() {
    return this.listDevices();
  }

  /**
   * Check FRP status (placeholder - needs implementation)
   */
  async checkFRPStatus(serial) {
    try {
      // Get Android ID
      const androidIdResult = await this.shell(serial, 'settings get secure android_id');
      const androidId = androidIdResult.stdout?.trim() || '';
      
      // Get FRP properties
      const propResult = await this.shell(serial, 'getprop ro.frp.pst');
      const frpProp = propResult.stdout?.trim() || '';
      
      const hasFRP = androidId.length < 16 || frpProp.length > 0;
      
      return {
        success: true,
        hasFRP,
        confidence: hasFRP ? 0.8 : 0.2,
        androidId,
        properties: {
          'ro.frp.pst': frpProp || null
        }
      };
    } catch (error) {
      return {
        success: false,
        hasFRP: false,
        confidence: 0,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const adbLibrary = new ADBLibrary();
export default adbLibrary;
