/**
 * ADB Provider
 * 
 * Safe ADB command execution with validation and timeout enforcement
 * 
 * @module core/lib/adb
 */

import { spawn } from 'child_process';
import { promisify } from 'util';

// Serial number validation regex
const SERIAL_REGEX = /^[A-Za-z0-9]{6,20}$/;

/**
 * Validate device serial number format
 * 
 * @param {string} serial - Device serial number
 * @throws {Error} If serial is invalid
 */
export function validateDeviceSerial(serial) {
  if (!serial || typeof serial !== 'string') {
    throw new Error('Device serial is required and must be a string');
  }
  
  if (!SERIAL_REGEX.test(serial)) {
    throw new Error(`Invalid device serial format: ${serial}. Must be 6-20 alphanumeric characters.`);
  }
  
  return true;
}

/**
 * Execute ADB command safely
 * 
 * @param {string} serial - Device serial number
 * @param {string} command - ADB command (shell, pull, push, etc.)
 * @param {Array<string>} args - Command arguments
 * @param {Object} options - Execution options
 * @param {number} options.timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<string>} Command output
 */
export async function executeAdbCommand(serial, command, args = [], options = {}) {
  const { timeout = 30000 } = options;
  
  // Validate serial
  validateDeviceSerial(serial);
  
  // Build command array (no shell execution)
  const adbArgs = ['-s', serial, command, ...args];
  
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timeoutId;
    
    // Spawn ADB process (no shell)
    const adb = spawn('adb', adbArgs, {
      shell: false, // Critical: no shell execution
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Collect stdout
    adb.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    // Collect stderr
    adb.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Set timeout
    timeoutId = setTimeout(() => {
      adb.kill();
      reject(new Error(`ADB command timeout after ${timeout}ms`));
    }, timeout);
    
    // Handle process completion
    adb.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`ADB command failed with code ${code}: ${stderr || stdout}`));
      }
    });
    
    // Handle process errors
    adb.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`ADB process error: ${error.message}`));
    });
  });
}

/**
 * Get list of connected devices
 * 
 * @returns {Promise<Array>} Array of device objects
 */
export async function getDevices() {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    
    const adb = spawn('adb', ['devices', '-l'], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    adb.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    adb.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    adb.on('close', (code) => {
      if (code === 0) {
        // Parse devices
        const devices = [];
        const lines = stdout.split('\n').filter(line => line.trim() && !line.startsWith('List'));
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            devices.push({
              serial: parts[0],
              state: parts[1],
              info: parts.slice(2).join(' ')
            });
          }
        }
        
        resolve(devices);
      } else {
        reject(new Error(`Failed to get devices: ${stderr}`));
      }
    });
    
    adb.on('error', reject);
  });
}

/**
 * Check if ADB is available
 * 
 * @returns {Promise<boolean>} True if ADB is available
 */
export async function isAdbAvailable() {
  return new Promise((resolve) => {
    const adb = spawn('adb', ['version'], {
      shell: false,
      stdio: 'ignore'
    });
    
    adb.on('close', (code) => {
      resolve(code === 0);
    });
    
    adb.on('error', () => {
      resolve(false);
    });
  });
}
