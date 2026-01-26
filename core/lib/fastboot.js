// Fastboot Library - Fastboot operations for Android bootloader mode
// Provides safe wrappers around fastboot commands

import { execSync } from 'child_process';

function safeExec(cmd, options = {}) {
  try {
    return {
      success: true,
      stdout: execSync(cmd, { 
        encoding: 'utf-8', 
        timeout: options.timeout || 30000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        ...options
      }).trim()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr?.toString() || ''
    };
  }
}

function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { 
      stdio: 'ignore', 
      timeout: 2000,
      windowsHide: true
    });
    return true;
  } catch {
    return false;
  }
}

const FastbootLibrary = {
  /**
   * Check if Fastboot is installed
   */
  isInstalled() {
    return commandExists('fastboot');
  },

  /**
   * List connected devices in fastboot mode
   */
  listDevices() {
    if (!this.isInstalled()) {
      return { success: false, error: 'Fastboot not installed', devices: [] };
    }
    
    const result = safeExec('fastboot devices');
    if (!result.success) {
      return { ...result, devices: [] };
    }
    
    const lines = result.stdout.split('\n').filter(l => l.trim());
    const devices = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        serial: parts[0],
        mode: parts[1] || 'fastboot'
      };
    }).filter(d => d.serial);
    
    return { success: true, devices };
  },

  /**
   * Execute fastboot command for a specific device
   * @param {string} serial - Device serial number
   * @param {string} command - Fastboot command to execute (without 'fastboot' prefix)
   */
  executeCommand(serial, command) {
    if (!this.isInstalled()) {
      return { success: false, error: 'Fastboot not installed' };
    }
    
    // Sanitize command to prevent injection
    if (command.includes(';') || command.includes('|') || command.includes('&')) {
      return { success: false, error: 'Command contains invalid characters' };
    }
    
    return safeExec(`fastboot -s ${serial} ${command}`, { timeout: 60000 });
  },

  /**
   * Get device variable
   * @param {string} serial - Device serial number
   * @param {string} variable - Variable name (e.g., 'product', 'unlocked')
   */
  getVar(serial, variable) {
    const result = safeExec(`fastboot -s ${serial} getvar ${variable} 2>&1`);
    if (!result.success) {
      return result;
    }
    
    // fastboot getvar outputs to stderr, value is after the colon
    const match = result.stdout.match(new RegExp(`${variable}:\\s*(.+)`));
    return {
      success: true,
      variable,
      value: match ? match[1].trim() : null
    };
  },

  /**
   * Get device information
   * @param {string} serial - Device serial number
   */
  getDeviceInfo(serial) {
    const variables = ['product', 'variant', 'version-bootloader', 'serialno', 'secure', 'unlocked'];
    const info = {};
    
    for (const variable of variables) {
      const result = this.getVar(serial, variable);
      if (result.success) {
        info[variable] = result.value;
      }
    }
    
    return {
      success: true,
      info,
      bootloaderUnlocked: info.unlocked === 'yes' || info.unlocked === 'true',
      isSecure: info.secure === 'yes' || info.secure === 'true'
    };
  },

  /**
   * Flash partition
   * @param {string} serial - Device serial number
   * @param {string} partition - Partition name (e.g., 'boot', 'system')
   * @param {string} imagePath - Path to the image file
   */
  flash(serial, partition, imagePath) {
    // Critical partitions require extra caution
    const criticalPartitions = ['bootloader', 'radio', 'aboot', 'sbl1'];
    if (criticalPartitions.includes(partition)) {
      console.warn(`Warning: Flashing critical partition: ${partition}`);
    }
    
    return this.executeCommand(serial, `flash ${partition} "${imagePath}"`);
  },

  /**
   * Reboot device
   * @param {string} serial - Device serial number
   * @param {string} mode - 'system', 'bootloader', or 'recovery'
   */
  reboot(serial, mode = 'system') {
    switch (mode) {
      case 'system':
        return this.executeCommand(serial, 'reboot');
      case 'bootloader':
        return this.executeCommand(serial, 'reboot-bootloader');
      case 'recovery':
        return this.executeCommand(serial, 'reboot recovery');
      default:
        return { success: false, error: 'Invalid reboot mode' };
    }
  },

  /**
   * Initiate OEM unlock
   * @param {string} serial - Device serial number
   */
  oemUnlock(serial) {
    return this.executeCommand(serial, 'oem unlock');
  },

  /**
   * Initiate flashing unlock
   * @param {string} serial - Device serial number
   */
  flashingUnlock(serial) {
    return this.executeCommand(serial, 'flashing unlock');
  }
};

export default FastbootLibrary;
