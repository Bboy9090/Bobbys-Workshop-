/**
 * Network Monitoring API
 * 
 * Provides network traffic analysis and monitoring for connected devices.
 * Tracks network usage, signal strength, and connection quality.
 * 
 * @module network-monitor
 */

import express from 'express';
import ADBLibrary from '../../../../core/lib/adb.js';
import { safeSpawn, commandExistsSafe } from '../../../utils/safe-exec.js';

const router = express.Router();

/**
 * Get network statistics for an Android device
 * @param {string} deviceSerial - Device serial number
 * @returns {Promise<Object>} Network statistics
 */
async function getNetworkStatistics(deviceSerial) {
  try {
    // Get network statistics from /proc/net/dev (Android)
    const netStatsResult = await ADBLibrary.shell(deviceSerial, 'cat /proc/net/dev');
    if (!netStatsResult.success) {
      return { success: false, error: netStatsResult.error };
    }

    // Parse network statistics
    const lines = netStatsResult.stdout.trim().split('\n').slice(2); // Skip header lines
    const interfaces = {};
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 10) {
        const iface = parts[0].replace(':', '');
        interfaces[iface] = {
          name: iface,
          rxBytes: parseInt(parts[1]) || 0,
          rxPackets: parseInt(parts[2]) || 0,
          rxErrors: parseInt(parts[3]) || 0,
          rxDropped: parseInt(parts[4]) || 0,
          txBytes: parseInt(parts[9]) || 0,
          txPackets: parseInt(parts[10]) || 0,
          txErrors: parseInt(parts[11]) || 0,
          txDropped: parseInt(parts[12]) || 0
        };
      }
    }

    // Get WiFi signal strength
    const wifiSignalResult = await ADBLibrary.shell(deviceSerial, 'dumpsys wifi | grep -i "signal" | head -1');
    const wifiSignal = wifiSignalResult.success ? wifiSignalResult.stdout.trim() : null;

    // Get cellular signal strength
    const cellularSignalResult = await ADBLibrary.shell(deviceSerial, 'dumpsys telephony.registry | grep -i "signal" | head -1');
    const cellularSignal = cellularSignalResult.success ? cellularSignalResult.stdout.trim() : null;

    // Get active network interfaces
    const activeInterfaces = Object.values(interfaces).filter(iface => 
      iface.rxBytes > 0 || iface.txBytes > 0
    );

    // Calculate total traffic
    const totalRxBytes = activeInterfaces.reduce((sum, iface) => sum + iface.rxBytes, 0);
    const totalTxBytes = activeInterfaces.reduce((sum, iface) => sum + iface.txBytes, 0);
    const totalBytes = totalRxBytes + totalTxBytes;

    return {
      success: true,
      interfaces,
      activeInterfaces: activeInterfaces.map(iface => iface.name),
      totals: {
        rxBytes: totalRxBytes,
        txBytes: totalTxBytes,
        totalBytes,
        rxPackets: activeInterfaces.reduce((sum, iface) => sum + iface.rxPackets, 0),
        txPackets: activeInterfaces.reduce((sum, iface) => sum + iface.txPackets, 0),
        rxErrors: activeInterfaces.reduce((sum, iface) => sum + iface.rxErrors, 0),
        txErrors: activeInterfaces.reduce((sum, iface) => sum + iface.txErrors, 0)
      },
      wifiSignal,
      cellularSignal,
      timestamp: Date.now()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get network connection info
 * @param {string} deviceSerial - Device serial number
 * @returns {Promise<Object>} Connection information
 */
async function getConnectionInfo(deviceSerial) {
  try {
    // Get active network connection type
    const connectionTypeResult = await ADBLibrary.shell(deviceSerial, 'dumpsys connectivity | grep -i "active" | head -1');
    const connectionType = connectionTypeResult.success ? connectionTypeResult.stdout.trim() : null;

    // Get WiFi SSID
    const wifiSsidResult = await ADBLibrary.shell(deviceSerial, 'dumpsys wifi | grep -i "ssid" | head -1');
    const wifiSsid = wifiSsidResult.success ? wifiSsidResult.stdout.trim() : null;

    // Get IP address
    const ipResult = await ADBLibrary.shell(deviceSerial, 'ip addr show | grep "inet " | head -1');
    const ipAddress = ipResult.success ? ipResult.stdout.trim().match(/inet\s+([\d.]+)/)?.[1] : null;

    // Get DNS servers
    const dnsResult = await ADBLibrary.shell(deviceSerial, 'getprop net.dns1');
    const dnsServer = dnsResult.success ? dnsResult.stdout.trim() : null;

    return {
      success: true,
      connectionType,
      wifiSsid,
      ipAddress,
      dnsServer,
      timestamp: Date.now()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * GET /api/v1/monitor/network/:serial
 * Get network statistics for a device
 */
router.get('/:serial', async (req, res) => {
  const { serial } = req.params;

  try {
    // Verify device is connected
    const devicesResult = await ADBLibrary.listDevices();
    if (!devicesResult.success) {
      return res.sendError('DEVICE_SCAN_FAILED', 'Failed to scan for devices', {
        error: devicesResult.error
      }, 500);
    }

    const device = devicesResult.devices.find(d => d.serial === serial);
    if (!device) {
      return res.sendError('DEVICE_NOT_FOUND', 'Device not found or not connected', {
        serial,
        availableDevices: devicesResult.devices.map(d => d.serial)
      }, 404);
    }

    if (device.state !== 'device') {
      return res.sendError('DEVICE_NOT_READY', 'Device must be in device state for network monitoring', {
        serial,
        currentState: device.state,
        requiredState: 'device'
      }, 400);
    }

    // Get network statistics
    const [statsResult, connectionResult] = await Promise.all([
      getNetworkStatistics(serial),
      getConnectionInfo(serial)
    ]);

    if (!statsResult.success) {
      return res.sendError('NETWORK_STATS_FAILED', statsResult.error, {
        serial
      }, 500);
    }

    res.sendEnvelope({
      serial,
      timestamp: new Date().toISOString(),
      statistics: statsResult,
      connection: connectionResult.success ? connectionResult : { error: connectionResult.error }
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to get network statistics', {
      error: error.message,
      serial
    }, 500);
  }
});

/**
 * GET /api/v1/monitor/network
 * Get network statistics for all connected devices
 */
router.get('/', async (req, res) => {
  try {
    // Get all devices
    const devicesResult = await ADBLibrary.listDevices();
    if (!devicesResult.success) {
      return res.sendError('DEVICE_SCAN_FAILED', 'Failed to scan for devices', {
        error: devicesResult.error
      }, 500);
    }

    // Get network statistics for each device
    const devices = devicesResult.devices.filter(d => d.state === 'device');
    const results = await Promise.all(
      devices.map(async (device) => {
        const statsResult = await getNetworkStatistics(device.serial);
        const connectionResult = await getConnectionInfo(device.serial);
        return {
          serial: device.serial,
          state: device.state,
          network: statsResult.success ? {
            totals: statsResult.totals,
            activeInterfaces: statsResult.activeInterfaces,
            wifiSignal: statsResult.wifiSignal,
            cellularSignal: statsResult.cellularSignal
          } : { error: statsResult.error },
          connection: connectionResult.success ? connectionResult : { error: connectionResult.error }
        };
      })
    );

    res.sendEnvelope({
      devices: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.sendError('INTERNAL_ERROR', 'Failed to get network statistics for devices', {
      error: error.message
    }, 500);
  }
});

export default router;
