/**
 * System Metrics Collection
 * 
 * Real system metrics for CPU, memory, disk, and USB utilization.
 * No placeholders. No approximations where real data exists.
 */

import os from 'os';
import { execSync } from 'child_process';

// CPU usage tracking
let previousCpuInfo = null;

/**
 * Get CPU usage percentage
 */
export function getCpuUsage() {
  const cpus = os.cpus();
  
  let totalIdle = 0;
  let totalTick = 0;
  
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  
  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  
  if (!previousCpuInfo) {
    previousCpuInfo = { idle, total };
    return 0;
  }
  
  const idleDelta = idle - previousCpuInfo.idle;
  const totalDelta = total - previousCpuInfo.total;
  
  previousCpuInfo = { idle, total };
  
  if (totalDelta === 0) return 0;
  
  const usage = 100 - (100 * idleDelta / totalDelta);
  return Math.round(usage * 10) / 10;
}

/**
 * Get memory usage
 */
export function getMemoryUsage() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    total: totalMem,
    used: usedMem,
    free: freeMem,
    percentage: Math.round((usedMem / totalMem) * 1000) / 10
  };
}

/**
 * Get disk usage for the workspace
 */
export function getDiskUsage() {
  try {
    const platform = os.platform();
    
    if (platform === 'win32') {
      // Windows: use wmic
      const output = execSync('wmic logicaldisk get size,freespace,caption', { 
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true
      });
      const lines = output.trim().split('\n').slice(1);
      let totalSpace = 0;
      let freeSpace = 0;
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          freeSpace += parseInt(parts[1]) || 0;
          totalSpace += parseInt(parts[2]) || 0;
        }
      }
      
      const usedSpace = totalSpace - freeSpace;
      return {
        total: totalSpace,
        used: usedSpace,
        free: freeSpace,
        percentage: totalSpace > 0 ? Math.round((usedSpace / totalSpace) * 1000) / 10 : 0
      };
    } else {
      // Unix-like: use df
      const output = execSync('df -k / | tail -1', { 
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true
      });
      const parts = output.trim().split(/\s+/);
      
      if (parts.length >= 4) {
        const total = parseInt(parts[1]) * 1024;
        const used = parseInt(parts[2]) * 1024;
        const free = parseInt(parts[3]) * 1024;
        const percentage = parseInt(parts[4]) || 0;
        
        return { total, used, free, percentage };
      }
    }
  } catch (e) {
    // Fallback if command fails
  }
  
  return { total: 0, used: 0, free: 0, percentage: 0 };
}

/**
 * Get load averages (Unix-like systems)
 */
export function getLoadAverage() {
  const load = os.loadavg();
  return {
    '1m': Math.round(load[0] * 100) / 100,
    '5m': Math.round(load[1] * 100) / 100,
    '15m': Math.round(load[2] * 100) / 100
  };
}

/**
 * Get system uptime
 */
export function getUptime() {
  return {
    seconds: Math.round(os.uptime()),
    formatted: formatUptime(os.uptime())
  };
}

/**
 * Format uptime to human readable
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '< 1m';
}

/**
 * Get all system metrics
 */
export function getAllMetrics() {
  const memory = getMemoryUsage();
  const disk = getDiskUsage();
  
  return {
    cpu: getCpuUsage(),
    memory: memory.percentage,
    memoryDetails: memory,
    disk: disk.percentage,
    diskDetails: disk,
    loadAverage: getLoadAverage(),
    uptime: getUptime(),
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpuCount: os.cpus().length,
    timestamp: Date.now()
  };
}

/**
 * Estimate USB utilization based on transfer speed
 * @param {number} bytesPerSecond - Current transfer speed
 * @param {string} usbVersion - USB version (2.0, 3.0, 3.1, 3.2)
 */
export function estimateUsbUtilization(bytesPerSecond, usbVersion = '3.0') {
  // Max theoretical speeds in bytes/second
  const maxSpeeds = {
    '2.0': 60 * 1024 * 1024,    // 60 MB/s (480 Mbps)
    '3.0': 625 * 1024 * 1024,   // 625 MB/s (5 Gbps)
    '3.1': 1250 * 1024 * 1024,  // 1.25 GB/s (10 Gbps)
    '3.2': 2500 * 1024 * 1024   // 2.5 GB/s (20 Gbps)
  };
  
  const maxSpeed = maxSpeeds[usbVersion] || maxSpeeds['3.0'];
  const utilization = (bytesPerSecond / maxSpeed) * 100;
  
  return Math.min(100, Math.round(utilization * 10) / 10);
}
