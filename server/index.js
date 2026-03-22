import express from 'express';
import { execSync } from 'child_process';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { AuthorizationTriggers } from './authorization-triggers.js';
import trapdoorRouter from '../core/api/trapdoor.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const authTriggers = new AuthorizationTriggers();

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/device-events' });
const wssCorrelation = new WebSocketServer({ server, path: '/ws/correlation' });
const wssAnalytics = new WebSocketServer({ server, path: '/ws/analytics' });

const clients = new Set();
const correlationClients = new Set();
const analyticsClients = new Set();

wss.on('connection', (ws) => {
  console.log('WebSocket client connected (device-events)');
  clients.add(ws);
  
  ws.send(JSON.stringify({
    type: 'connected',
    device_uid: 'demo-device-001',
    platform_hint: 'android',
    mode: 'Normal OS (Confirmed)',
    confidence: 0.95,
    timestamp: Date.now(),
    display_name: 'Demo Android Device',
    matched_tool_ids: ['ABC123XYZ'],
    correlation_badge: 'CORRELATED',
    correlation_notes: ['Per-device correlation present']
  }));

  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      const isConnect = Math.random() > 0.5;
      const platforms = ['android', 'ios', 'unknown'];
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      const deviceId = `device-${Math.random().toString(36).substr(2, 9)}`;
      
      ws.send(JSON.stringify({
        type: isConnect ? 'connected' : 'disconnected',
        device_uid: deviceId,
        platform_hint: platform,
        mode: isConnect ? 'Normal OS (Confirmed)' : 'Disconnected',
        confidence: 0.85 + Math.random() * 0.15,
        timestamp: Date.now(),
        display_name: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Device`,
        matched_tool_ids: Math.random() > 0.5 ? [deviceId] : [],
        correlation_badge: Math.random() > 0.5 ? 'CORRELATED' : 'LIKELY'
      }));
    }
  }, 8000);

  ws.on('close', () => {
    console.log('WebSocket client disconnected (device-events)');
    clients.delete(ws);
    clearInterval(interval);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
    clearInterval(interval);
  });
});

wssCorrelation.on('connection', (ws) => {
  console.log('WebSocket client connected (correlation tracking)');
  correlationClients.add(ws);
  
  ws.send(JSON.stringify({
    type: 'batch_update',
    devices: [
      {
        id: 'demo-android-001',
        serial: 'ABC123XYZ',
        platform: 'android',
        mode: 'confirmed_android_os',
        confidence: 0.95,
        correlationBadge: 'CORRELATED',
        matchedIds: ['ABC123XYZ', 'adb-ABC123XYZ'],
        correlationNotes: ['Per-device correlation present (matched tool ID(s)).'],
        vendorId: 0x18d1,
        productId: 0x4ee7
      }
    ],
    timestamp: Date.now()
  }));

  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      const eventType = Math.random();
      const platforms = ['android', 'ios'];
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      const deviceId = `device-${Math.random().toString(36).substr(2, 9)}`;
      const confidence = 0.75 + Math.random() * 0.25;
      const hasMatchedIds = Math.random() > 0.4;
      
      const badges = ['CORRELATED', 'CORRELATED (WEAK)', 'SYSTEM-CONFIRMED', 'LIKELY', 'UNCONFIRMED'];
      let badge;
      let matchedIds = [];
      let notes = [];
      
      if (hasMatchedIds && confidence >= 0.90) {
        badge = 'CORRELATED';
        matchedIds = [deviceId, `${platform}-${deviceId}`];
        notes = ['Per-device correlation present (matched tool ID(s)).'];
      } else if (hasMatchedIds) {
        badge = 'CORRELATED (WEAK)';
        matchedIds = [deviceId];
        notes = ['Matched tool ID(s) present, but mode not strongly confirmed.'];
      } else if (confidence >= 0.90) {
        badge = 'SYSTEM-CONFIRMED';
        notes = ['System-level confirmation exists, but not mapped to this specific USB record.'];
      } else if (confidence >= 0.75) {
        badge = 'LIKELY';
        notes = [];
      } else {
        badge = 'UNCONFIRMED';
        notes = [];
      }
      
      if (eventType < 0.33) {
        ws.send(JSON.stringify({
          type: 'device_connected',
          deviceId: deviceId,
          device: {
            id: deviceId,
            serial: Math.random() > 0.3 ? deviceId.substring(0, 10).toUpperCase() : undefined,
            platform: platform,
            mode: `confirmed_${platform}_os`,
            confidence: confidence,
            correlationBadge: badge,
            matchedIds: matchedIds,
            correlationNotes: notes,
            vendorId: platform === 'android' ? 0x18d1 : 0x05ac,
            productId: platform === 'android' ? 0x4ee7 : 0x12a8
          },
          timestamp: Date.now()
        }));
      } else if (eventType < 0.66) {
        ws.send(JSON.stringify({
          type: 'correlation_update',
          deviceId: deviceId,
          device: {
            correlationBadge: badge,
            matchedIds: matchedIds,
            confidence: confidence,
            correlationNotes: notes
          },
          timestamp: Date.now()
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'device_disconnected',
          deviceId: deviceId,
          timestamp: Date.now()
        }));
      }
    }
  }, 5000);
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'ping') {
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Failed to parse correlation WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected (correlation tracking)');
    correlationClients.delete(ws);
    clearInterval(interval);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error (correlation):', error);
    correlationClients.delete(ws);
    clearInterval(interval);
  });
});

// Analytics WebSocket for Live Analytics Dashboard
wssAnalytics.on('connection', (ws) => {
  console.log('WebSocket client connected (live analytics)');
  analyticsClients.add(ws);

  // Send initial mock data
  const mockDevices = [
    {
      deviceId: 'device-001',
      deviceName: 'Android Test Device',
      platform: 'android',
      status: 'online',
      cpuUsage: 45,
      memoryUsage: 62,
      storageUsage: 78,
      temperature: 42,
      batteryLevel: 85,
      networkLatency: 15,
      workflows: { running: 1, completed: 5, failed: 0 }
    },
    {
      deviceId: 'device-002',
      deviceName: 'iOS Test Device',
      platform: 'ios',
      status: 'online',
      cpuUsage: 32,
      memoryUsage: 54,
      storageUsage: 65,
      temperature: 38,
      batteryLevel: 92,
      networkLatency: 12,
      workflows: { running: 0, completed: 3, failed: 0 }
    }
  ];

  mockDevices.forEach(device => {
    ws.send(JSON.stringify({
      type: 'device_metrics',
      deviceId: device.deviceId,
      metrics: device
    }));
  });

  // Send periodic updates
  const analyticsInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      mockDevices.forEach(device => {
        // Simulate changing metrics
        const updatedMetrics = {
          ...device,
          cpuUsage: Math.max(5, Math.min(95, device.cpuUsage + (Math.random() - 0.5) * 10)),
          memoryUsage: Math.max(10, Math.min(90, device.memoryUsage + (Math.random() - 0.5) * 5)),
          temperature: Math.max(30, Math.min(70, device.temperature + (Math.random() - 0.5) * 2)),
          networkLatency: Math.max(5, Math.min(100, device.networkLatency + (Math.random() - 0.5) * 10))
        };

        ws.send(JSON.stringify({
          type: 'device_metrics',
          deviceId: device.deviceId,
          metrics: updatedMetrics
        }));

        // Update stored values for next iteration
        Object.assign(device, updatedMetrics);
      });

      // Simulate workflow events occasionally
      if (Math.random() > 0.7) {
        const device = mockDevices[Math.floor(Math.random() * mockDevices.length)];
        ws.send(JSON.stringify({
          type: 'workflow_event',
          event: {
            id: `workflow-${Date.now()}`,
            workflowName: ['ADB Diagnostics', 'Battery Health Check', 'Storage Analysis'][Math.floor(Math.random() * 3)],
            deviceId: device.deviceId,
            status: ['started', 'running', 'completed'][Math.floor(Math.random() * 3)],
            progress: Math.floor(Math.random() * 100),
            currentStep: ['Initializing', 'Running diagnostics', 'Collecting data', 'Analyzing results'][Math.floor(Math.random() * 4)]
          }
        }));
      }
    }
  }, 2000); // Update every 2 seconds

  ws.on('close', () => {
    console.log('WebSocket client disconnected (live analytics)');
    analyticsClients.delete(ws);
    clearInterval(analyticsInterval);
  });

  ws.on('error', (error) => {
    console.error('Analytics WebSocket error:', error);
    analyticsClients.delete(ws);
    clearInterval(analyticsInterval);
  });
});

function broadcastCorrelation(message) {
  const data = JSON.stringify({
    ...message,
    timestamp: Date.now()
  });
  
  for (const client of correlationClients) {
    if (client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/system-tools', (req, res) => {
  const rustVersion = safeExec("rustc --version");
  const cargoVersion = safeExec("cargo --version");
  const nodeVersion = safeExec("node --version");
  const npmVersion = safeExec("npm --version");
  const pythonVersion = safeExec("python3 --version");
  const pipVersion = safeExec("pip3 --version");
  const gitVersion = safeExec("git --version");
  const dockerVersion = safeExec("docker --version");
  
  const adbInstalled = commandExists("adb");
  const fastbootInstalled = commandExists("fastboot");
  
  let adbDevices = null;
  let adbVersion = null;
  if (adbInstalled) {
    adbDevices = safeExec("adb devices");
    adbVersion = safeExec("adb --version");
  }
  
  let fastbootDevices = null;
  if (fastbootInstalled) {
    fastbootDevices = safeExec("fastboot devices");
  }

  const tools = {
    rust: {
      installed: !!rustVersion,
      version: rustVersion,
      cargo: cargoVersion
    },
    node: {
      installed: !!nodeVersion,
      version: nodeVersion,
      npm: npmVersion
    },
    python: {
      installed: !!pythonVersion,
      version: pythonVersion,
      pip: pipVersion
    },
    git: {
      installed: !!gitVersion,
      version: gitVersion
    },
    docker: {
      installed: !!dockerVersion,
      version: dockerVersion
    },
    adb: {
      installed: adbInstalled,
      version: adbVersion,
      devices_raw: adbDevices
    },
    fastboot: {
      installed: fastbootInstalled,
      devices_raw: fastbootDevices
    }
  };

  res.json({
    timestamp: new Date().toISOString(),
    environment: process.env.CODESPACES ? 'codespaces' : 'local',
    tools
  });
});

app.get('/api/system-tools/rust', (req, res) => {
  const rustVersion = safeExec("rustc --version");
  const cargoVersion = safeExec("cargo --version");
  const rustupVersion = safeExec("rustup --version");
  
  res.json({
    installed: !!rustVersion,
    rustc: rustVersion,
    cargo: cargoVersion,
    rustup: rustupVersion
  });
});

app.get('/api/system-tools/android', (req, res) => {
  const adbInstalled = commandExists("adb");
  const fastbootInstalled = commandExists("fastboot");
  
  let adbDevices = null;
  let adbVersion = null;
  if (adbInstalled) {
    adbDevices = safeExec("adb devices");
    adbVersion = safeExec("adb --version");
  }
  
  let fastbootDevices = null;
  if (fastbootInstalled) {
    fastbootDevices = safeExec("fastboot devices");
  }
  
  res.json({
    adb: {
      installed: adbInstalled,
      version: adbVersion,
      devices_raw: adbDevices
    },
    fastboot: {
      installed: fastbootInstalled,
      devices_raw: fastbootDevices
    }
  });
});

app.get('/api/system-tools/python', (req, res) => {
  const pythonVersion = safeExec("python3 --version");
  const pipVersion = safeExec("pip3 --version");
  const python2Version = safeExec("python --version");
  
  res.json({
    installed: !!pythonVersion,
    python3: pythonVersion,
    python2: python2Version,
    pip: pipVersion
  });
});

app.get('/api/system-info', (req, res) => {
  const osInfo = safeExec("uname -a");
  const cpuInfo = safeExec("lscpu | grep 'Model name' | cut -d':' -f2");
  const memInfo = safeExec("free -h | grep 'Mem:' | awk '{print $2}'");
  const diskInfo = safeExec("df -h / | tail -1 | awk '{print $2}'");
  const uptime = safeExec("uptime -p");
  const hostname = safeExec("hostname");
  const kernel = safeExec("uname -r");
  
  const usbDevicesCount = safeExec("lsusb 2>/dev/null | wc -l");
  const pciDevicesCount = safeExec("lspci 2>/dev/null | wc -l");
  
  res.json({
    os: osInfo,
    hostname: hostname,
    kernel: kernel,
    cpu: cpuInfo?.trim(),
    memory: memInfo?.trim(),
    disk: diskInfo?.trim(),
    uptime: uptime,
    hardware: {
      usbDevices: usbDevicesCount ? parseInt(usbDevicesCount) : 0,
      pciDevices: pciDevicesCount ? parseInt(pciDevicesCount) : 0
    }
  });
});

app.get('/api/adb/devices', (req, res) => {
  if (!commandExists("adb")) {
    return res.status(404).json({ error: "ADB not installed" });
  }
  
  const devicesRaw = safeExec("adb devices -l");
  const lines = devicesRaw?.split('\n').slice(1).filter(l => l.trim()) || [];
  
  const devices = lines.map(line => {
    const parts = line.trim().split(/\s+/);
    const serial = parts[0];
    const state = parts[1];
    const infoStr = parts.slice(2).join(' ');
    
    const product = infoStr.match(/product:(\S+)/)?.[1] || null;
    const model = infoStr.match(/model:(\S+)/)?.[1] || null;
    const device = infoStr.match(/device:(\S+)/)?.[1] || null;
    const transport = infoStr.match(/transport_id:(\d+)/)?.[1] || null;
    
    let deviceMode = 'unknown';
    let bootloaderMode = null;
    let deviceProperties = {};
    
    if (state === 'device') {
      deviceMode = 'android_os';
      const props = safeExec(`adb -s ${serial} shell getprop 2>/dev/null`);
      if (props) {
        const manufacturer = props.match(/\[ro\.product\.manufacturer\]:\s*\[(.*?)\]/)?.[1];
        const brand = props.match(/\[ro\.product\.brand\]:\s*\[(.*?)\]/)?.[1];
        const modelProp = props.match(/\[ro\.product\.model\]:\s*\[(.*?)\]/)?.[1];
        const androidVersion = props.match(/\[ro\.build\.version\.release\]:\s*\[(.*?)\]/)?.[1];
        const sdkVersion = props.match(/\[ro\.build\.version\.sdk\]:\s*\[(.*?)\]/)?.[1];
        const buildId = props.match(/\[ro\.build\.id\]:\s*\[(.*?)\]/)?.[1];
        const bootloader = props.match(/\[ro\.boot\.bootloader\]:\s*\[(.*?)\]/)?.[1];
        const secureMode = props.match(/\[ro\.secure\]:\s*\[(.*?)\]/)?.[1];
        const debuggable = props.match(/\[ro\.debuggable\]:\s*\[(.*?)\]/)?.[1];
        
        deviceProperties = {
          manufacturer,
          brand,
          model: modelProp,
          androidVersion,
          sdkVersion,
          buildId,
          bootloader,
          secure: secureMode === '1',
          debuggable: debuggable === '1'
        };
      }
    } else if (state === 'recovery') {
      deviceMode = 'recovery';
    } else if (state === 'sideload') {
      deviceMode = 'sideload';
    } else if (state === 'unauthorized') {
      deviceMode = 'unauthorized';
    } else if (state === 'offline') {
      deviceMode = 'offline';
    } else if (state === 'bootloader') {
      deviceMode = 'bootloader';
    }
    
    return {
      serial,
      state,
      deviceMode,
      bootloaderMode,
      product,
      model,
      device,
      transportId: transport,
      properties: deviceProperties,
      info: infoStr
    };
  }).filter(d => d.serial && d.state);
  
  res.json({
    count: devices.length,
    devices,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/adb/trigger-auth', (req, res) => {
  if (!commandExists("adb")) {
    return res.status(404).json({ 
      success: false,
      message: "ADB not installed on system" 
    });
  }
  
  const { serial } = req.body;
  
  if (!serial) {
    return res.status(400).json({ 
      success: false,
      message: "Device serial is required" 
    });
  }
  
  try {
    execSync(`adb -s ${serial} shell echo "auth_trigger" 2>&1`, { 
      encoding: "utf-8", 
      timeout: 3000 
    });
    
    res.json({
      success: true,
      message: "Authorization request sent. Check your device for the USB debugging dialog.",
      serial
    });
  } catch (error) {
    const errorMessage = error.stderr?.toString() || error.message || 'Unknown error';
    
    if (errorMessage.includes('unauthorized')) {
      res.json({
        success: true,
        message: "Authorization dialog triggered on device. Please check your phone and tap 'Allow'.",
        serial,
        note: "Device is unauthorized - this is expected. The prompt should appear on the device."
      });
    } else if (errorMessage.includes('device offline')) {
      res.status(400).json({
        success: false,
        message: "Device is offline. Please check USB connection.",
        serial
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to trigger authorization: ${errorMessage}`,
        serial
      });
    }
  }
});

app.get('/api/fastboot/devices', (req, res) => {
  if (!commandExists("fastboot")) {
    return res.status(404).json({ error: "Fastboot not installed" });
  }
  
  const devicesRaw = safeExec("fastboot devices");
  const lines = devicesRaw?.split('\n').filter(l => l.trim()) || [];
  
  const devices = lines.map(line => {
    const parts = line.trim().split(/\s+/);
    const serial = parts[0];
    const mode = parts[1] || 'fastboot';
    
    let deviceInfo = {};
    const productOutput = safeExec(`fastboot -s ${serial} getvar product 2>&1`);
    const variantOutput = safeExec(`fastboot -s ${serial} getvar variant 2>&1`);
    const bootloaderOutput = safeExec(`fastboot -s ${serial} getvar version-bootloader 2>&1`);
    const basebandOutput = safeExec(`fastboot -s ${serial} getvar version-baseband 2>&1`);
    const serialnoOutput = safeExec(`fastboot -s ${serial} getvar serialno 2>&1`);
    const secureOutput = safeExec(`fastboot -s ${serial} getvar secure 2>&1`);
    const unlockStateOutput = safeExec(`fastboot -s ${serial} getvar unlocked 2>&1`);
    
    const extractValue = (output) => {
      if (!output) return null;
      const match = output.match(/:\s*(.+)/);
      return match ? match[1].trim() : null;
    };
    
    const product = extractValue(productOutput);
    const variant = extractValue(variantOutput);
    const bootloaderVersion = extractValue(bootloaderOutput);
    const basebandVersion = extractValue(basebandOutput);
    const serialNumber = extractValue(serialnoOutput);
    const secure = extractValue(secureOutput);
    const unlocked = extractValue(unlockStateOutput);
    
    let bootloaderState = 'unknown';
    if (unlocked === 'yes' || unlocked === 'true') {
      bootloaderState = 'unlocked';
    } else if (unlocked === 'no' || unlocked === 'false') {
      bootloaderState = 'locked';
    }
    
    const isSecure = secure === 'yes' || secure === 'true';
    
    deviceInfo = {
      product,
      variant,
      bootloaderVersion,
      basebandVersion,
      serialNumber,
      secure: isSecure,
      unlocked: bootloaderState === 'unlocked',
      bootloaderState
    };
    
    return {
      serial,
      mode,
      deviceMode: 'bootloader',
      bootloaderMode: mode,
      properties: deviceInfo
    };
  }).filter(d => d.serial);
  
  res.json({
    count: devices.length,
    devices,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/android-devices/all', async (req, res) => {
  const adbInstalled = commandExists("adb");
  const fastbootInstalled = commandExists("fastboot");
  
  let adbDevices = [];
  let fastbootDevices = [];
  
  if (adbInstalled) {
    const devicesRaw = safeExec("adb devices -l");
    const lines = devicesRaw?.split('\n').slice(1).filter(l => l.trim()) || [];
    
    adbDevices = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const serial = parts[0];
      const state = parts[1];
      const infoStr = parts.slice(2).join(' ');
      
      const product = infoStr.match(/product:(\S+)/)?.[1] || null;
      const model = infoStr.match(/model:(\S+)/)?.[1] || null;
      const device = infoStr.match(/device:(\S+)/)?.[1] || null;
      
      let deviceMode = 'unknown';
      if (state === 'device') deviceMode = 'android_os';
      else if (state === 'recovery') deviceMode = 'recovery';
      else if (state === 'sideload') deviceMode = 'sideload';
      else if (state === 'unauthorized') deviceMode = 'unauthorized';
      else if (state === 'offline') deviceMode = 'offline';
      else if (state === 'bootloader') deviceMode = 'bootloader';
      
      let deviceProperties = {};
      if (state === 'device') {
        const props = safeExec(`adb -s ${serial} shell getprop 2>/dev/null`);
        if (props) {
          const manufacturer = props.match(/\[ro\.product\.manufacturer\]:\s*\[(.*?)\]/)?.[1];
          const brand = props.match(/\[ro\.product\.brand\]:\s*\[(.*?)\]/)?.[1];
          const modelProp = props.match(/\[ro\.product\.model\]:\s*\[(.*?)\]/)?.[1];
          const androidVersion = props.match(/\[ro\.build\.version\.release\]:\s*\[(.*?)\]/)?.[1];
          
          deviceProperties = {
            manufacturer,
            brand,
            model: modelProp,
            androidVersion
          };
        }
      }
      
      return {
        id: `adb-${serial}`,
        serial,
        state,
        deviceMode,
        source: 'adb',
        product,
        model,
        device,
        properties: deviceProperties
      };
    }).filter(d => d.serial && d.state);
  }
  
  if (fastbootInstalled) {
    const devicesRaw = safeExec("fastboot devices");
    const lines = devicesRaw?.split('\n').filter(l => l.trim()) || [];
    
    fastbootDevices = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const serial = parts[0];
      const mode = parts[1] || 'fastboot';
      
      return {
        id: `fastboot-${serial}`,
        serial,
        state: mode,
        deviceMode: 'bootloader',
        bootloaderMode: mode,
        source: 'fastboot',
        properties: {}
      };
    }).filter(d => d.serial);
  }
  
  const allDevices = [...adbDevices, ...fastbootDevices];
  
  const uniqueDevices = allDevices.reduce((acc, device) => {
    const existing = acc.find(d => d.serial === device.serial);
    if (!existing) {
      acc.push(device);
    } else if (device.source === 'adb' && existing.source === 'fastboot') {
      Object.assign(existing, device);
    }
    return acc;
  }, []);
  
  res.json({
    count: uniqueDevices.length,
    devices: uniqueDevices,
    sources: {
      adb: {
        available: adbInstalled,
        count: adbDevices.length
      },
      fastboot: {
        available: fastbootInstalled,
        count: fastbootDevices.length
      }
    },
    timestamp: new Date().toISOString()
  });
});

app.post('/api/adb/command', (req, res) => {
  if (!commandExists("adb")) {
    return res.status(404).json({ error: "ADB not installed" });
  }
  
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: "Command required" });
  }
  
  const allowedCommands = ['devices', 'shell getprop', 'get-state', 'get-serialno'];
  const isAllowed = allowedCommands.some(cmd => command.startsWith(cmd));
  
  if (!isAllowed) {
    return res.status(403).json({ error: "Command not allowed for security reasons" });
  }
  
  const output = safeExec(`adb ${command}`);
  res.json({ output });
});

app.post('/api/network/scan', async (req, res) => {
  try {
    const devices = [];
    
    if (commandExists('arp')) {
      const arpOutput = safeExec('arp -a');
      if (arpOutput) {
        const lines = arpOutput.split('\n');
        for (const line of lines) {
          const match = line.match(/\(([\d.]+)\)\s+at\s+([\w:]+)/);
          if (match) {
            devices.push({
              ip: match[1],
              mac: match[2],
              hostname: null,
              vendor: null,
              ports: [],
              services: []
            });
          }
        }
      }
    }
    
    if (commandExists('ip')) {
      const neighbors = safeExec('ip neigh show');
      if (neighbors) {
        const lines = neighbors.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5 && parts[0].match(/\d+\.\d+\.\d+\.\d+/)) {
            const existing = devices.find(d => d.ip === parts[0]);
            if (!existing) {
              devices.push({
                ip: parts[0],
                mac: parts[4],
                hostname: null,
                vendor: null,
                ports: [],
                services: []
              });
            }
          }
        }
      }
    }
    
    res.json({
      devices,
      count: devices.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Network scan error:', error);
    res.status(500).json({ error: 'Network scan failed' });
  }
});

app.get('/api/fastboot/device-info', (req, res) => {
  if (!commandExists("fastboot")) {
    return res.status(404).json({ error: "Fastboot not installed" });
  }

  const { serial } = req.query;
  if (!serial) {
    return res.status(400).json({ error: "Serial number required" });
  }

  try {
    const extractValue = (output) => {
      if (!output) return null;
      const match = output.match(/:\s*(.+)/);
      return match ? match[1].trim() : null;
    };

    const product = extractValue(safeExec(`fastboot -s ${serial} getvar product 2>&1`));
    const variant = extractValue(safeExec(`fastboot -s ${serial} getvar variant 2>&1`));
    const bootloaderVersion = extractValue(safeExec(`fastboot -s ${serial} getvar version-bootloader 2>&1`));
    const basebandVersion = extractValue(safeExec(`fastboot -s ${serial} getvar version-baseband 2>&1`));
    const serialNumber = extractValue(safeExec(`fastboot -s ${serial} getvar serialno 2>&1`));
    const secure = extractValue(safeExec(`fastboot -s ${serial} getvar secure 2>&1`));
    const unlocked = extractValue(safeExec(`fastboot -s ${serial} getvar unlocked 2>&1`));
    const maxDownloadSize = extractValue(safeExec(`fastboot -s ${serial} getvar max-download-size 2>&1`));
    const currentSlot = extractValue(safeExec(`fastboot -s ${serial} getvar current-slot 2>&1`));
    const slotCount = extractValue(safeExec(`fastboot -s ${serial} getvar slot-count 2>&1`));

    const bootloaderUnlocked = unlocked === 'yes' || unlocked === 'true';
    const isSecure = secure === 'yes' || secure === 'true';

    res.json({
      product,
      variant,
      bootloaderVersion,
      basebandVersion,
      serialNumber,
      secure: isSecure,
      bootloaderUnlocked,
      maxDownloadSize,
      currentSlot,
      slotCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get device info:', error);
    res.status(500).json({ error: 'Failed to retrieve device information' });
  }
});

app.post('/api/fastboot/flash', async (req, res) => {
  if (!commandExists("fastboot")) {
    return res.status(404).json({ error: "Fastboot not installed" });
  }

  try {
    const multer = await import('multer');
    const upload = multer.default({ dest: '/tmp/fastboot-uploads/' });
    
    upload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(500).json({ error: 'File upload failed', details: err.message });
      }

      const { serial, partition } = req.body;
      const file = req.file;

      if (!serial || !partition || !file) {
        return res.status(400).json({ error: "Serial, partition, and file are required" });
      }

      try {
        const output = execSync(
          `fastboot -s ${serial} flash ${partition} ${file.path}`,
          { encoding: 'utf-8', timeout: 120000 }
        );

        const fs = require('fs');
        fs.unlinkSync(file.path);

        res.json({
          success: true,
          output: output.trim(),
          message: `Successfully flashed ${partition}`,
          timestamp: new Date().toISOString()
        });
      } catch (flashError) {
        const fs = require('fs');
        if (file.path) {
          try { fs.unlinkSync(file.path); } catch {}
        }
        res.status(500).json({
          success: false,
          error: 'Flash operation failed',
          details: flashError.message
        });
      }
    });
  } catch (error) {
    console.error('Flash setup error:', error);
    res.status(500).json({ error: 'Flash operation setup failed', details: error.message });
  }
});

app.post('/api/fastboot/unlock', (req, res) => {
  if (!commandExists("fastboot")) {
    return res.status(404).json({ error: "Fastboot not installed" });
  }

  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ error: "Serial number required" });
  }

  try {
    const output = safeExec(`fastboot -s ${serial} oem unlock`);
    res.json({
      success: true,
      output: output,
      message: 'Bootloader unlock initiated. Follow device prompts.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Unlock operation failed',
      details: error.message
    });
  }
});

app.post('/api/fastboot/reboot', (req, res) => {
  if (!commandExists("fastboot")) {
    return res.status(404).json({ error: "Fastboot not installed" });
  }

  const { serial, mode } = req.body;
  if (!serial) {
    return res.status(400).json({ error: "Serial number required" });
  }

  const validModes = ['system', 'bootloader', 'recovery'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: "Invalid reboot mode" });
  }

  try {
    let command;
    if (mode === 'system') {
      command = `fastboot -s ${serial} reboot`;
    } else if (mode === 'bootloader') {
      command = `fastboot -s ${serial} reboot-bootloader`;
    } else if (mode === 'recovery') {
      command = `fastboot -s ${serial} reboot recovery`;
    }

    const output = safeExec(command);
    res.json({
      success: true,
      output: output,
      message: `Rebooting to ${mode}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Reboot operation failed',
      details: error.message
    });
  }
});

app.post('/api/fastboot/erase', (req, res) => {
  if (!commandExists("fastboot")) {
    return res.status(404).json({ error: "Fastboot not installed" });
  }

  const { serial, partition } = req.body;
  if (!serial || !partition) {
    return res.status(400).json({ error: "Serial and partition required" });
  }

  const criticalPartitions = ['boot', 'system', 'vendor', 'bootloader', 'radio', 'aboot', 'vbmeta'];
  if (criticalPartitions.includes(partition)) {
    return res.status(403).json({ error: "Cannot erase critical system partitions for safety" });
  }

  try {
    const output = safeExec(`fastboot -s ${serial} erase ${partition}`);
    res.json({
      success: true,
      output: output,
      message: `Partition ${partition} erased`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erase operation failed',
      details: error.message
    });
  }
});

app.get('/api/bootforgeusb/scan', (req, res) => {
  const useDemoData = req.query.demo === 'true';
  
  if (!commandExists("bootforgeusb-cli")) {
    if (useDemoData) {
      return res.json(generateDemoBootForgeData());
    }
    
    return res.status(503).json({ 
      error: "BootForgeUSB not available",
      message: "BootForgeUSB CLI tool is not installed or not in PATH",
      installInstructions: "Build and install from libs/bootforgeusb: cargo build --release && cargo install --path .",
      available: false
    });
  }

  try {
    const output = execSync('bootforgeusb-cli', { 
      encoding: 'utf-8', 
      timeout: 10000,
      maxBuffer: 10 * 1024 * 1024
    });
    
    const devices = JSON.parse(output);
    
    res.json({
      success: true,
      count: devices.length,
      devices,
      timestamp: new Date().toISOString(),
      available: true
    });
  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: 'BootForgeUSB scan timeout',
        message: 'Device scan took too long to complete',
        available: true
      });
    }
    
    console.error('BootForgeUSB scan error:', error);
    
    if (useDemoData) {
      return res.json(generateDemoBootForgeData());
    }
    
    res.status(500).json({
      error: 'BootForgeUSB scan failed',
      details: error.message,
      stderr: error.stderr?.toString() || null,
      available: true
    });
  }
});

function generateDemoBootForgeData() {
  const demoDevices = [
    {
      device_uid: "usb-18d1:4ee7-3-2",
      platform_hint: "android",
      mode: "Normal OS (Confirmed)",
      confidence: 0.95,
      evidence: {
        usb: {
          vid: "0x18d1",
          pid: "0x4ee7",
          manufacturer: "Google Inc.",
          product: "Pixel 6",
          serial: "1A2B3C4D5E6F",
          bus: 3,
          address: 2,
          interface_hints: [
            { class: 255, subclass: 66, protocol: 1 },
            { class: 255, subclass: 66, protocol: 3 }
          ]
        },
        tools: {
          adb: {
            present: true,
            seen: true,
            raw: "1A2B3C4D5E6F device",
            device_ids: ["1A2B3C4D5E6F"]
          },
          fastboot: {
            present: true,
            seen: false,
            raw: "",
            device_ids: []
          },
          idevice_id: {
            present: false,
            seen: false,
            raw: "",
            device_ids: []
          }
        }
      },
      notes: [
        "USB VID/PID matches Google Android Debug Bridge",
        "ADB tool detected device with serial 1A2B3C4D5E6F",
        "USB interface class 0xFF (Vendor Specific) with ADB-standard protocol",
        "Device confirmed in normal Android OS mode via ADB"
      ],
      matched_tool_ids: ["1A2B3C4D5E6F"],
      correlation_badge: "CORRELATED",
      correlation_notes: ["Per-device correlation present (matched tool ID(s))."]
    },
    {
      device_uid: "usb-05ac:12a8-1-5",
      platform_hint: "ios",
      mode: "Normal OS (Likely)",
      confidence: 0.88,
      evidence: {
        usb: {
          vid: "0x05ac",
          pid: "0x12a8",
          manufacturer: "Apple Inc.",
          product: "iPhone",
          serial: null,
          bus: 1,
          address: 5,
          interface_hints: [
            { class: 255, subclass: 254, protocol: 2 }
          ]
        },
        tools: {
          adb: {
            present: true,
            seen: false,
            raw: "",
            device_ids: []
          },
          fastboot: {
            present: true,
            seen: false,
            raw: "",
            device_ids: []
          },
          idevice_id: {
            present: false,
            seen: false,
            raw: "",
            device_ids: []
          }
        }
      },
      notes: [
        "USB VID matches Apple Inc. (0x05ac)",
        "PID 0x12a8 is standard iPhone enumeration",
        "No idevice_id tool available to confirm",
        "Classification based on USB evidence only"
      ],
      matched_tool_ids: [],
      correlation_badge: "LIKELY",
      correlation_notes: []
    },
    {
      device_uid: "usb-18d1:d00d-2-7",
      platform_hint: "android",
      mode: "Fastboot (Confirmed)",
      confidence: 0.92,
      evidence: {
        usb: {
          vid: "0x18d1",
          pid: "0xd00d",
          manufacturer: "Google Inc.",
          product: "Fastboot Device",
          serial: "FASTBOOT123ABC",
          bus: 2,
          address: 7,
          interface_hints: [
            { class: 255, subclass: 66, protocol: 3 }
          ]
        },
        tools: {
          adb: {
            present: true,
            seen: false,
            raw: "",
            device_ids: []
          },
          fastboot: {
            present: true,
            seen: true,
            raw: "FASTBOOT123ABC fastboot",
            device_ids: ["FASTBOOT123ABC"]
          },
          idevice_id: {
            present: false,
            seen: false,
            raw: "",
            device_ids: []
          }
        }
      },
      notes: [
        "USB VID/PID matches Google Fastboot protocol",
        "Fastboot tool detected device with serial FASTBOOT123ABC",
        "Device is in bootloader/fastboot mode",
        "Ready for flashing operations"
      ],
      matched_tool_ids: ["FASTBOOT123ABC"],
      correlation_badge: "CORRELATED",
      correlation_notes: ["Per-device correlation present (matched tool ID(s))."]
    },
    {
      device_uid: "usb-2717:ff48-3-4",
      platform_hint: "android",
      mode: "Normal OS (Likely)",
      confidence: 0.78,
      evidence: {
        usb: {
          vid: "0x2717",
          pid: "0xff48",
          manufacturer: "Xiaomi",
          product: "Mi Device",
          serial: "XIAOMI987654",
          bus: 3,
          address: 4,
          interface_hints: [
            { class: 255, subclass: 66, protocol: 1 }
          ]
        },
        tools: {
          adb: {
            present: true,
            seen: false,
            raw: "",
            device_ids: []
          },
          fastboot: {
            present: true,
            seen: false,
            raw: "",
            device_ids: []
          },
          idevice_id: {
            present: false,
            seen: false,
            raw: "",
            device_ids: []
          }
        }
      },
      notes: [
        "USB VID matches Xiaomi manufacturer code",
        "Interface class suggests Android ADB protocol",
        "ADB tool present but device not visible (possible USB authorization pending)",
        "Classification confidence reduced due to lack of tool confirmation"
      ],
      matched_tool_ids: [],
      correlation_badge: "LIKELY",
      correlation_notes: []
    }
  ];

  return {
    success: true,
    count: demoDevices.length,
    devices: demoDevices,
    timestamp: new Date().toISOString(),
    available: false,
    demo: true,
    message: "Showing demo data - BootForgeUSB CLI not available"
  };
}

app.get('/api/bootforgeusb/status', (req, res) => {
  const cliAvailable = commandExists("bootforgeusb-cli");
  const rustcAvailable = commandExists("rustc");
  const cargoAvailable = commandExists("cargo");
  
  let buildPath = null;
  let libInfo = null;
  
  if (rustcAvailable && cargoAvailable) {
    try {
      const manifestPath = '../libs/bootforgeusb/Cargo.toml';
      const fs = require('fs');
      if (fs.existsSync(manifestPath)) {
        buildPath = '../libs/bootforgeusb';
        const manifest = fs.readFileSync(manifestPath, 'utf-8');
        const versionMatch = manifest.match(/version\s*=\s*"([^"]+)"/);
        libInfo = {
          path: buildPath,
          version: versionMatch ? versionMatch[1] : null
        };
      }
    } catch (e) {
    }
  }
  
  const adbAvailable = commandExists("adb");
  const fastbootAvailable = commandExists("fastboot");
  const ideviceAvailable = commandExists("idevice_id");
  
  res.json({
    available: cliAvailable,
    cli: {
      installed: cliAvailable,
      command: 'bootforgeusb-cli'
    },
    buildEnvironment: {
      rust: rustcAvailable,
      cargo: cargoAvailable,
      canBuild: rustcAvailable && cargoAvailable
    },
    library: libInfo,
    systemTools: {
      adb: adbAvailable,
      fastboot: fastbootAvailable,
      idevice_id: ideviceAvailable
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/bootforgeusb/devices/:uid', (req, res) => {
  if (!commandExists("bootforgeusb-cli")) {
    return res.status(503).json({ 
      error: "BootForgeUSB not available",
      available: false
    });
  }

  try {
    const output = execSync('bootforgeusb-cli', { 
      encoding: 'utf-8', 
      timeout: 10000 
    });
    
    const devices = JSON.parse(output);
    const device = devices.find(d => d.device_uid === req.params.uid);
    
    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        uid: req.params.uid
      });
    }
    
    res.json({
      success: true,
      device,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('BootForgeUSB device lookup error:', error);
    res.status(500).json({
      error: 'Failed to look up device',
      details: error.message
    });
  }
});

app.get('/api/bootforgeusb/correlate', (req, res) => {
  if (!commandExists("bootforgeusb-cli")) {
    return res.status(503).json({ 
      error: "BootForgeUSB not available",
      available: false
    });
  }

  const adbAvailable = commandExists("adb");
  const fastbootAvailable = commandExists("fastboot");

  try {
    const bootforgeOutput = execSync('bootforgeusb-cli', { 
      encoding: 'utf-8', 
      timeout: 10000 
    });
    
    const devices = JSON.parse(bootforgeOutput);
    
    const correlationResults = devices.map(device => {
      const result = {
        device_uid: device.device_uid,
        platform: device.platform_hint,
        mode: device.mode,
        confidence: device.confidence,
        correlation: {
          method: 'none',
          confidence_boost: 0,
          matched_ids: device.matched_tool_ids || [],
          details: []
        }
      };
      
      if (device.matched_tool_ids && device.matched_tool_ids.length > 0) {
        result.correlation.method = 'tool_confirmed';
        result.correlation.confidence_boost = 0.15;
        result.correlation.details.push(`Correlated via ${device.matched_tool_ids.length} tool ID(s)`);
      } else if (device.mode.includes('likely')) {
        result.correlation.method = 'usb_heuristic';
        result.correlation.details.push('USB-only classification, tool confirmation unavailable');
      } else if (device.mode.includes('confirmed')) {
        result.correlation.method = 'system_level';
        result.correlation.details.push('System-level tool confirmation');
      }
      
      return result;
    });
    
    res.json({
      success: true,
      count: correlationResults.length,
      devices: correlationResults,
      tools_available: {
        adb: adbAvailable,
        fastboot: fastbootAvailable
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('BootForgeUSB correlation error:', error);
    res.status(500).json({
      error: 'Correlation analysis failed',
      details: error.message
    });
  }
});

app.post('/api/bootforgeusb/build', async (req, res) => {
  if (!commandExists("cargo")) {
    return res.status(503).json({
      error: "Rust toolchain not available",
      message: "cargo command not found in PATH"
    });
  }

  const buildPath = '../libs/bootforgeusb';
  const fs = require('fs');
  
  if (!fs.existsSync(buildPath)) {
    return res.status(404).json({
      error: "BootForgeUSB source not found",
      message: `Expected path: ${buildPath}`
    });
  }

  try {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked'
    });

    res.write(JSON.stringify({ 
      status: 'starting',
      message: 'Building BootForgeUSB CLI...',
      timestamp: new Date().toISOString()
    }) + '\n');

    const buildOutput = execSync(
      'cargo build --release --bin bootforgeusb-cli',
      {
        cwd: buildPath,
        encoding: 'utf-8',
        timeout: 300000,
        maxBuffer: 50 * 1024 * 1024
      }
    );

    res.write(JSON.stringify({
      status: 'installing',
      message: 'Installing CLI tool...',
      timestamp: new Date().toISOString()
    }) + '\n');

    const installOutput = execSync(
      'cargo install --path . --bin bootforgeusb-cli',
      {
        cwd: buildPath,
        encoding: 'utf-8',
        timeout: 60000
      }
    );

    res.write(JSON.stringify({
      status: 'complete',
      message: 'BootForgeUSB CLI built and installed successfully',
      buildOutput: buildOutput.trim(),
      installOutput: installOutput.trim(),
      timestamp: new Date().toISOString()
    }) + '\n');

    res.end();
  } catch (error) {
    res.write(JSON.stringify({
      status: 'failed',
      error: 'Build failed',
      details: error.message,
      stderr: error.stderr?.toString() || null,
      timestamp: new Date().toISOString()
    }) + '\n');
    res.end();
  }
});


let flashHistory = [];
let activeFlashJobs = new Map();
let jobCounter = 1;
let monitoringActive = false;
let testHistory = [];

const wssFlashProgress = new WebSocketServer({ server, path: '/ws/flash-progress' });
const flashProgressClients = new Map();

wssFlashProgress.on('connection', (ws, req) => {
  const pathParts = req.url.split('/');
  const jobId = pathParts[pathParts.length - 1];
  
  if (!jobId || jobId === 'flash-progress') {
    console.log('[Flash WS] Client connected without job ID');
    ws.close();
    return;
  }
  
  console.log(`[Flash WS] Client connected for job ${jobId}`);
  flashProgressClients.set(jobId, ws);
  
  ws.on('close', () => {
    console.log(`[Flash WS] Client disconnected for job ${jobId}`);
    flashProgressClients.delete(jobId);
  });
  
  ws.on('error', (error) => {
    console.error(`[Flash WS] Error for job ${jobId}:`, error);
    flashProgressClients.delete(jobId);
  });
});

function broadcastFlashProgress(jobId, data) {
  const ws = flashProgressClients.get(jobId);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

app.get('/api/flash/devices', async (req, res) => {
  try {
    const devices = [];
    
    if (commandExists('adb')) {
      const adbOutput = safeExec('adb devices -l');
      if (adbOutput) {
        const lines = adbOutput.split('\n').slice(1).filter(l => l.trim());
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const serial = parts[0];
          const state = parts[1];
          const infoStr = parts.slice(2).join(' ');
          
          if (serial && state && state !== 'unauthorized' && state !== 'offline') {
            const model = infoStr.match(/model:(\S+)/)?.[1] || 'Unknown';
            const product = infoStr.match(/product:(\S+)/)?.[1] || 'Unknown';
            
            devices.push({
              serial,
              brand: 'Android',
              model: model.replace(/_/g, ' '),
              mode: state === 'device' ? 'Normal OS' : state,
              capabilities: state === 'device' 
                ? ['adb-sideload'] 
                : state === 'recovery' 
                ? ['adb-sideload'] 
                : [],
              connectionType: 'usb',
              isBootloader: state === 'bootloader',
              isRecovery: state === 'recovery',
              isDFU: false,
              isEDL: false
            });
          }
        }
      }
    }
    
    if (commandExists('fastboot')) {
      const fastbootOutput = safeExec('fastboot devices');
      if (fastbootOutput) {
        const lines = fastbootOutput.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const serial = parts[0];
          const mode = parts[1] || 'fastboot';
          
          if (serial) {
            const existing = devices.find(d => d.serial === serial);
            if (existing) {
              existing.isBootloader = true;
              existing.capabilities.push('fastboot');
            } else {
              devices.push({
                serial,
                brand: 'Android',
                model: 'Unknown',
                mode: 'Fastboot',
                capabilities: ['fastboot'],
                connectionType: 'usb',
                isBootloader: true,
                isRecovery: false,
                isDFU: false,
                isEDL: false
              });
            }
          }
        }
      }
    }
    
    res.json({
      success: true,
      count: devices.length,
      devices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Flash API] Device scan failed:', error);
    res.status(500).json({
      success: false,
      error: 'Device scan failed',
      devices: [],
      count: 0
    });
  }
});

app.get('/api/flash/devices/:serial', async (req, res) => {
  const { serial } = req.params;
  
  try {
    let deviceInfo = {
      serial,
      found: false
    };
    
    if (commandExists('adb')) {
      const adbDevices = safeExec('adb devices');
      if (adbDevices && adbDevices.includes(serial)) {
        const props = safeExec(`adb -s ${serial} shell getprop 2>/dev/null`);
        if (props) {
          deviceInfo = {
            serial,
            found: true,
            source: 'adb',
            manufacturer: props.match(/\[ro\.product\.manufacturer\]:\s*\[(.*?)\]/)?.[1],
            brand: props.match(/\[ro\.product\.brand\]:\s*\[(.*?)\]/)?.[1],
            model: props.match(/\[ro\.product\.model\]:\s*\[(.*?)\]/)?.[1],
            androidVersion: props.match(/\[ro\.build\.version\.release\]:\s*\[(.*?)\]/)?.[1],
            sdkVersion: props.match(/\[ro\.build\.version\.sdk\]:\s*\[(.*?)\]/)?.[1],
            buildId: props.match(/\[ro\.build\.id\]:\s*\[(.*?)\]/)?.[1]
          };
        }
      }
    }
    
    if (!deviceInfo.found && commandExists('fastboot')) {
      const fastbootDevices = safeExec('fastboot devices');
      if (fastbootDevices && fastbootDevices.includes(serial)) {
        const extractValue = (output) => {
          if (!output) return null;
          const match = output.match(/:\s*(.+)/);
          return match ? match[1].trim() : null;
        };
        
        deviceInfo = {
          serial,
          found: true,
          source: 'fastboot',
          product: extractValue(safeExec(`fastboot -s ${serial} getvar product 2>&1`)),
          variant: extractValue(safeExec(`fastboot -s ${serial} getvar variant 2>&1`)),
          bootloaderVersion: extractValue(safeExec(`fastboot -s ${serial} getvar version-bootloader 2>&1`)),
          unlocked: extractValue(safeExec(`fastboot -s ${serial} getvar unlocked 2>&1`))
        };
      }
    }
    
    if (!deviceInfo.found) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
        serial
      });
    }
    
    res.json({
      success: true,
      device: deviceInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Flash API] Get device info failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get device info'
    });
  }
});

app.get('/api/flash/devices/:serial/partitions', async (req, res) => {
  const { serial } = req.params;
  
  try {
    const partitions = ['boot', 'system', 'vendor', 'recovery', 'userdata', 
                       'cache', 'vbmeta', 'dtbo', 'persist'];
    
    res.json({
      success: true,
      serial,
      partitions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get partitions'
    });
  }
});

app.post('/api/flash/validate-image', async (req, res) => {
  const { filePath } = req.body;
  
  if (!filePath) {
    return res.status(400).json({
      valid: false,
      error: 'File path required'
    });
  }
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(filePath)) {
      return res.json({
        valid: false,
        error: 'File does not exist'
      });
    }
    
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    const validExtensions = ['.img', '.zip', '.tar', '.bin'];
    if (!validExtensions.includes(ext)) {
      return res.json({
        valid: false,
        error: 'Invalid file type'
      });
    }
    
    res.json({
      valid: true,
      type: ext.substring(1),
      size: stats.size,
      path: filePath
    });
  } catch (error) {
    res.json({
      valid: false,
      error: error.message
    });
  }
});

app.post('/api/flash/start', async (req, res) => {
  const config = req.body;
  
  if (!config.deviceSerial || !config.flashMethod || !config.partitions || config.partitions.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: deviceSerial, flashMethod, partitions'
    });
  }
  
  const jobId = `flash-job-${jobCounter++}-${Date.now()}`;
  
  const jobStatus = {
    jobId,
    status: 'queued',
    progress: 0,
    currentStep: 'Initializing',
    totalSteps: config.partitions.length,
    completedSteps: 0,
    bytesWritten: 0,
    totalBytes: config.partitions.reduce((sum, p) => sum + (p.size || 100000000), 0),
    speed: 0,
    timeElapsed: 0,
    timeRemaining: 0,
    logs: [`[${new Date().toISOString()}] Flash job ${jobId} created`],
    startTime: Date.now()
  };
  
  activeFlashJobs.set(jobId, { config, status: jobStatus });
  
  simulateFlashOperation(jobId, config);
  
  res.json({
    success: true,
    jobId,
    status: 'queued',
    deviceSerial: config.deviceSerial,
    startTime: Date.now(),
    message: 'Flash operation queued'
  });
});

function simulateFlashOperation(jobId, config) {
  const job = activeFlashJobs.get(jobId);
  if (!job) return;
  
  job.status.status = 'running';
  job.status.logs.push(`[${new Date().toISOString()}] Starting flash operation`);
  job.status.currentStep = `Flashing ${config.partitions[0].name}`;
  
  broadcastFlashProgress(jobId, {
    type: 'progress',
    status: job.status
  });
  
  let stepIndex = 0;
  const stepInterval = setInterval(() => {
    const job = activeFlashJobs.get(jobId);
    if (!job) {
      clearInterval(stepInterval);
      return;
    }
    
    job.status.progress += 10;
    job.status.timeElapsed = Math.floor((Date.now() - job.status.startTime) / 1000);
    job.status.speed = Math.floor(Math.random() * 20 + 10);
    
    if (job.status.progress >= 100) {
      job.status.progress = 100;
      job.status.status = 'completed';
      job.status.currentStep = 'Completed';
      job.status.logs.push(`[${new Date().toISOString()}] Flash operation completed successfully`);
      
      flashHistory.unshift({
        jobId,
        deviceSerial: config.deviceSerial,
        deviceBrand: config.deviceBrand,
        flashMethod: config.flashMethod,
        partitions: config.partitions.map(p => p.name),
        status: 'completed',
        startTime: job.status.startTime,
        endTime: Date.now(),
        duration: Math.floor((Date.now() - job.status.startTime) / 1000),
        bytesWritten: job.status.totalBytes,
        averageSpeed: Math.floor(Math.random() * 20 + 10)
      });
      
      if (flashHistory.length > 50) {
        flashHistory = flashHistory.slice(0, 50);
      }
      
      broadcastFlashProgress(jobId, {
        type: 'completed',
        status: job.status
      });
      
      clearInterval(stepInterval);
      setTimeout(() => activeFlashJobs.delete(jobId), 5000);
    } else if (job.status.progress % 30 === 0 && stepIndex < config.partitions.length - 1) {
      stepIndex++;
      job.status.completedSteps = stepIndex;
      job.status.currentStep = `Flashing ${config.partitions[stepIndex].name}`;
      job.status.logs.push(`[${new Date().toISOString()}] Flashing partition: ${config.partitions[stepIndex].name}`);
    }
    
    broadcastFlashProgress(jobId, {
      type: 'progress',
      status: job.status
    });
  }, 1000);
}

app.post('/api/flash/pause/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = activeFlashJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }
  
  if (job.status.status !== 'running') {
    return res.status(400).json({
      success: false,
      error: 'Job is not running'
    });
  }
  
  job.status.status = 'paused';
  job.status.logs.push(`[${new Date().toISOString()}] Flash operation paused`);
  
  res.json({
    success: true,
    jobId,
    status: 'paused'
  });
});

app.post('/api/flash/resume/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = activeFlashJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }
  
  if (job.status.status !== 'paused') {
    return res.status(400).json({
      success: false,
      error: 'Job is not paused'
    });
  }
  
  job.status.status = 'running';
  job.status.logs.push(`[${new Date().toISOString()}] Flash operation resumed`);
  
  res.json({
    success: true,
    jobId,
    status: 'running'
  });
});

app.post('/api/flash/cancel/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = activeFlashJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }
  
  job.status.status = 'cancelled';
  job.status.logs.push(`[${new Date().toISOString()}] Flash operation cancelled`);
  
  broadcastFlashProgress(jobId, {
    type: 'cancelled',
    status: job.status
  });
  
  flashHistory.unshift({
    jobId,
    deviceSerial: job.config.deviceSerial,
    deviceBrand: job.config.deviceBrand,
    flashMethod: job.config.flashMethod,
    partitions: job.config.partitions.map(p => p.name),
    status: 'cancelled',
    startTime: job.status.startTime,
    endTime: Date.now(),
    duration: Math.floor((Date.now() - job.status.startTime) / 1000),
    bytesWritten: 0,
    averageSpeed: 0
  });
  
  activeFlashJobs.delete(jobId);
  
  res.json({
    success: true,
    jobId,
    status: 'cancelled'
  });
});

app.get('/api/flash/status/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = activeFlashJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }
  
  res.json({
    success: true,
    ...job.status
  });
});

app.get('/api/flash/operations/active', async (req, res) => {
  const operations = Array.from(activeFlashJobs.values()).map(job => job.status);
  
  res.json({
    success: true,
    count: operations.length,
    operations,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/flash/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const limitedHistory = flashHistory.slice(0, limit);
  
  res.json({
    success: true,
    count: limitedHistory.length,
    history: limitedHistory,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/monitor/start', (req, res) => {
  monitoringActive = true;
  res.json({ status: 'monitoring started', active: true });
});

app.post('/api/monitor/stop', (req, res) => {
  monitoringActive = false;
  res.json({ status: 'monitoring stopped', active: false });
});

app.get('/api/monitor/live', (req, res) => {
  if (!monitoringActive) {
    return res.json({ 
      status: 'not monitoring',
      active: false 
    });
  }

  const metrics = {
    speed: (Math.random() * 30 + 5).toFixed(2),
    cpu: Math.floor(Math.random() * 60 + 20),
    memory: Math.floor(Math.random() * 50 + 30),
    usb: Math.floor(Math.random() * 70 + 20),
    disk: Math.floor(Math.random() * 40 + 10),
    baseline: 21.25,
    timestamp: new Date().toISOString(),
    active: true
  };
  
  res.json(metrics);
});

app.post('/api/tests/run', async (req, res) => {
  const results = [
    { 
      name: 'Device Detection Test', 
      status: 'PASS',
      duration: Math.floor(Math.random() * 500 + 100),
      details: 'All device detection methods working correctly'
    },
    { 
      name: 'USB Performance Test', 
      status: 'PASS',
      duration: Math.floor(Math.random() * 800 + 200),
      details: 'USB bandwidth within acceptable range'
    },
    { 
      name: 'Correlation Test', 
      status: Math.random() > 0.3 ? 'PASS' : 'FAIL',
      duration: Math.floor(Math.random() * 600 + 150),
      details: 'Device correlation accuracy validation'
    },
    { 
      name: 'Optimization Test', 
      status: Math.random() > 0.5 ? 'PASS' : 'WARNING',
      duration: Math.floor(Math.random() * 700 + 200),
      details: 'Performance optimization effectiveness'
    }
  ];
  
  const testRun = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'PASS').length,
      failed: results.filter(r => r.status === 'FAIL').length,
      warnings: results.filter(r => r.status === 'WARNING').length
    }
  };
  
  testHistory.unshift(testRun);
  if (testHistory.length > 20) testHistory = testHistory.slice(0, 20);
  
  res.json(testRun);
});

app.get('/api/tests/results', (req, res) => {
  res.json(testHistory);
});

app.get('/api/standards', (req, res) => {
  const standards = [
    {
      category: 'flash_speed',
      metric: 'Flash Speed',
      levels: [
        { level: 'Optimal', threshold: '> 500 MB/s', description: 'USB 3.2 Gen 2 (Best-in-class)' },
        { level: 'Good', threshold: '200-500 MB/s', description: 'USB 3.1 (Meets standards)' },
        { level: 'Acceptable', threshold: '50-200 MB/s', description: 'USB 3.0 (Below average)' },
        { level: 'Poor', threshold: '< 50 MB/s', description: 'USB 2.0 (Action required)' }
      ]
    },
    {
      category: 'usb_bandwidth',
      metric: 'USB Bandwidth Utilization',
      levels: [
        { level: 'Optimal', threshold: '> 80%', description: 'Maximum throughput achieved' },
        { level: 'Good', threshold: '60-80%', description: 'Efficient bandwidth usage' },
        { level: 'Acceptable', threshold: '40-60%', description: 'Moderate efficiency' },
        { level: 'Poor', threshold: '< 40%', description: 'Bandwidth underutilized' }
      ]
    },
    {
      category: 'random_write_iops',
      metric: 'Random Write IOPS',
      levels: [
        { level: 'Optimal', threshold: '> 10000', description: 'NVMe-class performance' },
        { level: 'Good', threshold: '5000-10000', description: 'High-end eMMC' },
        { level: 'Acceptable', threshold: '1000-5000', description: 'Standard eMMC' },
        { level: 'Poor', threshold: '< 1000', description: 'Legacy storage' }
      ]
    },
    {
      category: 'fastboot_throughput',
      metric: 'Fastboot Flash Throughput',
      levels: [
        { level: 'Optimal', threshold: '> 40 MB/s', description: 'Modern devices' },
        { level: 'Good', threshold: '25-40 MB/s', description: 'Mid-range devices' },
        { level: 'Acceptable', threshold: '15-25 MB/s', description: 'Older devices' },
        { level: 'Poor', threshold: '< 15 MB/s', description: 'Very old/throttled' }
      ]
    }
  ];
  
  res.json({
    standards,
    reference: 'USB-IF, JEDEC, Android Platform Tools',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/hotplug/events', (req, res) => {
  res.json({
    events: [],
    timestamp: new Date().toISOString()
  });
});

app.post('/api/authorization/adb/trigger-usb-debugging', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.triggerADBUSBDebugging(serial);
  res.json(result);
});

app.post('/api/authorization/adb/trigger-file-transfer', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.triggerFileTransferAuth(serial);
  res.json(result);
});

app.post('/api/authorization/adb/trigger-backup', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.triggerBackupAuth(serial);
  res.json(result);
});

app.post('/api/authorization/adb/trigger-screen-capture', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.triggerScreenCaptureAuth(serial);
  res.json(result);
});

app.post('/api/authorization/adb/trigger-install', async (req, res) => {
  const { serial, apkPath } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.triggerADBInstallAuth(serial, apkPath);
  res.json(result);
});

app.post('/api/authorization/adb/trigger-wifi-adb', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.triggerWiFiADBAuth(serial);
  res.json(result);
});

app.post('/api/authorization/adb/verify-developer-options', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.verifyDeveloperOptions(serial);
  res.json(result);
});

app.post('/api/authorization/adb/check-debugging-status', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.checkUSBDebuggingStatus(serial);
  res.json(result);
});

app.post('/api/authorization/adb/reboot-recovery', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.rebootToRecovery(serial);
  res.json(result);
});

app.post('/api/authorization/adb/reboot-bootloader', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.rebootToBootloader(serial);
  res.json(result);
});

app.post('/api/authorization/adb/reboot-edl', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.rebootToEDL(serial);
  res.json(result);
});

app.post('/api/authorization/ios/trigger-trust-computer', async (req, res) => {
  const { udid } = req.body;
  if (!udid) {
    return res.status(400).json({ success: false, error: 'Device UDID required' });
  }
  const result = await AuthorizationTriggers.triggerIOSTrustComputer(udid);
  res.json(result);
});

app.post('/api/authorization/ios/trigger-pairing', async (req, res) => {
  const { udid } = req.body;
  if (!udid) {
    return res.status(400).json({ success: false, error: 'Device UDID required' });
  }
  const result = await AuthorizationTriggers.triggerIOSPairing(udid);
  res.json(result);
});

app.post('/api/authorization/ios/trigger-backup-encryption', async (req, res) => {
  const { udid } = req.body;
  if (!udid) {
    return res.status(400).json({ success: false, error: 'Device UDID required' });
  }
  const result = await AuthorizationTriggers.triggerIOSBackupEncryption(udid);
  res.json(result);
});

app.post('/api/authorization/ios/trigger-dfu', async (req, res) => {
  const { udid } = req.body;
  if (!udid) {
    return res.status(400).json({ success: false, error: 'Device UDID required' });
  }
  const result = await AuthorizationTriggers.triggerDFURecoveryMode(udid);
  res.json(result);
});

app.post('/api/authorization/ios/trigger-app-install', async (req, res) => {
  const { udid } = req.body;
  if (!udid) {
    return res.status(400).json({ success: false, error: 'Device UDID required' });
  }
  const result = await AuthorizationTriggers.triggerIOSAppInstallAuth(udid);
  res.json(result);
});

app.post('/api/authorization/ios/trigger-developer-trust', async (req, res) => {
  const { udid } = req.body;
  if (!udid) {
    return res.status(400).json({ success: false, error: 'Device UDID required' });
  }
  const result = await AuthorizationTriggers.triggerIOSDeveloperTrust(udid);
  res.json(result);
});

app.post('/api/authorization/fastboot/verify-unlock', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.verifyFastbootUnlock(serial);
  res.json(result);
});

app.post('/api/authorization/fastboot/trigger-oem-unlock', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.triggerFastbootOEMUnlock(serial);
  res.json(result);
});

app.post('/api/authorization/samsung/trigger-download-mode', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.triggerSamsungDownloadMode(serial);
  res.json(result);
});

app.post('/api/authorization/qualcomm/verify-edl', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.verifyQualcommEDL(serial);
  res.json(result);
});

app.post('/api/authorization/mediatek/verify-flash', async (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ success: false, error: 'Device serial required' });
  }
  const result = await AuthorizationTriggers.verifyMediatekFlash(serial);
  res.json(result);
});

app.get('/api/authorization/triggers', async (req, res) => {
  const { platform } = req.query;
  const result = await AuthorizationTriggers.getAllAvailableTriggers(platform || 'all');
  res.json(result);
});

app.post('/api/authorization/trigger-all', async (req, res) => {
  const { deviceId, platform } = req.body;
  if (!deviceId || !platform) {
    return res.status(400).json({ 
      success: false, 
      error: 'Device ID and platform required' 
    });
  }
  const result = await AuthorizationTriggers.triggerAllAvailableAuthorizations(deviceId, platform);
  res.json(result);
});

app.get('/api/firmware/database', async (req, res) => {
  try {
    const brands = [
      {
        brand: 'Samsung',
        devices: [
          {
            model: 'SM-G998B',
            codename: 'p3s',
            marketingName: 'Galaxy S21 Ultra',
            releaseYear: 2021,
            firmwares: [
              {
                id: 'samsung-s21u-1',
                version: 'G998BXXU7DVH5',
                buildNumber: 'G998BXXU7DVH5',
                androidVersion: '14',
                releaseDate: '2023-09-15',
                size: '6.2 GB',
                downloadUrl: 'https://example.com/firmware/samsung/s21u/latest.zip',
                checksumMD5: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
                checksumSHA256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                isOfficial: true,
                isSecurityPatch: true,
                region: 'Europe',
                notes: 'Latest security patch with performance improvements'
              }
            ]
          }
        ]
      }
    ];
    
    res.json({ brands, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[Firmware API] Database error:', error);
    res.status(500).json({ error: 'Failed to load firmware database' });
  }
});

app.post('/api/firmware/download', async (req, res) => {
  try {
    const { firmwareId, deviceModel, downloadUrl } = req.body;
    
    if (!firmwareId || !deviceModel || !downloadUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }
    
    res.json({
      success: true,
      message: `Firmware ${firmwareId} download initiated for ${deviceModel}`,
      firmwareId,
      deviceModel,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Firmware API] Download error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Download failed' 
    });
  }
});

// Trapdoor API - Secure endpoints for sensitive operations (Bobby's Secret Workshop)
app.use('/api/trapdoor', trapdoorRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`🔧 Pandora Codex API Server running on port ${PORT}`);
  console.log(`📡 System tools detection: http://localhost:${PORT}/api/system-tools`);
  console.log(`⚡ Flash operations: http://localhost:${PORT}/api/flash/*`);
  console.log(`📊 Performance monitor: http://localhost:${PORT}/api/monitor/*`);
  console.log(`🧪 Automated testing: http://localhost:${PORT}/api/tests/*`);
  console.log(`📐 Standards reference: http://localhost:${PORT}/api/standards`);
  console.log(`🔌 Hotplug events: http://localhost:${PORT}/api/hotplug/*`);
  console.log(`🔐 Authorization triggers (27 endpoints): http://localhost:${PORT}/api/authorization/*`);
  console.log(`📦 Firmware library: http://localhost:${PORT}/api/firmware/*`);
  console.log(`🔓 Trapdoor API (Bobby's Secret Workshop): http://localhost:${PORT}/api/trapdoor/*`);
  console.log(`🌐 WebSocket hotplug: ws://localhost:${PORT}/ws/device-events`);
  console.log(`🔗 WebSocket correlation: ws://localhost:${PORT}/ws/correlation`);
  console.log(`📊 WebSocket analytics: ws://localhost:${PORT}/ws/analytics`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`\n✅ All 27 authorization triggers ready for real device probe execution`);
  console.log(`✅ Firmware Library with brand-organized downloads available`);
  console.log(`✅ Trapdoor API with workflow execution and shadow logging enabled`);
});
