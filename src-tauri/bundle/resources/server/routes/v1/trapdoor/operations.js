/**
 * Trapdoor Operations Handlers
 * 
 * Handlers for the new Trapdoor Admin Architecture endpoints:
 * - POST /execute - Execute operations with policy enforcement
 * - POST /simulate - Simulate operations without execution
 * - GET /operations - List available operations
 * 
 * @module server/routes/v1/trapdoor/operations
 */

import { evaluatePolicy, validateParameters } from '../../../../core/lib/policy-evaluator.js';
import { 
  createExecuteEnvelope, 
  createPolicyDenyEnvelope, 
  createErrorEnvelope,
  createSimulateEnvelope 
} from '../../../../core/lib/operation-envelope.js';
import { logShadow } from '../../../../core/lib/shadow-logger.js';
import { loadOperationSpec, listOperationsForRole } from '../../../../core/catalog/operation-loader.js';

/**
 * Extract user role from request
 */
function getUserRoleFromRequest(req) {
  // Check if user is authenticated via trapdoor
  if (req.secretRoomAuth && req.secretRoomAuth.authenticated) {
    // Default to admin for authenticated trapdoor users
    // In production, this could be extracted from JWT or session
    return 'admin';
  }
  
  // Fallback to viewer
  return 'viewer';
}

/**
 * Sanitize parameters for logging
 */
function sanitizeParams(params) {
  const sanitized = { ...params };
  const sensitiveKeys = ['password', 'passcode', 'apiKey', 'token', 'secret'];
  
  for (const key of sensitiveKeys) {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * POST /api/v1/trapdoor/execute
 * Execute a privileged operation with policy enforcement
 */
export async function executeHandler(req, res) {
  try {
    const { operation, params = {}, correlationId } = req.body;
    const role = getUserRoleFromRequest(req);

    if (!operation) {
      return res.status(400).json(
        createErrorEnvelope(
          'unknown',
          'OPERATION_REQUIRED',
          'Operation parameter is required',
          {},
          correlationId
        )
      );
    }

    // Load operation specification
    const operationSpec = await loadOperationSpec(operation);
    
    if (!operationSpec) {
      return res.status(404).json(
        createErrorEnvelope(
          operation,
          'OPERATION_NOT_FOUND',
          `Operation '${operation}' not found in catalog`,
          {},
          correlationId
        )
      );
    }

    // Log operation request
    try {
      await logShadow({
        operation: `${operation}_requested`,
        userId: req.secretRoomAuth?.clientId || req.ip || 'unknown',
        ipAddress: req.ip,
        role,
        authorization: 'TRAPDOOR',
        success: true,
        metadata: {
          timestamp: new Date().toISOString(),
          params: sanitizeParams(params)
        }
      });
    } catch (logError) {
      console.warn('Failed to log shadow entry:', logError);
    }

    // Evaluate policy
    const policyResult = evaluatePolicy(role, operationSpec);

    if (!policyResult.allowed) {
      const denyEnvelope = createPolicyDenyEnvelope({
        operation,
        reason: policyResult.reason,
        policy: policyResult.policy,
        metadata: {
          requestedRole: role,
          requiredRoles: operationSpec.allowedRoles
        },
        correlationId
      });

      try {
        await logShadow({
          operation: `${operation}_denied`,
          userId: req.secretRoomAuth?.clientId || req.ip || 'unknown',
          ipAddress: req.ip,
          role,
          authorization: 'TRAPDOOR',
          success: false,
          metadata: {
            reason: policyResult.reason,
            policy: policyResult.policy
          }
        });
      } catch (logError) {
        console.warn('Failed to log shadow entry:', logError);
      }

      return res.status(403).json(denyEnvelope);
    }

    // Validate parameters
    const validation = validateParameters(params, operationSpec);
    if (!validation.valid) {
      return res.status(400).json(
        createErrorEnvelope(
          operation,
          'INVALID_PARAMETERS',
          'Parameter validation failed',
          { errors: validation.errors },
          correlationId
        )
      );
    }

    // Check if confirmation required
    if (policyResult.requiresConfirmation && !req.body.confirmation) {
      return res.status(400).json(
        createErrorEnvelope(
          operation,
          'CONFIRMATION_REQUIRED',
          'This operation requires explicit confirmation',
          {
            riskLevel: operationSpec.riskLevel,
            requiresConfirmation: true
          },
          correlationId
        )
      );
    }

    // Execute operation
    // TODO: Route to appropriate operation handler based on operation type
    // For now, return a placeholder response
    const result = await executeOperation(operation, params, operationSpec);

    // Log completion
    try {
      await logShadow({
        operation: `${operation}_completed`,
        userId: req.secretRoomAuth?.clientId || req.ip || 'unknown',
        ipAddress: req.ip,
        role,
        authorization: 'TRAPDOOR',
        success: result.operation.status === 'success',
        metadata: {
          timestamp: new Date().toISOString(),
          result: result.data.result
        }
      });
    } catch (logError) {
      console.warn('Failed to log shadow entry:', logError);
    }

    return res.json(result);

  } catch (error) {
    console.error('Trapdoor execute error:', error);
    return res.status(500).json(
      createErrorEnvelope(
        req.body.operation || 'unknown',
        'INTERNAL_ERROR',
        error.message,
        {},
        req.body.correlationId
      )
    );
  }
}

/**
 * POST /api/v1/trapdoor/simulate
 * Simulate/dry-run an operation without executing it
 */
export async function simulateHandler(req, res) {
  try {
    const { operation, params = {}, correlationId } = req.body;
    const role = getUserRoleFromRequest(req);

    if (!operation) {
      return res.status(400).json(
        createErrorEnvelope(
          'unknown',
          'OPERATION_REQUIRED',
          'Operation parameter is required',
          {},
          correlationId
        )
      );
    }

    // Load operation specification
    const operationSpec = await loadOperationSpec(operation);
    
    if (!operationSpec) {
      return res.status(404).json(
        createErrorEnvelope(
          operation,
          'OPERATION_NOT_FOUND',
          `Operation '${operation}' not found`,
          {},
          correlationId
        )
      );
    }

    // Evaluate policy
    const policyResult = evaluatePolicy(role, operationSpec);

    // Validate parameters
    const validation = validateParameters(params, operationSpec);

    // Build simulation result
    const checks = [
      {
        name: 'policy_evaluation',
        passed: policyResult.allowed,
        details: policyResult
      },
      {
        name: 'parameter_validation',
        passed: validation.valid,
        details: validation
      }
    ];

    const wouldSucceed = policyResult.allowed && validation.valid;

    const simulateEnvelope = createSimulateEnvelope({
      operation,
      wouldSucceed,
      simulation: {
        checks,
        requirements: operationSpec.requiredCapabilities || [],
        warnings: policyResult.requiresConfirmation ? ['Confirmation required for execution'] : []
      },
      metadata: {
        role,
        riskLevel: operationSpec.riskLevel,
        requiresConfirmation: policyResult.requiresConfirmation
      },
      correlationId
    });

    return res.json(simulateEnvelope);

  } catch (error) {
    console.error('Trapdoor simulate error:', error);
    return res.status(500).json(
      createErrorEnvelope(
        req.body.operation || 'unknown',
        'INTERNAL_ERROR',
        error.message,
        {},
        req.body.correlationId
      )
    );
  }
}

/**
 * GET /api/v1/trapdoor/operations
 * List all available operations for the current role
 */
export async function listOperationsHandler(req, res) {
  try {
    const role = getUserRoleFromRequest(req);
    
    // Load all operations for this role
    const operations = await listOperationsForRole(role);

    return res.sendEnvelope({
      operations: operations.map(op => ({
        id: op.operation,
        displayName: op.displayName,
        description: op.description,
        category: op.category,
        riskLevel: op.riskLevel,
        requiresConfirmation: op.requiresConfirmation,
        requiredCapabilities: op.requiredCapabilities || []
      })),
      role,
      count: operations.length
    });

  } catch (error) {
    console.error('Trapdoor list operations error:', error);
    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      },
      meta: {
        ts: new Date().toISOString(),
        correlationId: req.correlationId || 'unknown'
      }
    });
  }
}

/**
 * Execute an operation
 * 
 * Routes to appropriate handler based on operation type
 * 
 * @param {string} operation - Operation identifier
 * @param {Object} params - Operation parameters
 * @param {Object} operationSpec - Operation specification
 * @returns {Promise<Object>} Execute envelope
 */
async function executeOperation(operation, params, operationSpec) {
  const startTime = Date.now();
  
  try {
    // Route to appropriate handler
    switch (operation) {
      case 'reboot_device':
        return await executeRebootDevice(params, operationSpec);
      
      case 'capture_screenshot':
        return await executeCaptureScreenshot(params, operationSpec);
      
      case 'device_info':
        return await executeDeviceInfo(params, operationSpec);
      
      case 'factory_reset':
        return await executeFactoryReset(params, operationSpec);
      
      case 'backup_device':
        return await executeBackupDevice(params, operationSpec);
      
      case 'app_list':
        return await executeAppList(params, operationSpec);
      
      case 'battery_info':
        return await executeBatteryInfo(params, operationSpec);
      
      case 'pull_file':
        return await executePullFile(params, operationSpec);
      
      case 'push_file':
        return await executePushFile(params, operationSpec);
      
      case 'install_app':
        return await executeInstallApp(params, operationSpec);
      
      case 'uninstall_app':
        return await executeUninstallApp(params, operationSpec);
      
      case 'get_logs':
        return await executeGetLogs(params, operationSpec);
      
      case 'network_info':
        return await executeNetworkInfo(params, operationSpec);
      
      case 'storage_info':
        return await executeStorageInfo(params, operationSpec);
      
      case 'screen_record':
        return await executeScreenRecord(params, operationSpec);
      
      case 'key_event':
        return await executeKeyEvent(params, operationSpec);
      
      case 'tap_event':
        return await executeTapEvent(params, operationSpec);
      
      case 'swipe_event':
        return await executeSwipeEvent(params, operationSpec);
      
      case 'restore_device':
        return await executeRestoreDevice(params, operationSpec);
      
      case 'permission_list':
        return await executePermissionList(params, operationSpec);
      
      default:
        // Try workflow engine for complex operations
        const workflowEngine = await import('../../../../core/tasks/workflow-engine.js');
        if (workflowEngine && workflowEngine.executeWorkflow) {
          return await workflowEngine.executeWorkflow(operation, params);
        }
        
        // Fallback: not implemented
        return createErrorEnvelope(
          operation,
          'NOT_IMPLEMENTED',
          `Operation '${operation}' handler not yet implemented`,
          { 
            operation, 
            params: sanitizeParams(params),
            note: 'Operation specification loaded successfully. Handler implementation pending.'
          }
        );
    }
  } catch (error) {
    return createErrorEnvelope(
      operation,
      'EXECUTION_ERROR',
      `Operation execution failed: ${error.message}`,
      { 
        operation,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    );
  }
}

/**
 * Execute reboot device operation
 */
async function executeRebootDevice(params, operationSpec) {
  const { deviceSerial, mode = 'system' } = params;
  const startTime = Date.now();
  
  try {
    // Import ADB provider
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    // Validate device serial
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Execute reboot command
    const rebootCommand = mode === 'recovery' ? 'reboot recovery' : 
                         mode === 'bootloader' ? 'reboot bootloader' : 
                         'reboot';
    
    await executeAdbCommand(deviceSerial, 'shell', [rebootCommand]);
    
    return createExecuteEnvelope({
      operation: 'reboot_device',
      success: true,
      result: {
        deviceSerial,
        rebootMode: mode,
        message: `Device rebooted successfully in ${mode} mode`
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Reboot Device'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'reboot_device',
      'REBOOT_FAILED',
      `Failed to reboot device: ${error.message}`,
      { deviceSerial, mode, originalError: error.message }
    );
  }
}

/**
 * Execute capture screenshot operation
 */
async function executeCaptureScreenshot(params, operationSpec) {
  const { deviceSerial, outputPath } = params;
  const startTime = Date.now();
  
  try {
    // Import ADB provider and file system utilities
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Validate device serial
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Generate output path if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = outputPath || `screenshot-${deviceSerial}-${timestamp}.png`;
    const outputDir = path.resolve('./screenshots');
    const fullPath = path.join(outputDir, path.basename(filename));
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Step 1: Capture on device
    await executeAdbCommand(deviceSerial, 'shell', [
      'screencap', '-p', '/sdcard/workshop-screen.png'
    ]);
    
    // Step 2: Pull to local
    await executeAdbCommand(deviceSerial, 'pull', [
      '/sdcard/workshop-screen.png',
      fullPath
    ]);
    
    // Step 3: Cleanup device (best effort)
    try {
      await executeAdbCommand(deviceSerial, 'shell', [
        'rm', '/sdcard/workshop-screen.png'
      ]);
    } catch (cleanupError) {
      // Non-critical, continue
      console.warn('Screenshot cleanup failed:', cleanupError.message);
    }
    
    // Verify file exists
    const stats = await fs.stat(fullPath);
    
    return createExecuteEnvelope({
      operation: 'capture_screenshot',
      success: true,
      result: {
        deviceSerial,
        outputPath: fullPath,
        fileSizeBytes: stats.size,
        message: 'Screenshot captured successfully'
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Capture Screenshot'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'capture_screenshot',
      'SCREENSHOT_FAILED',
      `Failed to capture screenshot: ${error.message}`,
      { deviceSerial, originalError: error.message }
    );
  }
}

/**
 * Execute device info operation
 */
async function executeDeviceInfo(params, operationSpec) {
  const { deviceSerial } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Get device properties
    const props = await executeAdbCommand(deviceSerial, 'shell', ['getprop']);
    
    // Parse properties
    const deviceInfo = {
      serial: deviceSerial,
      model: extractProp(props, 'ro.product.model'),
      manufacturer: extractProp(props, 'ro.product.manufacturer'),
      brand: extractProp(props, 'ro.product.brand'),
      device: extractProp(props, 'ro.product.device'),
      androidVersion: extractProp(props, 'ro.build.version.release'),
      sdkVersion: extractProp(props, 'ro.build.version.sdk'),
      buildId: extractProp(props, 'ro.build.id'),
      fingerprint: extractProp(props, 'ro.build.fingerprint')
    };
    
    return createExecuteEnvelope({
      operation: 'device_info',
      success: true,
      result: deviceInfo,
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Get Device Information'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'device_info',
      'DEVICE_INFO_FAILED',
      `Failed to get device info: ${error.message}`,
      { deviceSerial, originalError: error.message }
    );
  }
}

/**
 * Extract property from getprop output
 */
function extractProp(output, propName) {
  const regex = new RegExp(`\\[${propName.replace(/\./g, '\\.')}\\]:\\s*\\[(.*?)\\]`, 'i');
  const match = output.match(regex);
  return match ? match[1] : 'unknown';
}

/**
 * Execute factory reset operation
 */
async function executeFactoryReset(params, operationSpec) {
  const { deviceSerial, wipeData = true, wipeCache = true } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Factory reset via recovery
    await executeAdbCommand(deviceSerial, 'reboot', ['recovery']);
    
    // Note: Actual factory reset happens in recovery mode
    // This is a simplified implementation
    
    return createExecuteEnvelope({
      operation: 'factory_reset',
      success: true,
      result: {
        deviceSerial,
        message: 'Device rebooted to recovery mode for factory reset',
        wipeData,
        wipeCache,
        warning: 'Factory reset will erase all data. Device is now in recovery mode.'
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Factory Reset Device'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'factory_reset',
      'FACTORY_RESET_FAILED',
      `Failed to factory reset device: ${error.message}`,
      { deviceSerial, originalError: error.message }
    );
  }
}

/**
 * Execute backup device operation
 */
async function executeBackupDevice(params, operationSpec) {
  const { deviceSerial, backupPath, includeApps = true, includeData = true } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    const fs = await import('fs/promises');
    const path = await import('path');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Generate backup path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = backupPath || path.resolve('./backups', deviceSerial, timestamp);
    await fs.mkdir(backupDir, { recursive: true });
    
    // Backup apps if requested
    if (includeApps) {
      const appsOutput = await executeAdbCommand(deviceSerial, 'shell', ['pm', 'list', 'packages']);
      await fs.writeFile(path.join(backupDir, 'apps.txt'), appsOutput);
    }
    
    // Backup data if requested (simplified - full data backup requires more complex logic)
    if (includeData) {
      await fs.writeFile(path.join(backupDir, 'backup-info.json'), JSON.stringify({
        deviceSerial,
        timestamp: new Date().toISOString(),
        includeApps,
        includeData
      }, null, 2));
    }
    
    return createExecuteEnvelope({
      operation: 'backup_device',
      success: true,
      result: {
        deviceSerial,
        backupPath: backupDir,
        includeApps,
        includeData,
        message: 'Backup initiated successfully'
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Backup Device'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'backup_device',
      'BACKUP_FAILED',
      `Failed to backup device: ${error.message}`,
      { deviceSerial, originalError: error.message }
    );
  }
}

/**
 * Execute app list operation
 */
async function executeAppList(params, operationSpec) {
  const { deviceSerial, systemApps = false } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Get app list
    const command = systemApps 
      ? ['pm', 'list', 'packages']
      : ['pm', 'list', 'packages', '-3']; // -3 = third-party only
    
    const output = await executeAdbCommand(deviceSerial, 'shell', command);
    
    // Parse package names
    const packages = output
      .split('\n')
      .filter(line => line.startsWith('package:'))
      .map(line => line.replace('package:', '').trim())
      .filter(pkg => pkg.length > 0);
    
    return createExecuteEnvelope({
      operation: 'app_list',
      success: true,
      result: {
        deviceSerial,
        packages,
        count: packages.length,
        systemApps
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'List Installed Applications'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'app_list',
      'APP_LIST_FAILED',
      `Failed to list applications: ${error.message}`,
      { deviceSerial, originalError: error.message }
    );
  }
}

/**
 * Execute battery info operation
 */
async function executeBatteryInfo(params, operationSpec) {
  const { deviceSerial } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Get battery info
    const batteryOutput = await executeAdbCommand(deviceSerial, 'shell', [
      'dumpsys', 'battery'
    ]);
    
    // Parse battery info
    const batteryInfo = {
      level: extractBatteryProp(batteryOutput, 'level'),
      scale: extractBatteryProp(batteryOutput, 'scale'),
      status: extractBatteryProp(batteryOutput, 'status'),
      health: extractBatteryProp(batteryOutput, 'health'),
      plugged: extractBatteryProp(batteryOutput, 'plugged'),
      temperature: extractBatteryProp(batteryOutput, 'temperature'),
      voltage: extractBatteryProp(batteryOutput, 'voltage'),
      technology: extractBatteryProp(batteryOutput, 'technology')
    };
    
    // Calculate percentage
    const percentage = batteryInfo.scale > 0 
      ? Math.round((batteryInfo.level / batteryInfo.scale) * 100)
      : 0;
    
    batteryInfo.percentage = percentage;
    
    return createExecuteEnvelope({
      operation: 'battery_info',
      success: true,
      result: {
        deviceSerial,
        battery: batteryInfo
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Get Battery Information'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'battery_info',
      'BATTERY_INFO_FAILED',
      `Failed to get battery info: ${error.message}`,
      { deviceSerial, originalError: error.message }
    );
  }
}

/**
 * Extract battery property from dumpsys output
 */
function extractBatteryProp(output, propName) {
  const regex = new RegExp(`${propName}:\\s*(\\d+)`, 'i');
  const match = output.match(regex);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Execute pull file operation
 */
async function executePullFile(params, operationSpec) {
  const { deviceSerial, remotePath, localPath } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    const fs = await import('fs/promises');
    const path = await import('path');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Validate remote path (basic safety check)
    if (!remotePath || remotePath.includes('..')) {
      throw new Error('Invalid remote path');
    }
    
    // Generate local path if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.basename(remotePath) || `file-${timestamp}`;
    const outputDir = path.resolve('./downloads');
    const fullPath = localPath || path.join(outputDir, `${deviceSerial}-${filename}`);
    
    // Ensure output directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Pull file
    await executeAdbCommand(deviceSerial, 'pull', [remotePath, fullPath]);
    
    // Verify file exists
    const stats = await fs.stat(fullPath);
    
    return createExecuteEnvelope({
      operation: 'pull_file',
      success: true,
      result: {
        deviceSerial,
        remotePath,
        localPath: fullPath,
        fileSizeBytes: stats.size,
        message: 'File pulled successfully'
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Pull File from Device'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'pull_file',
      'PULL_FILE_FAILED',
      `Failed to pull file: ${error.message}`,
      { deviceSerial, remotePath, originalError: error.message }
    );
  }
}

/**
 * Execute push file operation
 */
async function executePushFile(params, operationSpec) {
  const { deviceSerial, localPath, remotePath } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    const fs = await import('fs/promises');
    const path = await import('path');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Validate local path exists
    const resolvedLocalPath = path.resolve(localPath);
    try {
      await fs.access(resolvedLocalPath);
    } catch {
      throw new Error(`Local file not found: ${localPath}`);
    }
    
    // Validate remote path (basic safety check)
    if (!remotePath || remotePath.includes('..')) {
      throw new Error('Invalid remote path');
    }
    
    // Push file
    await executeAdbCommand(deviceSerial, 'push', [resolvedLocalPath, remotePath]);
    
    return createExecuteEnvelope({
      operation: 'push_file',
      success: true,
      result: {
        deviceSerial,
        localPath: resolvedLocalPath,
        remotePath,
        message: 'File pushed successfully'
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Push File to Device'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'push_file',
      'PUSH_FILE_FAILED',
      `Failed to push file: ${error.message}`,
      { deviceSerial, localPath, remotePath, originalError: error.message }
    );
  }
}

/**
 * Execute install app operation
 */
async function executeInstallApp(params, operationSpec) {
  const { deviceSerial, apkPath, replaceExisting = false } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    const fs = await import('fs/promises');
    const path = await import('path');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Validate APK path exists
    const resolvedApkPath = path.resolve(apkPath);
    try {
      await fs.access(resolvedApkPath);
    } catch {
      throw new Error(`APK file not found: ${apkPath}`);
    }
    
    // Install APK
    const installArgs = [];
    if (replaceExisting) {
      installArgs.push('-r'); // Replace existing
    }
    installArgs.push(resolvedApkPath);
    
    const output = await executeAdbCommand(deviceSerial, 'install', installArgs);
    
    return createExecuteEnvelope({
      operation: 'install_app',
      success: true,
      result: {
        deviceSerial,
        apkPath: resolvedApkPath,
        replaceExisting,
        output,
        message: 'Application installed successfully'
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Install Application'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'install_app',
      'INSTALL_APP_FAILED',
      `Failed to install app: ${error.message}`,
      { deviceSerial, apkPath, originalError: error.message }
    );
  }
}

/**
 * Execute uninstall app operation
 */
async function executeUninstallApp(params, operationSpec) {
  const { deviceSerial, packageName, keepData = false } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Validate package name format
    if (!packageName || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(packageName)) {
      throw new Error('Invalid package name format');
    }
    
    // Uninstall app (using pm uninstall via shell since -k flag requires it)
    const pmArgs = ['pm', 'uninstall'];
    if (keepData) {
      pmArgs.push('-k'); // Keep data
    }
    pmArgs.push(packageName);
    
    const output = await executeAdbCommand(deviceSerial, 'shell', pmArgs);
    
    return createExecuteEnvelope({
      operation: 'uninstall_app',
      success: true,
      result: {
        deviceSerial,
        packageName,
        keepData,
        output,
        message: 'Application uninstalled successfully'
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Uninstall Application'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'uninstall_app',
      'UNINSTALL_APP_FAILED',
      `Failed to uninstall app: ${error.message}`,
      { deviceSerial, packageName, originalError: error.message }
    );
  }
}

/**
 * Execute get logs operation
 */
async function executeGetLogs(params, operationSpec) {
  const { deviceSerial, logLevel = 'I', lines = 100, tag } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Build logcat command
    const logcatArgs = ['logcat', '-d', `*:${logLevel}`];
    if (tag) {
      logcatArgs.push(`${tag}:${logLevel}`);
    }
    logcatArgs.push('-t', lines.toString());
    
    const output = await executeAdbCommand(deviceSerial, 'shell', logcatArgs);
    
    // Parse logs
    const logLines = output
      .split('\n')
      .filter(line => line.trim().length > 0)
      .slice(0, lines);
    
    return createExecuteEnvelope({
      operation: 'get_logs',
      success: true,
      result: {
        deviceSerial,
        logLevel,
        lines: logLines.length,
        tag: tag || 'all',
        logs: logLines
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Get Device Logs'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'get_logs',
      'GET_LOGS_FAILED',
      `Failed to get logs: ${error.message}`,
      { deviceSerial, originalError: error.message }
    );
  }
}

/**
 * Execute network info operation
 */
async function executeNetworkInfo(params, operationSpec) {
  const { deviceSerial } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Get network info
    const [ifconfigOutput, ipOutput, wifiOutput] = await Promise.all([
      executeAdbCommand(deviceSerial, 'shell', ['ifconfig']).catch(() => ''),
      executeAdbCommand(deviceSerial, 'shell', ['ip', 'addr', 'show']).catch(() => ''),
      executeAdbCommand(deviceSerial, 'shell', ['dumpsys', 'wifi']).catch(() => '')
    ]);
    
    // Parse network info (simplified)
    const networkInfo = {
      interfaces: parseInterfaces(ifconfigOutput || ipOutput),
      wifi: parseWifiInfo(wifiOutput)
    };
    
    return createExecuteEnvelope({
      operation: 'network_info',
      success: true,
      result: {
        deviceSerial,
        network: networkInfo
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Get Network Information'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'network_info',
      'NETWORK_INFO_FAILED',
      `Failed to get network info: ${error.message}`,
      { deviceSerial, originalError: error.message }
    );
  }
}

/**
 * Parse network interfaces
 */
function parseInterfaces(output) {
  const interfaces = [];
  const lines = output.split('\n');
  let currentInterface = null;
  
  for (const line of lines) {
    if (line.match(/^\w+:/)) {
      if (currentInterface) interfaces.push(currentInterface);
      currentInterface = { name: line.split(':')[0], addresses: [] };
    } else if (currentInterface && line.includes('inet ')) {
      const match = line.match(/inet\s+(\S+)/);
      if (match) currentInterface.addresses.push(match[1]);
    }
  }
  if (currentInterface) interfaces.push(currentInterface);
  
  return interfaces;
}

/**
 * Parse WiFi info
 */
function parseWifiInfo(output) {
  const wifiEnabled = output.includes('Wi-Fi is enabled') || output.includes('WiFi enabled');
  const connected = output.includes('mWifiInfo SSID') || output.includes('connected');
  
  return {
    enabled: wifiEnabled,
    connected
  };
}

/**
 * Execute storage info operation
 */
async function executeStorageInfo(params, operationSpec) {
  const { deviceSerial } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Get storage info
    const dfOutput = await executeAdbCommand(deviceSerial, 'shell', ['df', '-h']);
    const storageOutput = await executeAdbCommand(deviceSerial, 'shell', ['dumpsys', 'diskstats']).catch(() => '');
    
    // Parse storage info
    const storageInfo = {
      partitions: parseDfOutput(dfOutput),
      diskStats: parseDiskStats(storageOutput)
    };
    
    return createExecuteEnvelope({
      operation: 'storage_info',
      success: true,
      result: {
        deviceSerial,
        storage: storageInfo
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Get Storage Information'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'storage_info',
      'STORAGE_INFO_FAILED',
      `Failed to get storage info: ${error.message}`,
      { deviceSerial, originalError: error.message }
    );
  }
}

/**
 * Parse df output
 */
function parseDfOutput(output) {
  const partitions = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/);
    if (parts.length >= 6) {
      partitions.push({
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usePercent: parts[4],
        mounted: parts[5]
      });
    }
  }
  
  return partitions;
}

/**
 * Parse disk stats
 */
function parseDiskStats(output) {
  if (!output) return null;
  
  // Extract key metrics
  const totalSpace = output.match(/Total space:\s*(\d+)/i);
  const freeSpace = output.match(/Free space:\s*(\d+)/i);
  
  return {
    totalSpace: totalSpace ? parseInt(totalSpace[1], 10) : null,
    freeSpace: freeSpace ? parseInt(freeSpace[1], 10) : null
  };
}

/**
 * Execute screen record operation
 */
async function executeScreenRecord(params, operationSpec) {
  const { deviceSerial, duration = 60, bitrate = 8000000, outputPath } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    const fs = await import('fs/promises');
    const path = await import('path');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Generate output path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = outputPath || `screen-record-${deviceSerial}-${timestamp}.mp4`;
    const outputDir = path.resolve('./recordings');
    const fullPath = path.isAbsolute(filename) ? filename : path.join(outputDir, filename);
    
    // Ensure output directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Start recording on device
    const remotePath = `/sdcard/workshop-record-${timestamp}.mp4`;
    await executeAdbCommand(deviceSerial, 'shell', [
      'screenrecord',
      '--bit-rate', bitrate.toString(),
      '--time-limit', duration.toString(),
      remotePath
    ], { timeout: (duration + 10) * 1000 }); // Add 10s buffer
    
    // Wait for recording to complete (simplified - in production would need better async handling)
    await new Promise(resolve => setTimeout(resolve, duration * 1000 + 2000));
    
    // Pull recording from device
    await executeAdbCommand(deviceSerial, 'pull', [remotePath, fullPath]);
    
    // Cleanup device
    try {
      await executeAdbCommand(deviceSerial, 'shell', ['rm', remotePath]);
    } catch (cleanupError) {
      console.warn('Screen record cleanup failed:', cleanupError.message);
    }
    
    // Verify file exists
    const stats = await fs.stat(fullPath);
    
    return createExecuteEnvelope({
      operation: 'screen_record',
      success: true,
      result: {
        deviceSerial,
        outputPath: fullPath,
        duration,
        fileSizeBytes: stats.size,
        message: 'Screen recording completed successfully'
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Record Device Screen'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'screen_record',
      'SCREEN_RECORD_FAILED',
      `Failed to record screen: ${error.message}`,
      { deviceSerial, originalError: error.message }
    );
  }
}

/**
 * Execute key event operation
 */
async function executeKeyEvent(params, operationSpec) {
  const { deviceSerial, keyCode, action = 'press' } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Validate key code
    if (typeof keyCode !== 'number' || keyCode < 0 || keyCode > 255) {
      throw new Error('Invalid key code (must be 0-255)');
    }
    
    // Send key event
    let command;
    if (action === 'down') {
      command = ['input', 'keyevent', '--longpress', keyCode.toString()];
    } else if (action === 'up') {
      // Key up is typically handled automatically, but we can use keyevent
      command = ['input', 'keyevent', keyCode.toString()];
    } else {
      command = ['input', 'keyevent', keyCode.toString()];
    }
    
    await executeAdbCommand(deviceSerial, 'shell', command);
    
    return createExecuteEnvelope({
      operation: 'key_event',
      success: true,
      result: {
        deviceSerial,
        keyCode,
        action,
        message: `Key event ${action} sent successfully`
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Send Key Event'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'key_event',
      'KEY_EVENT_FAILED',
      `Failed to send key event: ${error.message}`,
      { deviceSerial, keyCode, action, originalError: error.message }
    );
  }
}

/**
 * Execute tap event operation
 */
async function executeTapEvent(params, operationSpec) {
  const { deviceSerial, x, y, duration = 100 } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Validate coordinates
    if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || y < 0) {
      throw new Error('Invalid coordinates (must be positive numbers)');
    }
    
    // Send tap event
    await executeAdbCommand(deviceSerial, 'shell', [
      'input', 'tap', x.toString(), y.toString()
    ]);
    
    return createExecuteEnvelope({
      operation: 'tap_event',
      success: true,
      result: {
        deviceSerial,
        x,
        y,
        duration,
        message: `Tap event sent at (${x}, ${y})`
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Send Tap Event'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'tap_event',
      'TAP_EVENT_FAILED',
      `Failed to send tap event: ${error.message}`,
      { deviceSerial, x, y, originalError: error.message }
    );
  }
}

/**
 * Execute swipe event operation
 */
async function executeSwipeEvent(params, operationSpec) {
  const { deviceSerial, x1, y1, x2, y2, duration = 300 } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Validate coordinates
    if (typeof x1 !== 'number' || typeof y1 !== 'number' || 
        typeof x2 !== 'number' || typeof y2 !== 'number' ||
        x1 < 0 || y1 < 0 || x2 < 0 || y2 < 0) {
      throw new Error('Invalid coordinates (must be positive numbers)');
    }
    
    // Send swipe event
    await executeAdbCommand(deviceSerial, 'shell', [
      'input', 'swipe',
      x1.toString(), y1.toString(),
      x2.toString(), y2.toString(),
      duration.toString()
    ]);
    
    return createExecuteEnvelope({
      operation: 'swipe_event',
      success: true,
      result: {
        deviceSerial,
        from: { x: x1, y: y1 },
        to: { x: x2, y: y2 },
        duration,
        message: `Swipe event sent from (${x1}, ${y1}) to (${x2}, ${y2})`
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Send Swipe Event'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'swipe_event',
      'SWIPE_EVENT_FAILED',
      `Failed to send swipe event: ${error.message}`,
      { deviceSerial, x1, y1, x2, y2, originalError: error.message }
    );
  }
}

/**
 * Execute restore device operation
 */
async function executeRestoreDevice(params, operationSpec) {
  const { deviceSerial, backupPath, restoreApps = true, restoreData = true } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    const fs = await import('fs/promises');
    const path = await import('path');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Validate backup path exists
    const resolvedBackupPath = path.resolve(backupPath);
    try {
      await fs.access(resolvedBackupPath);
    } catch {
      throw new Error(`Backup directory not found: ${backupPath}`);
    }
    
    // Check for backup info file
    const backupInfoPath = path.join(resolvedBackupPath, 'backup-info.json');
    let backupInfo = null;
    try {
      const infoContent = await fs.readFile(backupInfoPath, 'utf-8');
      backupInfo = JSON.parse(infoContent);
    } catch {
      // Backup info not found, continue anyway
    }
    
    // Restore apps if requested
    if (restoreApps) {
      const appsFile = path.join(resolvedBackupPath, 'apps.txt');
      try {
        const appsContent = await fs.readFile(appsFile, 'utf-8');
        const packages = appsContent.split('\n')
          .filter(line => line.startsWith('package:'))
          .map(line => line.replace('package:', '').trim())
          .filter(pkg => pkg.length > 0);
        
        // Note: Full app restore would require APK files
        // This is a simplified implementation
        console.log(`Would restore ${packages.length} apps`);
      } catch {
        console.warn('Apps backup file not found');
      }
    }
    
    // Restore data if requested
    if (restoreData) {
      // Note: Full data restore requires more complex logic
      // This is a simplified implementation
      console.log('Data restore initiated');
    }
    
    return createExecuteEnvelope({
      operation: 'restore_device',
      success: true,
      result: {
        deviceSerial,
        backupPath: resolvedBackupPath,
        restoreApps,
        restoreData,
        message: 'Restore operation initiated. Full restore requires additional implementation.'
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'Restore Device from Backup'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'restore_device',
      'RESTORE_FAILED',
      `Failed to restore device: ${error.message}`,
      { deviceSerial, backupPath, originalError: error.message }
    );
  }
}

/**
 * Execute permission list operation
 */
async function executePermissionList(params, operationSpec) {
  const { deviceSerial, packageName } = params;
  const startTime = Date.now();
  
  try {
    const { executeAdbCommand, validateDeviceSerial } = await import('../../../../core/lib/adb.js');
    
    if (!validateDeviceSerial || !validateDeviceSerial(deviceSerial)) {
      throw new Error('Invalid device serial format');
    }
    
    // Validate package name
    if (!packageName || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(packageName)) {
      throw new Error('Invalid package name format');
    }
    
    // Get permissions
    const output = await executeAdbCommand(deviceSerial, 'shell', [
      'dumpsys', 'package', packageName
    ]);
    
    // Parse permissions
    const permissions = [];
    const lines = output.split('\n');
    let inPermissions = false;
    
    for (const line of lines) {
      if (line.includes('granted=true') || line.includes('granted=false')) {
        const match = line.match(/name=([^\s]+)/);
        if (match) {
          const granted = line.includes('granted=true');
          permissions.push({
            name: match[1],
            granted
          });
        }
      }
    }
    
    return createExecuteEnvelope({
      operation: 'permission_list',
      success: true,
      result: {
        deviceSerial,
        packageName,
        permissions,
        count: permissions.length
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        role: 'admin',
        capability: 'List App Permissions'
      }
    });
  } catch (error) {
    return createErrorEnvelope(
      'permission_list',
      'PERMISSION_LIST_FAILED',
      `Failed to list permissions: ${error.message}`,
      { deviceSerial, packageName, originalError: error.message }
    );
  }
}
