/**
 * Safe command execution utilities
 * Uses spawn instead of execSync to avoid shell injection
 * Includes retry logic and circuit breaker protection
 */

import { spawn, spawnSync } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { withReliability, getCircuitBreakerStatus, resetCircuitBreaker } from './retry-circuit-breaker.js';
import { createLogger } from './bundled-logger.js';

const logger = createLogger('SafeExec');

/**
 * Safely execute a command using spawn (no shell interpolation)
 * Enhanced with retry logic and circuit breaker protection
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - Execution options
 * @returns {Promise<{success: boolean, stdout: string, stderr: string, error?: string}>}
 */
export async function safeSpawn(command, args = [], options = {}) {
  const operationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const circuitName = options.circuitBreaker || getCircuitName(command);

  logger.debug(`[${operationId}] Executing: ${command} ${args.join(' ')}`);

  return withReliability(async () => {
    return new Promise((resolve) => {
      const timeout = options.timeout || 30000; // Increased default timeout
      const cwd = options.cwd || process.cwd();

      const child = spawn(command, args, {
        cwd,
        timeout,
        encoding: 'utf8',
        windowsHide: true,
        shell: false, // Explicitly disable shell to prevent conhost.exe
        stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
        ...options
      });

      let stdout = '';
      let stderr = '';
      let timeoutId = null;

      // Enhanced timeout with warning
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          logger.warn(`[${operationId}] Command timeout after ${timeout}ms: ${command}`);
          child.kill('SIGTERM');

          // Give it 5 seconds to terminate gracefully
          setTimeout(() => {
            if (!child.killed) {
              logger.error(`[${operationId}] Force killing command: ${command}`);
              child.kill('SIGKILL');
            }
          }, 5000);

          resolve({
            success: false,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            error: `Command execution timeout after ${timeout}ms`,
            operationId,
            timedOut: true
          });
        }, timeout);
      }

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);

        const result = {
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
          operationId,
          ...(code !== 0 && { error: `Command exited with code ${code}` })
        };

        if (!result.success) {
          logger.warn(`[${operationId}] Command failed: ${command} (exit code: ${code})`);
          if (stderr) logger.debug(`[${operationId}] stderr: ${stderr}`);
        } else {
          logger.debug(`[${operationId}] Command succeeded: ${command}`);
        }

        resolve(result);
      });

      child.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);

        logger.error(`[${operationId}] Spawn error: ${error.message} for command: ${command}`);
        resolve({
          success: false,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          error: `Spawn error: ${error.message}`,
          operationId,
          spawnError: true
        });
      });
    });
  }, circuitName, options.retryOptions || {});
}

/**
 * Get appropriate circuit breaker name for a command
 */
function getCircuitName(command) {
  const cmd = command.toLowerCase();

  if (cmd === 'adb' || cmd.includes('adb')) return 'adb';
  if (cmd === 'fastboot' || cmd.includes('fastboot')) return 'fastboot';
  if (cmd.includes('bootforge') || cmd.includes('rust')) return 'bootforgeusb';
  if (cmd.includes('idevice') || cmd.includes('libimobile')) return 'ios_tools';
  if (cmd.includes('download') || cmd.includes('wget') || cmd.includes('curl')) return 'firmware_download';

  return 'general'; // Fallback circuit breaker
}

/**
 * Safely execute a command string by parsing it into command and args
 * WARNING: This still parses a command string, but validates it first
 * For maximum safety, use safeSpawn with explicit args
 */
export async function safeExecString(commandString, options = {}) {
  // Basic validation - reject commands with shell operators
  if (/[;&|`$<>]/.test(commandString)) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      error: 'Invalid characters in command string (shell operators not allowed)'
    };
  }

  // Split command into parts (simple whitespace split, no shell expansion)
  const parts = commandString.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      error: 'Empty command'
    };
  }

  const [command, ...args] = parts;
  return safeSpawn(command, args, options);
}

/**
 * Check if a command exists in PATH (Windows-native, no where.exe call)
 */
export function commandExistsInPath(cmd) {
  if (process.platform === 'win32') {
    // Check PATH directly without calling where.exe to prevent console windows
    const pathEnv = process.env.PATH || '';
    const pathDirs = pathEnv.split(';');
    const extensions = process.env.PATHEXT ? process.env.PATHEXT.split(';') : ['.exe', '.cmd', '.bat', '.com'];
    
    for (const dir of pathDirs) {
      if (!dir) continue;
      for (const ext of extensions) {
        const fullPath = join(dir, cmd + ext);
        if (existsSync(fullPath)) {
          return true;
        }
      }
    }
    return false;
  } else {
    // Unix-like: use command -v
    try {
      const result = spawnSync('command', ['-v', cmd], {
        stdio: 'ignore',
        timeout: 2000
      });
      return result.status === 0;
    } catch {
      return false;
    }
  }
}

/**
 * Check if a command exists (using safeSpawn for non-Windows, PATH check for Windows)
 */
export async function commandExistsSafe(cmd) {
  if (process.platform === 'win32') {
    return commandExistsInPath(cmd);
  }
  
  const result = await safeSpawn('command', ['-v', cmd], {
    timeout: 2000,
    stdio: 'ignore'
  });
  
  return result.success;
}

// Export circuit breaker utilities
export { getCircuitBreakerStatus, resetCircuitBreaker } from './retry-circuit-breaker.js';
