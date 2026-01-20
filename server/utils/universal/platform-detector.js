/**
 * Universal Legend Status - Platform Detection System
 * Enterprise-grade platform detection for Windows, macOS, Linux, ARM64
 * 
 * Features:
 * - OS detection (Windows, macOS, Linux)
 * - Architecture detection (x86_64, ARM64, ARM)
 * - Platform capabilities detection
 * - Universal binary support detection
 */

import os from 'os';
import { execSync } from 'child_process';

class PlatformDetector {
  constructor() {
    this.platform = null;
    this.architecture = null;
    this.capabilities = null;
    this.detected = false;
  }

  /**
   * Detect platform and architecture
   */
  detect() {
    if (this.detected) {
      return this.getInfo();
    }

    // Detect OS
    const platform = process.platform;
    let osType = 'unknown';
    let osVersion = null;
    let osName = null;

    switch (platform) {
      case 'win32':
        osType = 'windows';
        osVersion = os.release();
        osName = this.detectWindowsVersion();
        break;
      case 'darwin':
        osType = 'macos';
        osVersion = os.release();
        osName = this.detectMacOSVersion();
        break;
      case 'linux':
        osType = 'linux';
        osVersion = os.release();
        osName = this.detectLinuxDistribution();
        break;
    }

    // Detect architecture
    const arch = process.arch;
    let architecture = 'unknown';
    let architectureBits = null;

    switch (arch) {
      case 'x64':
        architecture = 'x86_64';
        architectureBits = 64;
        break;
      case 'arm64':
        architecture = 'arm64';
        architectureBits = 64;
        break;
      case 'arm':
        architecture = 'arm';
        architectureBits = 32;
        break;
      case 'ia32':
        architecture = 'x86';
        architectureBits = 32;
        break;
    }

    // Detect capabilities
    const capabilities = this.detectCapabilities(osType, architecture);

    this.platform = {
      os: {
        type: osType,
        name: osName,
        version: osVersion,
        platform: platform,
        release: os.release()
      },
      architecture: {
        type: architecture,
        bits: architectureBits,
        raw: arch,
        endianness: os.endianness()
      },
      capabilities
    };

    this.detected = true;
    return this.getInfo();
  }

  /**
   * Detect Windows version
   */
  detectWindowsVersion() {
    try {
      const release = os.release();
      const version = parseFloat(release);
      
      if (version >= 10.0) {
        return 'Windows 10/11';
      } else if (version >= 6.3) {
        return 'Windows 8.1';
      } else if (version >= 6.2) {
        return 'Windows 8';
      } else if (version >= 6.1) {
        return 'Windows 7';
      }
      return 'Windows';
    } catch (error) {
      return 'Windows';
    }
  }

  /**
   * Detect macOS version
   */
  detectMacOSVersion() {
    try {
      const release = os.release();
      const version = parseFloat(release);
      
      // macOS version mapping (simplified)
      if (version >= 22.0) {
        return 'macOS Ventura/Sonoma';
      } else if (version >= 21.0) {
        return 'macOS Monterey';
      } else if (version >= 20.0) {
        return 'macOS Big Sur';
      }
      return 'macOS';
    } catch (error) {
      return 'macOS';
    }
  }

  /**
   * Detect Linux distribution
   */
  detectLinuxDistribution() {
    try {
      // Try to read /etc/os-release
      const osRelease = execSync('cat /etc/os-release 2>/dev/null || echo ""', { encoding: 'utf8' });
      const lines = osRelease.split('\n');
      let name = 'Linux';
      let version = null;

      for (const line of lines) {
        if (line.startsWith('PRETTY_NAME=')) {
          name = line.split('=')[1].replace(/"/g, '');
        } else if (line.startsWith('VERSION_ID=')) {
          version = line.split('=')[1].replace(/"/g, '');
        }
      }

      return version ? `${name} ${version}` : name;
    } catch (error) {
      return 'Linux';
    }
  }

  /**
   * Detect platform capabilities
   */
  detectCapabilities(osType, architecture) {
    const capabilities = {
      usb: {
        supported: true,
        native: osType !== 'linux' || this.checkLinuxUSB(),
        webusb: true
      },
      adb: {
        supported: true,
        available: this.checkToolAvailable('adb'),
        path: this.findToolPath('adb')
      },
      fastboot: {
        supported: true,
        available: this.checkToolAvailable('fastboot'),
        path: this.findToolPath('fastboot')
      },
      ios: {
        supported: osType === 'macos' || osType === 'linux',
        available: this.checkToolAvailable('idevice_id'),
        path: this.findToolPath('idevice_id')
      },
      rust: {
        supported: true,
        available: this.checkToolAvailable('cargo'),
        path: this.findToolPath('cargo')
      },
      python: {
        supported: true,
        available: this.checkToolAvailable('python3') || this.checkToolAvailable('python'),
        path: this.findToolPath('python3') || this.findToolPath('python')
      },
      node: {
        supported: true,
        available: true,
        version: process.version
      },
      universalBinary: {
        supported: osType === 'macos' && architecture === 'arm64',
        // macOS on ARM can run x86_64 binaries via Rosetta
        rosetta: osType === 'macos' && architecture === 'arm64'
      }
    };

    return capabilities;
  }

  /**
   * Check if tool is available
   */
  checkToolAvailable(tool) {
    try {
      if (process.platform === 'win32') {
        execSync(`where ${tool} >nul 2>&1`, { stdio: 'ignore' });
      } else {
        execSync(`which ${tool} >/dev/null 2>&1`, { stdio: 'ignore' });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Find tool path
   */
  findToolPath(tool) {
    try {
      if (process.platform === 'win32') {
        const path = execSync(`where ${tool}`, { encoding: 'utf8' }).trim();
        return path.split('\n')[0];
      } else {
        return execSync(`which ${tool}`, { encoding: 'utf8' }).trim();
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Check Linux USB support
   */
  checkLinuxUSB() {
    try {
      // Check if udev rules exist or user is in dialout/plugdev group
      const groups = execSync('groups', { encoding: 'utf8' });
      return groups.includes('dialout') || groups.includes('plugdev');
    } catch (error) {
      return false;
    }
  }

  /**
   * Get platform info
   */
  getInfo() {
    if (!this.detected) {
      this.detect();
    }
    return {
      ...this.platform,
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime()
    };
  }

  /**
   * Check if platform supports feature
   */
  supports(feature) {
    if (!this.detected) {
      this.detect();
    }
    return this.capabilities[feature]?.supported || false;
  }

  /**
   * Check if tool is available
   */
  hasTool(tool) {
    if (!this.detected) {
      this.detect();
    }
    return this.capabilities[tool]?.available || false;
  }
}

// Singleton instance
const platformDetector = new PlatformDetector();
platformDetector.detect(); // Auto-detect on load

export default platformDetector;
