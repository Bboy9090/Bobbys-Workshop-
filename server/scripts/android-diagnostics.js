#!/usr/bin/env node
/**
 * Android Diagnostics Script
 * Automated device diagnostics using ADB
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class AndroidDiagnostics {
  /**
   * Check if ADB is available
   */
  async checkAdbAvailable() {
    try {
      const { stdout } = await execAsync('adb version');
      return { success: true, version: stdout.trim() };
    } catch (error) {
      return { success: false, error: 'ADB not found. Please install Android SDK Platform Tools.' };
    }
  }

  /**
   * List connected Android devices
   */
  async listDevices() {
    try {
      const { stdout } = await execAsync('adb devices -l');
      const lines = stdout.split('\n').slice(1).filter(line => line.trim());
      
      const devices = lines.map(line => {
        const parts = line.split(/\s+/);
        return {
          serial: parts[0],
          state: parts[1],
          info: parts.slice(2).join(' ')
        };
      }).filter(d => d.state !== 'offline');
      
      return { success: true, devices };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get device properties
   */
  async getDeviceProperties(serial) {
    try {
      const props = {};
      const propKeys = [
        'ro.product.brand',
        'ro.product.model',
        'ro.product.device',
        'ro.build.version.release',
        'ro.build.version.sdk',
        'ro.build.version.security_patch',
        'ro.bootloader',
        'gsm.version.baseband',
        'ro.serialno'
      ];

      for (const key of propKeys) {
        try {
          const { stdout } = await execAsync(`adb -s ${serial} shell getprop ${key}`);
          props[key] = stdout.trim();
        } catch (err) {
          props[key] = 'N/A';
        }
      }

      return { success: true, properties: props };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get battery information
   */
  async getBatteryInfo(serial) {
    try {
      const { stdout } = await execAsync(`adb -s ${serial} shell dumpsys battery`);
      const battery = {};
      
      stdout.split('\n').forEach(line => {
        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (match) {
          battery[match[1].trim()] = match[2].trim();
        }
      });

      return {
        success: true,
        battery: {
          level: battery['level'] || 'N/A',
          status: battery['status'] || 'N/A',
          health: battery['health'] || 'N/A',
          temperature: battery['temperature'] || 'N/A',
          voltage: battery['voltage'] || 'N/A'
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get device state (bootloader mode, recovery, etc.)
   */
  async getDeviceState(serial) {
    try {
      const { stdout } = await execAsync(`adb -s ${serial} get-state`);
      return { success: true, state: stdout.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Enter Fastboot mode
   */
  async enterFastboot(serial) {
    try {
      await execAsync(`adb -s ${serial} reboot bootloader`);
      return { success: true, message: 'Device rebooting to fastboot mode' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Enter Recovery mode
   */
  async enterRecovery(serial) {
    try {
      await execAsync(`adb -s ${serial} reboot recovery`);
      return { success: true, message: 'Device rebooting to recovery mode' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Reboot device
   */
  async rebootDevice(serial) {
    try {
      await execAsync(`adb -s ${serial} reboot`);
      return { success: true, message: 'Device rebooting' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Run comprehensive diagnostics
   */
  async runComprehensiveDiagnostics(serial) {
    const results = {
      timestamp: new Date().toISOString(),
      serial
    };

    // Get device properties
    const props = await this.getDeviceProperties(serial);
    if (props.success) {
      results.properties = props.properties;
    }

    // Get battery info
    const battery = await this.getBatteryInfo(serial);
    if (battery.success) {
      results.battery = battery.battery;
    }

    // Get device state
    const state = await this.getDeviceState(serial);
    if (state.success) {
      results.state = state.state;
    }

    return { success: true, diagnostics: results };
  }
}

export default AndroidDiagnostics;
