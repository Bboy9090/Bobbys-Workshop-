/**
 * iOS Provider
 * 
 * iOS device operations using libimobiledevice
 * 
 * @module core/lib/ios
 */

import { spawn } from 'child_process';

/**
 * Validate iOS device UDID format
 * 
 * @param {string} udid - Device UDID
 * @throws {Error} If UDID is invalid
 */
export function validateDeviceUDID(udid) {
  if (!udid || typeof udid !== 'string') {
    throw new Error('Device UDID is required and must be a string');
  }
  
  // iOS UDIDs are typically 40 characters (hex)
  if (!/^[a-f0-9]{25,40}$/i.test(udid)) {
    throw new Error(`Invalid iOS UDID format: ${udid}`);
  }
  
  return true;
}

/**
 * Execute idevice command safely
 * 
 * @param {string} command - idevice command (without 'idevice' prefix)
 * @param {Array<string>} args - Command arguments
 * @param {Object} options - Execution options
 * @param {string} options.udid - Device UDID (optional)
 * @param {number} options.timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<string>} Command output
 */
export async function executeIdeviceCommand(command, args = [], options = {}) {
  const { udid, timeout = 30000 } = options;
  
  // Build command array
  const ideviceArgs = [];
  if (udid) {
    ideviceArgs.push('-u', udid);
  }
  ideviceArgs.push(...args);
  
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timeoutId;
    
    // Spawn idevice process (no shell)
    const idevice = spawn(`idevice${command}`, ideviceArgs, {
      shell: false, // Critical: no shell execution
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Collect stdout
    idevice.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    // Collect stderr
    idevice.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Set timeout
    timeoutId = setTimeout(() => {
      idevice.kill();
      reject(new Error(`idevice command timeout after ${timeout}ms`));
    }, timeout);
    
    // Handle process completion
    idevice.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`idevice command failed with code ${code}: ${stderr || stdout}`));
      }
    });
    
    // Handle process errors
    idevice.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`idevice process error: ${error.message}`));
    });
  });
}

/**
 * Get list of connected iOS devices
 * 
 * @returns {Promise<Array>} Array of device objects
 */
export async function getIOSDevices() {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    
    const idevice = spawn('idevice_id', ['-l'], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    idevice.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    idevice.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    idevice.on('close', (code) => {
      if (code === 0 || stdout) {
        // Parse device UDIDs
        const devices = stdout
          .split('\n')
          .filter(line => line.trim())
          .map(udid => ({
            udid: udid.trim(),
            name: null, // Would need ideviceinfo to get name
            state: 'connected'
          }));
        
        resolve(devices);
      } else {
        reject(new Error(`Failed to get iOS devices: ${stderr}`));
      }
    });
    
    idevice.on('error', reject);
  });
}

/**
 * Get device information
 * 
 * @param {string} udid - Device UDID
 * @returns {Promise<Object>} Device information
 */
export async function getDeviceInfo(udid) {
  validateDeviceUDID(udid);
  
  try {
    const output = await executeIdeviceCommand('info', [], { udid });
    
    // Parse ideviceinfo output
    const info = {};
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        info[key] = value;
      }
    }
    
    return info;
  } catch (error) {
    throw new Error(`Failed to get device info: ${error.message}`);
  }
}

/**
 * Check if device is in DFU mode
 * 
 * @param {string} udid - Device UDID (optional, will auto-detect)
 * @returns {Promise<boolean>} True if device is in DFU mode
 */
export async function isDFUMode(udid = null) {
  try {
    // Try to detect DFU mode using ideviceenterrecovery or similar
    // This is a simplified check
    const devices = await getIOSDevices();
    
    // If no devices found but we expect one, might be in DFU
    // Actual DFU detection requires more sophisticated methods
    return false; // Placeholder
  } catch (error) {
    // Error might indicate DFU mode
    return true;
  }
}

/**
 * Check if libimobiledevice is available
 * 
 * @returns {Promise<boolean>} True if libimobiledevice is available
 */
export async function isLibimobiledeviceAvailable() {
  return new Promise((resolve) => {
    const idevice = spawn('idevice_id', ['-l'], {
      shell: false,
      stdio: 'ignore'
    });
    
    idevice.on('close', (code) => {
      resolve(code === 0 || code === 1); // Code 1 might mean no devices, but tool works
    });
    
    idevice.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Enter recovery mode
 * 
 * @param {string} udid - Device UDID
 * @returns {Promise<string>} Command output
 */
export async function enterRecoveryMode(udid) {
  validateDeviceUDID(udid);
  return executeIdeviceCommand('enterrecovery', [], { udid, timeout: 30000 });
}

/**
 * Exit recovery mode
 * 
 * @param {string} udid - Device UDID
 * @returns {Promise<string>} Command output
 */
export async function exitRecoveryMode(udid) {
  validateDeviceUDID(udid);
  return executeIdeviceCommand('exitrecovery', [], { udid, timeout: 30000 });
}
