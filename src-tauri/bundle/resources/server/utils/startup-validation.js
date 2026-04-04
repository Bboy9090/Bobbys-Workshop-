/**
 * Startup Validation and Self-Tests
 *
 * Performs comprehensive validation before server accepts requests
 */

import fs from 'fs';
import os from 'os';
import { spawnSync } from 'child_process';
import { commandExistsSafe, commandExistsInPath } from './safe-exec.js';
import { createLogger } from './bundled-logger.js';

const logger = createLogger('StartupValidation');

/**
 * Startup validation results
 */
let validationResults = {
  performed: false,
  timestamp: null,
  results: {},
  overallStatus: 'unknown',
  criticalFailures: []
};

/**
 * Critical components that must be available
 */
const CRITICAL_COMPONENTS = [
  {
    name: 'Node.js',
    check: async () => {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      return {
        available: major >= 16,
        version,
        message: major >= 16 ? 'Compatible' : `Requires Node.js 16+, found ${version}`
      };
    }
  },
  {
    name: 'File System',
    check: async () => {
      const testFile = './.startup-test.tmp';

      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        return { available: true, message: 'Read/write access confirmed' };
      } catch (error) {
        return { available: false, message: `File system error: ${error.message}` };
      }
    }
  },
  {
    name: 'Memory',
    check: async () => {
      const memUsage = process.memoryUsage();
      const totalMemory = os.totalmem();

      // Require at least 512MB available
      const availableMemory = totalMemory - memUsage.heapUsed;
      const minRequired = 512 * 1024 * 1024; // 512MB

      return {
        available: availableMemory >= minRequired,
        message: `Available: ${(availableMemory / 1024 / 1024 / 1024).toFixed(1)}GB`
      };
    }
  }
];

/**
 * Optional components that enhance functionality
 */
const OPTIONAL_COMPONENTS = [
  {
    name: 'ADB',
    check: async () => {
      const available = commandExistsInPath('adb');
      let version = 'unknown';
      if (available) {
        try {
          const result = spawnSync('adb', ['version'], {
            encoding: 'utf8',
            timeout: 5000,
            windowsHide: true,
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe']
          });
          if (result.status === 0 && result.stdout) {
            const match = result.stdout.match(/version\s+([\d.]+)/i);
            version = match ? match[1] : 'detected';
          }
        } catch (error) {
          version = 'version check failed';
        }
      }
      return { available, version, message: available ? `Version: ${version}` : 'Not found in PATH' };
    }
  },
  {
    name: 'Fastboot',
    check: async () => {
      const available = await commandExistsSafe('fastboot');
      return { available, message: available ? 'Available' : 'Not found in PATH' };
    }
  },
  {
    name: 'Rust/Cargo',
    check: async () => {
      const rustc = await commandExistsSafe('rustc');
      const cargo = await commandExistsSafe('cargo');
      return {
        available: rustc && cargo,
        message: rustc && cargo ? 'Available' : `Missing: ${!rustc ? 'rustc ' : ''}${!cargo ? 'cargo' : ''}`
      };
    }
  }
];

/**
 * Perform startup validation
 */
export async function performStartupValidation() {
  logger.info('🔍 Performing startup validation...');

  const startTime = Date.now();
  validationResults = {
    performed: true,
    timestamp: new Date().toISOString(),
    results: {},
    overallStatus: 'unknown',
    criticalFailures: []
  };

  // Test critical components
  for (const component of CRITICAL_COMPONENTS) {
    try {
      logger.debug(`Testing ${component.name}...`);
      const result = await component.check();
      validationResults.results[component.name] = result;

      if (!result.available) {
        validationResults.criticalFailures.push({
          component: component.name,
          message: result.message
        });
        logger.error(`❌ Critical component failed: ${component.name} - ${result.message}`);
      } else {
        logger.info(`✅ ${component.name}: ${result.message}`);
      }
    } catch (error) {
      validationResults.criticalFailures.push({
        component: component.name,
        message: error.message
      });
      logger.error(`💥 Critical component error: ${component.name} - ${error.message}`);
    }
  }

  // Test optional components
  for (const component of OPTIONAL_COMPONENTS) {
    try {
      logger.debug(`Testing ${component.name}...`);
      const result = await component.check();
      validationResults.results[component.name] = result;

      if (result.available) {
        logger.info(`✅ ${component.name}: ${result.message}`);
      } else {
        logger.warn(`⚠️  ${component.name}: ${result.message}`);
      }
    } catch (error) {
      logger.warn(`⚠️  ${component.name} check failed: ${error.message}`);
      validationResults.results[component.name] = {
        available: false,
        message: `Check failed: ${error.message}`
      };
    }
  }

  // Determine overall status
  const hasCriticalFailures = validationResults.criticalFailures.length > 0;
  validationResults.overallStatus = hasCriticalFailures ? 'failed' : 'passed';

  const duration = Date.now() - startTime;
  logger.info(`🔍 Startup validation complete in ${duration}ms - Status: ${validationResults.overallStatus.toUpperCase()}`);

  if (hasCriticalFailures) {
    logger.error(`🚨 CRITICAL FAILURES DETECTED:`);
    validationResults.criticalFailures.forEach(failure => {
      logger.error(`   - ${failure.component}: ${failure.message}`);
    });
  }

  return validationResults;
}

/**
 * Get startup validation results
 */
export function getValidationResults() {
  return validationResults;
}

/**
 * Check if startup validation passed
 */
export function isValidationPassed() {
  return validationResults.performed && validationResults.overallStatus === 'passed';
}

/**
 * Get critical failure summary
 */
export function getCriticalFailures() {
  return validationResults.criticalFailures || [];
}

/**
 * Perform periodic health re-validation
 */
export async function performHealthRevalidation() {
  // Re-check optional components that might have become available
  const updates = {};

  for (const component of OPTIONAL_COMPONENTS) {
    try {
      const result = await component.check();
      if (JSON.stringify(result) !== JSON.stringify(validationResults.results[component.name])) {
        updates[component.name] = result;
        validationResults.results[component.name] = result;

        if (result.available) {
          logger.info(`🔄 ${component.name} became available: ${result.message}`);
        } else {
          logger.warn(`🔄 ${component.name} became unavailable: ${result.message}`);
        }
      }
    } catch (error) {
      logger.debug(`Health revalidation failed for ${component.name}: ${error.message}`);
    }
  }

  return updates;
}

// Periodic health re-validation (every 5 minutes)
setInterval(async () => {
  try {
    await performHealthRevalidation();
  } catch (error) {
    logger.debug(`Periodic health revalidation error: ${error.message}`);
  }
}, 300000);