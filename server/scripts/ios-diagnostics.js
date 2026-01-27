#!/usr/bin/env node
/**
 * iOS Diagnostics Script
 * Automated device diagnostics using libimobiledevice
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class IOSDiagnostics {
  /**
   * Check if libimobiledevice tools are available
   */
  async checkToolsAvailable() {
    try {
      await execAsync('which ideviceinfo');
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: 'libimobiledevice not found. Please install: brew install libimobiledevice (macOS) or apt-get install libimobiledevice-utils (Linux)' 
      };
    }
  }

  /**
   * List connected iOS devices
   */
  async listDevices() {
    try {
      const { stdout } = await execAsync('idevice_id -l');
      const udids = stdout.split('\n').filter(line => line.trim());
      
      const devices = [];
      for (const udid of udids) {
        const info = await this.getDeviceInfo(udid);
        if (info.success) {
          devices.push({
            udid,
            ...info.info
          });
        }
      }
      
      return { success: true, devices };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get device information
   */
  async getDeviceInfo(udid) {
    try {
      const { stdout } = await execAsync(`ideviceinfo -u ${udid}`);
      const info = {};
      
      stdout.split('\n').forEach(line => {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          info[match[1].trim()] = match[2].trim();
        }
      });

      return {
        success: true,
        info: {
          deviceName: info['DeviceName'] || 'N/A',
          productType: info['ProductType'] || 'N/A',
          productVersion: info['ProductVersion'] || 'N/A',
          buildVersion: info['BuildVersion'] || 'N/A',
          serialNumber: info['SerialNumber'] || 'N/A',
          modelNumber: info['ModelNumber'] || 'N/A'
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get battery information
   */
  async getBatteryInfo(udid) {
    try {
      const { stdout } = await execAsync(`ideviceinfo -u ${udid} -q com.apple.mobile.battery`);
      const battery = {};
      
      stdout.split('\n').forEach(line => {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          battery[match[1].trim()] = match[2].trim();
        }
      });

      return {
        success: true,
        battery: {
          batteryCurrentCapacity: battery['BatteryCurrentCapacity'] || 'N/A',
          batteryIsCharging: battery['BatteryIsCharging'] || 'N/A',
          externalChargeCapable: battery['ExternalChargeCapable'] || 'N/A'
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Enter DFU mode (requires user interaction)
   */
  async enterDFUMode(udid) {
    return {
      success: true,
      message: 'To enter DFU mode manually:\n1. Connect device\n2. Power off device\n3. Hold Power + Home (or Volume Down) for 10 seconds\n4. Release Power, keep holding Home/Volume Down for 5 more seconds',
      requiresManualSteps: true
    };
  }

  /**
   * Enter Recovery mode
   */
  async enterRecoveryMode(udid) {
    try {
      await execAsync(`ideviceenterrecovery ${udid}`);
      return { success: true, message: 'Device entering recovery mode' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Exit Recovery mode
   */
  async exitRecoveryMode(udid) {
    try {
      await execAsync(`irecovery -u ${udid} -n`);
      return { success: true, message: 'Device exiting recovery mode' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Reboot device
   */
  async rebootDevice(udid) {
    try {
      await execAsync(`idevicediagnostics -u ${udid} restart`);
      return { success: true, message: 'Device rebooting' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Run comprehensive diagnostics
   */
  async runComprehensiveDiagnostics(udid) {
    const results = {
      timestamp: new Date().toISOString(),
      udid
    };

    // Get device info
    const info = await this.getDeviceInfo(udid);
    if (info.success) {
      results.deviceInfo = info.info;
    }

    // Get battery info
    const battery = await this.getBatteryInfo(udid);
    if (battery.success) {
      results.battery = battery.battery;
    }

    return { success: true, diagnostics: results };
  }
}

export default IOSDiagnostics;
