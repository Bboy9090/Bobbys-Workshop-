/**
 * GET /api/v1/system-tools
 * 
 * System tools detection endpoint (migrated to v1 with envelope)
 */

import { execSync, spawnSync } from 'child_process';
import { commandExistsInPath } from '../../utils/safe-exec.js';
import { existsSync } from 'fs';
import { join } from 'path';

function safeExec(cmd) {
  try {
    return execSync(cmd, { 
      encoding: "utf-8", 
      timeout: 5000,
      windowsHide: true
    }).trim();
  } catch {
    return null;
  }
}

function commandExists(cmd) {
  try {
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
      if (!commandExistsInPath(cmd)) {
        return false;
      }
      return true;
    }
  } catch {
    return false;
  }
}

function getAndroidToolDiagnostics(toolName) {
  const installed = commandExists(toolName);
  if (!installed) {
    return { installed: false, version: null, path: null };
  }

  let version = null;
  try {
    const output = execSync(`${toolName} --version`, { 
      encoding: "utf-8", 
      timeout: 5000,
      windowsHide: true
    });
    version = output.trim().split('\n')[0];
  } catch {
    // Version check failed
  }

  let path = null;
  try {
    if (process.platform === 'win32') {
      // Check PATH directly without calling where.exe to prevent console windows
      const pathEnv = process.env.PATH || '';
      const pathDirs = pathEnv.split(';');
      const extensions = process.env.PATHEXT ? process.env.PATHEXT.split(';') : ['.exe', '.cmd', '.bat', '.com'];
      
      for (const dir of pathDirs) {
        if (!dir) continue;
        for (const ext of extensions) {
          const fullPath = join(dir, toolName + ext);
          if (existsSync(fullPath)) {
            path = fullPath;
            break;
          }
        }
        if (path) break;
      }
    } else {
      if (process.platform === 'win32') {
        // Use native PATH check
        const pathEnv = process.env.PATH || '';
        const pathDirs = pathEnv.split(';');
        const extensions = process.env.PATHEXT ? process.env.PATHEXT.split(';') : ['.exe', '.cmd', '.bat', '.com'];
        for (const dir of pathDirs) {
          if (!dir) continue;
          for (const ext of extensions) {
            const fullPath = join(dir, toolName + ext);
            if (existsSync(fullPath)) {
              path = fullPath;
              break;
            }
          }
          if (path) break;
        }
      } else {
        const result = spawnSync('which', [toolName], { 
          encoding: "utf-8", 
          timeout: 2000,
          windowsHide: true,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        if (result.status === 0) {
          path = (result.stdout || '').trim();
        }
      }
    }
  } catch {
    // Path check failed
  }

  return { installed, version, path };
}

export function systemToolsHandler(req, res) {
  const rustVersion = safeExec("rustc --version");
  const cargoVersion = safeExec("cargo --version");
  const nodeVersion = safeExec("node --version");
  const npmVersion = safeExec("npm --version");
  const pythonVersion = safeExec("python3 --version");
  const pipVersion = safeExec("pip3 --version");
  const gitVersion = safeExec("git --version");
  const dockerVersion = safeExec("docker --version");
  
  const adbDiagnostics = getAndroidToolDiagnostics('adb');
  const fastbootDiagnostics = getAndroidToolDiagnostics('fastboot');
  const adbInstalled = commandExists("adb");
  const fastbootInstalled = commandExists("fastboot");
  
  let adbDevices = null;
  let adbVersion = null;
  try {
    if (adbInstalled) {
      adbVersion = safeExec("adb version");
      const devicesOutput = safeExec("adb devices -l");
      if (devicesOutput) {
        const lines = devicesOutput.split('\n').filter(line => line.trim() && !line.includes('List of devices'));
        adbDevices = lines.length;
      }
    }
  } catch {
    // ADB check failed
  }
  
  const data = {
    rust: {
      installed: !!rustVersion,
      version: rustVersion
    },
    cargo: {
      installed: !!cargoVersion,
      version: cargoVersion
    },
    node: {
      installed: !!nodeVersion,
      version: nodeVersion
    },
    npm: {
      installed: !!npmVersion,
      version: npmVersion
    },
    python: {
      installed: !!pythonVersion,
      version: pythonVersion
    },
    pip: {
      installed: !!pipVersion,
      version: pipVersion
    },
    git: {
      installed: !!gitVersion,
      version: gitVersion
    },
    docker: {
      installed: !!dockerVersion,
      version: dockerVersion
    },
    android: {
      adb: {
        ...adbDiagnostics,
        devicesDetected: adbDevices || 0,
        versionInfo: adbVersion
      },
      fastboot: fastbootDiagnostics
    }
  };
  
  res.sendEnvelope(data);
}

