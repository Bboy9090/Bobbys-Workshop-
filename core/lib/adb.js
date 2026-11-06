// ADB Library - Android Debug Bridge operations
// Provides safe wrappers around ADB commands

import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SERIAL_REGEX = /^[A-Za-z0-9._:-]{3,64}$/;

/**
 * Validate device serial number format
 * @param {string} serial - Device serial number
 * @returns {boolean} True if valid
 */
export function validateDeviceSerial(serial) {
  if (!serial || typeof serial !== 'string') {
    throw new Error('Device serial is required and must be a string');
  }
  if (!SERIAL_REGEX.test(serial)) {
    throw new Error(`Invalid device serial format: ${serial}`);
  }
  return true;
}

/**
 * Execute ADB command safely using spawn (no shell)
 * @param {string} serial - Device serial number
 * @param {string} command - ADB command (shell, pull, push, etc.)
 * @param {Array<string>} args - Command arguments
 * @param {Object} options - Execution options
 * @returns {Promise<string>} Command stdout
 */
export async function executeAdbCommand(serial, command, args = [], options = {}) {
  const { timeout = 30000 } = options;
  validateDeviceSerial(serial);

  const adbArgs = ['-s', serial, command, ...args];

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const adb = spawn('adb', adbArgs, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    adb.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    adb.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      adb.kill();
      reject(new Error(`ADB command timeout after ${timeout}ms`));
    }, timeout);

    adb.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`ADB command failed with code ${code}: ${stderr || stdout}`));
      }
    });

    adb.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`ADB process error: ${error.message}`));
    });
  });
}

async function safeExec(cmd, options = {}) {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: options.timeout ?? 10000,
      ...options,
    });
    return {
      success: true,
      stdout: (stdout ?? '').toString().trim(),
      stderr: (stderr ?? '').toString().trim(),
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || String(error),
      stdout: (error?.stdout ?? '').toString().trim(),
      stderr: (error?.stderr ?? '').toString().trim(),
    };
  }
}

const ADBLibrary = {
  /**
   * Check if ADB is available
   */
  async isAvailable() {
    try {
      const { stdout, stderr } = await execAsync('adb version', { windowsHide: true });
      const version = (stdout || stderr || '').toString().trim();
      return { success: true, version };
    } catch (error) {
      const message = error?.message ? `: ${error.message}` : '';
      return { success: false, error: `ADB not found${message}` };
    }
  },

  /**
   * Check if ADB is installed
   */
  async isInstalled() {
    const result = await this.isAvailable();
    return result.success;
  },

  /**
   * Get ADB version
   */
  async getVersion() {
    const result = await this.isAvailable();
    if (!result.success) {
      return { success: false, error: 'ADB not installed' };
    }
    return { success: true, stdout: result.version };
  },

  /**
   * List connected devices
   */
  async listDevices() {
    const result = await safeExec('adb devices -l');
    if (!result.success) {
      return { success: false, error: result.error, devices: [] };
    }

    const lines = result.stdout.split('\n').slice(1).filter((line) => line.trim());
    const devices = lines
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const serial = parts[0];
        const state = parts[1];
        const infoStr = parts.slice(2).join(' ');

        return {
          serial,
          state,
          product: infoStr.match(/product:(\S+)/)?.[1] || null,
          model: infoStr.match(/model:(\S+)/)?.[1] || null,
          device: infoStr.match(/device:(\S+)/)?.[1] || null
        };
      })
      .filter((d) => d.serial && d.state);

    return { success: true, devices };
  },

  /**
   * Execute ADB command for a specific device
   * @param {string} serial - Device serial number
   * @param {string} command - ADB command to execute (without 'adb' prefix)
   */
  async executeCommand(serial, command) {
    // Sanitize command to prevent injection
    if (command.includes(';') || command.includes('|') || command.includes('&')) {
      return { success: false, error: 'Command contains invalid characters' };
    }

    const adbCommand = serial ? `adb -s ${serial} ${command}` : `adb ${command}`;
    return await safeExec(adbCommand, { timeout: 30000 });
  },

  /**
   * Execute shell command on device
   * @param {string} serial - Device serial number
   * @param {string} shellCommand - Shell command to execute
   */
  async shell(serial, shellCommand) {
    return await this.executeCommand(serial, `shell ${shellCommand}`);
  },

  /**
   * Get device properties
   * @param {string} serial - Device serial number
   */
  async getProperties(serial) {
    const result = await this.shell(serial, 'getprop');
    if (!result.success) {
      return result;
    }

    const props = {};
    const lines = result.stdout.split('\n');
    lines.forEach(line => {
      const match = line.match(/\[(.*?)\]:\s*\[(.*?)\]/);
      if (match) {
        props[match[1]] = match[2];
      }
    });

    return { success: true, properties: props };
  },

  /**
   * Get device mode (normal, recovery, sideload, etc.)
   * @param {string} serial - Device serial number
   */
  async getDeviceMode(serial) {
    const devices = await this.listDevices();
    if (!devices.success) {
      return devices;
    }

    const device = devices.devices.find(d => d.serial === serial);
    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    let mode = 'unknown';
    switch (device.state) {
      case 'device':
        mode = 'android_os';
        break;
      case 'recovery':
        mode = 'recovery';
        break;
      case 'sideload':
        mode = 'sideload';
        break;
      case 'unauthorized':
        mode = 'unauthorized';
        break;
      case 'offline':
        mode = 'offline';
        break;
    }

    return { success: true, mode, state: device.state };
  },

  /**
   * Reboot device
   * @param {string} serial - Device serial number
   * @param {string} mode - Reboot mode: 'system', 'recovery', 'bootloader'
   */
  async reboot(serial, mode = 'system') {
    const validModes = ['system', 'recovery', 'bootloader'];
    if (!validModes.includes(mode)) {
      return { success: false, error: `Invalid mode. Must be one of: ${validModes.join(', ')}` };
    }

    const command = mode === 'system' ? 'reboot' : `reboot ${mode}`;
    return await this.executeCommand(serial, command);
  },

  /**
   * Retrieve basic device info
   */
  async getDeviceInfo(serial) {
    const manufacturer = (await this.executeCommand(serial, 'shell getprop ro.product.manufacturer')).stdout || '';
    const model = (await this.executeCommand(serial, 'shell getprop ro.product.model')).stdout || '';
    const androidVersion = (await this.executeCommand(serial, 'shell getprop ro.build.version.release')).stdout || '';
    const deviceSerial = (await this.executeCommand(serial, 'shell getprop ro.serialno')).stdout || '';

    return {
      success: true,
      manufacturer: manufacturer.trim(),
      model: model.trim(),
      androidVersion: androidVersion.trim(),
      deviceSerial: deviceSerial.trim(),
    };
  },

  /**
   * Best-effort FRP status heuristic
   */
  async checkFRPStatus(serial) {
    const result = await this.executeCommand(serial, 'shell settings get secure android_id');
    const androidId = (result.stdout || '').trim();

    if (!result.success || !androidId) {
      return { success: false, error: 'Unable to determine FRP status' };
    }

    const hasFRP = androidId.length < 10;

    return {
      success: true,
      hasFRP,
      androidId,
      confidence: hasFRP ? 'high' : 'low',
    };
  }
};

export default ADBLibrary;
