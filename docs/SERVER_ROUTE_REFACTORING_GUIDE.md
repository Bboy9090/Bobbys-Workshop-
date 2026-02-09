# Server Route Refactoring Guide

This guide explains how to refactor server routes to use the new shared utilities.

## Flash Routes Refactoring

### Using flash-base.js Utilities

#### Before: Manual Device Scanning

```javascript
// Old: Duplicated in mtk.js, odin.js, edl.js
router.get('/scan', async (req, res) => {
  try {
    // Check if command exists
    const exists = await commandExistsSafe('adb');
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'ADB not found'
      });
    }

    const result = await safeSpawn('adb', ['devices', '-l'], {
      timeout: 5000
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // Parse output
    const lines = result.stdout.split('\n').slice(1).filter(line => line.trim());
    const devices = lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        serial: parts[0],
        state: parts[1],
        detected: true
      };
    });

    res.json({
      success: true,
      devices,
      count: devices.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

#### After: Using Shared Utilities

```javascript
// New: Using flash-base.js utilities
import { scanDevices, createScanResponse, parseAdbDevices } from '../../utils/flash-base.js';

router.get('/scan', async (req, res) => {
  const result = await scanDevices(
    'adb',                    // Command
    ['devices', '-l'],        // Args
    parseAdbDevices,          // Parser function
    5000                      // Timeout
  );

  const response = createScanResponse(result, 'MediaTek');
  res.status(result.success ? 200 : 500).json(response);
});
```

**Benefits**: ~70% less code, consistent error handling, standard response format

### Using flash-base.js for Flash Operations

#### Before: Manual Flash Execution

```javascript
// Old: Duplicated flash logic
router.post('/flash', async (req, res) => {
  const { deviceSerial, scatterFile, images } = req.body;

  try {
    // Validate inputs
    if (!scatterFile) {
      return res.status(400).json({
        success: false,
        error: 'Scatter file required'
      });
    }

    if (!scatterFile.endsWith('.txt')) {
      return res.status(400).json({
        success: false,
        error: 'Scatter file must be .txt'
      });
    }

    // Check tool exists
    const exists = await commandExistsSafe('sp_flash_tool');
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'SP Flash Tool not found'
      });
    }

    // Execute flash
    const result = await safeSpawn('sp_flash_tool', [
      '-s', scatterFile,
      '-c', deviceSerial,
      ...images.map(img => ['-i', img]).flat()
    ], { timeout: 300000 });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Flash completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

#### After: Using Shared Utilities

```javascript
// New: Using flash-base.js utilities
import { executeFlash, validateFilePath, createFlashResponse } from '../../utils/flash-base.js';

router.post('/flash', async (req, res) => {
  const { deviceSerial, scatterFile, images } = req.body;

  // Validate scatter file
  const validation = await validateFilePath(scatterFile, ['.txt']);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error
    });
  }

  // Execute flash with progress tracking
  const result = await executeFlash(
    'sp_flash_tool',
    ['-s', scatterFile, '-c', deviceSerial, ...images.map(img => ['-i', img]).flat()],
    { timeout: 300000 },
    (progress) => {
      // Optional: broadcast progress via WebSocket
      broadcastFlashProgress(deviceSerial, progress);
    }
  );

  const response = createFlashResponse(result, 'MediaTek flash');
  res.status(result.success ? 200 : 500).json(response);
});
```

**Benefits**: Simplified validation, consistent responses, progress tracking built-in

## Monitor Routes Refactoring

### Using monitor-base.js Utilities

#### Before: Duplicated Monitor Logic

```javascript
// Old: In storage.js, thermal.js, network.js, performance.js
async function getStorageUsage(deviceSerial) {
  try {
    const dfResult = await ADBLibrary.shell(deviceSerial, 'df -h');
    if (!dfResult.success) {
      return { success: false, error: dfResult.error };
    }

    // Parse df output
    const lines = dfResult.stdout.trim().split('\n').slice(1);
    const partitions = [];
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
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

    // Parse size values to bytes
    function parseSize(sizeStr) {
      const match = sizeStr.match(/^([\d.]+)([KMGTP]?)$/i);
      if (!match) return 0;
      const value = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      const multipliers = { '': 1, 'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4, 'P': 1024**5 };
      return Math.floor(value * (multipliers[unit] || 1));
    }

    // Calculate totals
    const totalSize = partitions.reduce((sum, p) => sum + parseSize(p.size || '0'), 0);
    const totalUsed = partitions.reduce((sum, p) => sum + parseSize(p.used || '0'), 0);

    return {
      success: true,
      totalSize,
      totalUsed,
      partitions
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

router.get('/:deviceSerial', async (req, res) => {
  try {
    const result = await getStorageUsage(req.params.deviceSerial);
    if (!result.success) {
      return res.status(500).json({
        ok: false,
        error: result.error,
        timestamp: Date.now()
      });
    }
    res.json({
      ok: true,
      data: result,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});
```

#### After: Using Shared Utilities

```javascript
// New: Using monitor-base.js utilities
import {
  executeDeviceCommand,
  parseSizeToBytes,
  createMonitorResponse,
  handleMonitorError,
  calculatePercentage
} from '../../../utils/monitor-base.js';

async function getStorageUsage(deviceSerial) {
  const result = await executeDeviceCommand(deviceSerial, 'df -h');
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Parse df output (same parsing logic)
  const lines = result.stdout.trim().split('\n').slice(1);
  const partitions = lines.map(line => {
    const parts = line.trim().split(/\s+/);
    return parts.length >= 6 ? {
      filesystem: parts[0],
      size: parts[1],
      used: parts[2],
      available: parts[3],
      usePercent: parts[4],
      mounted: parts[5],
      sizeBytes: parseSizeToBytes(parts[1]),  // Use utility
      usedBytes: parseSizeToBytes(parts[2]),   // Use utility
    } : null;
  }).filter(Boolean);

  const totalSize = partitions.reduce((sum, p) => sum + p.sizeBytes, 0);
  const totalUsed = partitions.reduce((sum, p) => sum + p.usedBytes, 0);

  return {
    success: true,
    totalSize,
    totalUsed,
    usagePercent: calculatePercentage(totalUsed, totalSize),  // Use utility
    partitions
  };
}

router.get('/:deviceSerial', async (req, res) => {
  try {
    const result = await getStorageUsage(req.params.deviceSerial);
    
    if (!result.success) {
      const response = createMonitorResponse(false, null, result.error);
      return res.status(500).json(response);
    }

    const response = createMonitorResponse(true, result);
    res.json(response);
  } catch (error) {
    const response = handleMonitorError(error, 'Storage monitoring');
    res.status(500).json(response);
  }
});
```

**Benefits**: 
- Consistent response format across all monitor endpoints
- Reusable size parsing (no more copy-paste)
- Standard error handling
- Built-in timestamp and envelope format

## Migration Checklist

### For Flash Routes
- [ ] Import flash-base utilities
- [ ] Replace manual command execution with `scanDevices()` or `executeFlash()`
- [ ] Use `validateFilePath()` for file validation
- [ ] Use `createScanResponse()` / `createFlashResponse()` for responses
- [ ] Use standard parsers (`parseAdbDevices`, `parseFastbootDevices`)
- [ ] Remove duplicate error handling code
- [ ] Test scan endpoint
- [ ] Test flash endpoint

### For Monitor Routes
- [ ] Import monitor-base utilities
- [ ] Replace manual ADB commands with `executeDeviceCommand()`
- [ ] Use `parseSizeToBytes()` for size conversion
- [ ] Use `parseTemperature()` for temperature values
- [ ] Use `createMonitorResponse()` for responses
- [ ] Use `handleMonitorError()` for error cases
- [ ] Remove duplicate parsing functions
- [ ] Test monitor endpoint

## Testing

```bash
# Test flash routes
npm run test -- server/routes/v1/flash

# Test monitor routes  
npm run test -- server/routes/v1/monitor

# Integration tests
npm run test:integration
```

## Common Patterns

### Standard Scan Endpoint
```javascript
router.get('/scan', async (req, res) => {
  const result = await scanDevices(command, args, parser);
  const response = createScanResponse(result, 'DeviceType');
  res.status(result.success ? 200 : 500).json(response);
});
```

### Standard Monitor Endpoint
```javascript
router.get('/:deviceSerial', async (req, res) => {
  try {
    const data = await getMonitorData(req.params.deviceSerial);
    const response = createMonitorResponse(true, data);
    res.json(response);
  } catch (error) {
    const response = handleMonitorError(error, 'Operation');
    res.status(500).json(response);
  }
});
```

## Questions?

- Check utility source code for full API
- See tests for usage examples
- Ask before making breaking changes
