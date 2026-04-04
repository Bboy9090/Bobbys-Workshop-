/**
 * Fastboot Provider
 * 
 * Safe Fastboot command execution with validation and timeout enforcement
 * 
 * @module core/lib/fastboot
 */

import { spawn } from 'child_process';

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
  
  // Fastboot serials can be longer and include different formats
  if (serial.length < 4 || serial.length > 50) {
    throw new Error(`Invalid device serial format: ${serial}. Must be 4-50 characters.`);
  }
  
  return true;
}

/**
 * Execute Fastboot command safely
 * 
 * @param {string} serial - Device serial number (optional for some commands)
 * @param {string} command - Fastboot command
 * @param {Array<string>} args - Command arguments
 * @param {Object} options - Execution options
 * @param {number} options.timeout - Timeout in milliseconds (default: 60000)
 * @returns {Promise<string>} Command output
 */
export async function executeFastbootCommand(serial, command, args = [], options = {}) {
  const { timeout = 60000 } = options;
  
  // Build command array
  const fastbootArgs = [];
  if (serial && command !== 'devices') {
    fastbootArgs.push('-s', serial);
  }
  fastbootArgs.push(command, ...args);
  
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timeoutId;
    
    // Spawn Fastboot process (no shell)
    const fastboot = spawn('fastboot', fastbootArgs, {
      shell: false, // Critical: no shell execution
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Collect stdout
    fastboot.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    // Collect stderr
    fastboot.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Set timeout
    timeoutId = setTimeout(() => {
      fastboot.kill();
      reject(new Error(`Fastboot command timeout after ${timeout}ms`));
    }, timeout);
    
    // Handle process completion
    fastboot.on('close', (code) => {
      clearTimeout(timeoutId);
      
      // Fastboot often uses stderr for normal output
      const output = stdout || stderr;
      
      if (code === 0 || output.includes('OKAY') || output.includes('finished')) {
        resolve(output);
      } else {
        reject(new Error(`Fastboot command failed with code ${code}: ${output}`));
      }
    });
    
    // Handle process errors
    fastboot.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Fastboot process error: ${error.message}`));
    });
  });
}

/**
 * Get list of devices in Fastboot mode
 * 
 * @returns {Promise<Array>} Array of device objects
 */
export async function getFastbootDevices() {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    
    const fastboot = spawn('fastboot', ['devices', '-l'], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    fastboot.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    fastboot.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    fastboot.on('close', (code) => {
      if (code === 0 || stdout || stderr) {
        // Parse devices
        const devices = [];
        const lines = (stdout || stderr).split('\n').filter(line => line.trim());
        
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
        reject(new Error(`Failed to get Fastboot devices: ${stderr}`));
      }
    });
    
    fastboot.on('error', reject);
  });
}

/**
 * Check if Fastboot is available
 * 
 * @returns {Promise<boolean>} True if Fastboot is available
 */
export async function isFastbootAvailable() {
  return new Promise((resolve) => {
    const fastboot = spawn('fastboot', ['version'], {
      shell: false,
      stdio: 'ignore'
    });
    
    fastboot.on('close', (code) => {
      resolve(code === 0);
    });
    
    fastboot.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Flash a partition
 * 
 * @param {string} serial - Device serial number
 * @param {string} partition - Partition name (e.g., 'boot', 'system', 'recovery')
 * @param {string} imagePath - Path to image file
 * @param {Object} options - Flash options
 * @returns {Promise<string>} Command output
 */
export async function flashPartition(serial, partition, imagePath, options = {}) {
  const { timeout = 120000 } = options; // 2 minutes default for flashing
  
  return executeFastbootCommand(serial, 'flash', [partition, imagePath], { timeout });
}

/**
 * Reboot device from Fastboot
 * 
 * @param {string} serial - Device serial number
 * @param {string} mode - Reboot mode ('normal', 'bootloader', 'recovery')
 * @returns {Promise<string>} Command output
 */
export async function rebootFromFastboot(serial, mode = 'normal') {
  const command = mode === 'bootloader' ? 'reboot-bootloader' :
                  mode === 'recovery' ? 'reboot-recovery' :
                  'reboot';
  
  return executeFastbootCommand(serial, command, [], { timeout: 30000 });
}
