/**
 * Operation Loader
 * 
 * Loads operation specifications from the catalog with built-in default specs.
 * 
 * @module core/catalog/operation-loader
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPERATIONS_DIR = path.join(__dirname, 'operations');

const DEFAULT_OPERATION_SPECS = {
  reboot_device: {
    operation: 'reboot_device',
    displayName: 'Reboot Device',
    description: 'Reboot connected Android device into system, recovery, or bootloader mode',
    category: 'safe',
    riskLevel: 'low',
    requiresConfirmation: false,
    allowedRoles: ['owner', 'admin', 'technician'],
    requiredCapabilities: ['adb'],
    parameters: {
      deviceSerial: { type: 'string', required: true },
      mode: { type: 'string', required: false, pattern: '^(system|recovery|bootloader)$' }
    }
  },
  capture_screenshot: {
    operation: 'capture_screenshot',
    displayName: 'Capture Screenshot',
    description: 'Capture device screen and pull PNG image to workstation',
    category: 'diagnostics',
    riskLevel: 'low',
    requiresConfirmation: false,
    allowedRoles: ['owner', 'admin', 'technician', 'viewer'],
    requiredCapabilities: ['adb'],
    parameters: {
      deviceSerial: { type: 'string', required: true },
      outputPath: { type: 'string', required: false }
    }
  },
  device_info: {
    operation: 'device_info',
    displayName: 'Get Device Information',
    description: 'Query comprehensive hardware and build properties via ADB',
    category: 'diagnostics',
    riskLevel: 'low',
    requiresConfirmation: false,
    allowedRoles: ['owner', 'admin', 'technician', 'viewer'],
    requiredCapabilities: ['adb'],
    parameters: {
      deviceSerial: { type: 'string', required: true }
    }
  },
  factory_reset: {
    operation: 'factory_reset',
    displayName: 'Factory Reset Device',
    description: 'Reboot device to recovery mode for factory data reset',
    category: 'destructive',
    riskLevel: 'destructive',
    requiresConfirmation: true,
    allowedRoles: ['owner', 'admin'],
    requiredCapabilities: ['adb'],
    parameters: {
      deviceSerial: { type: 'string', required: true },
      wipeData: { type: 'boolean', required: false },
      wipeCache: { type: 'boolean', required: false }
    }
  },
  backup_device: {
    operation: 'backup_device',
    displayName: 'Backup Device',
    description: 'Create package and metadata backup snapshot for device',
    category: 'backup',
    riskLevel: 'low',
    requiresConfirmation: false,
    allowedRoles: ['owner', 'admin', 'technician'],
    requiredCapabilities: ['adb'],
    parameters: {
      deviceSerial: { type: 'string', required: true },
      backupPath: { type: 'string', required: false }
    }
  },
  app_list: {
    operation: 'app_list',
    displayName: 'List Installed Applications',
    description: 'Enumerate installed packages on device',
    category: 'diagnostics',
    riskLevel: 'low',
    requiresConfirmation: false,
    allowedRoles: ['owner', 'admin', 'technician', 'viewer'],
    requiredCapabilities: ['adb'],
    parameters: {
      deviceSerial: { type: 'string', required: true },
      systemApps: { type: 'boolean', required: false }
    }
  },
  battery_info: {
    operation: 'battery_info',
    displayName: 'Get Battery Information',
    description: 'Read battery health, voltage, temperature, and charge level',
    category: 'diagnostics',
    riskLevel: 'low',
    requiresConfirmation: false,
    allowedRoles: ['owner', 'admin', 'technician', 'viewer'],
    requiredCapabilities: ['adb'],
    parameters: {
      deviceSerial: { type: 'string', required: true }
    }
  },
  get_logs: {
    operation: 'get_logs',
    displayName: 'Get Device Logs',
    description: 'Retrieve filtered logcat entries from device',
    category: 'diagnostics',
    riskLevel: 'low',
    requiresConfirmation: false,
    allowedRoles: ['owner', 'admin', 'technician', 'viewer'],
    requiredCapabilities: ['adb'],
    parameters: {
      deviceSerial: { type: 'string', required: true }
    }
  },
  network_info: {
    operation: 'network_info',
    displayName: 'Get Network Information',
    description: 'Inspect network interfaces and Wi-Fi status',
    category: 'diagnostics',
    riskLevel: 'low',
    requiresConfirmation: false,
    allowedRoles: ['owner', 'admin', 'technician', 'viewer'],
    requiredCapabilities: ['adb'],
    parameters: {
      deviceSerial: { type: 'string', required: true }
    }
  },
  storage_info: {
    operation: 'storage_info',
    displayName: 'Get Storage Information',
    description: 'Inspect partition mount points and disk usage',
    category: 'diagnostics',
    riskLevel: 'low',
    requiresConfirmation: false,
    allowedRoles: ['owner', 'admin', 'technician', 'viewer'],
    requiredCapabilities: ['adb'],
    parameters: {
      deviceSerial: { type: 'string', required: true }
    }
  }
};

export async function loadOperationSpec(operationId) {
  try {
    const possibleFiles = [
      `${operationId}.json`,
      `${operationId.replace(/_/g, '-')}.json`,
      `${operationId.replace(/-/g, '_')}.json`
    ];

    for (const filename of possibleFiles) {
      const filePath = path.join(OPERATIONS_DIR, filename);

      try {
        const content = await fs.readFile(filePath, 'utf8');
        const spec = JSON.parse(content);

        if (!spec.operation || !spec.allowedRoles) {
          continue;
        }

        return spec;
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.warn(`Error reading ${filePath}:`, err.message);
        }
      }
    }

    const normalized = operationId.replace(/-/g, '_');
    return DEFAULT_OPERATION_SPECS[operationId] || DEFAULT_OPERATION_SPECS[normalized] || null;
  } catch (error) {
    console.error(`Error loading operation spec for ${operationId}:`, error);
    return null;
  }
}

export async function listAllOperations() {
  const operationsMap = new Map(Object.entries(DEFAULT_OPERATION_SPECS));

  try {
    const files = await fs.readdir(OPERATIONS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const filePath = path.join(OPERATIONS_DIR, file);
        const content = await fs.readFile(filePath, 'utf8');
        const spec = JSON.parse(content);
        if (spec.operation && spec.allowedRoles) {
          operationsMap.set(spec.operation, spec);
        }
      } catch {
        // Ignore invalid catalog file
      }
    }
  } catch {
    // Directory optional when using built-in catalog specs
  }

  return Array.from(operationsMap.values());
}

export async function listOperationsForRole(role) {
  const allOperations = await listAllOperations();
  return allOperations.filter(op => op.allowedRoles && op.allowedRoles.includes(role));
}

export const listOperations = listAllOperations;
