# Flash Panel Migration Guide

This guide explains how to migrate existing flash panel components to use the new `BaseFlashPanel` utilities.

## Why Migrate?

The base utilities provide:
- **Less boilerplate**: ~30% less code per component
- **Consistent behavior**: Same patterns across all flash panels
- **Easier maintenance**: Fix once, applies everywhere
- **Type safety**: Shared TypeScript interfaces

## Before Migration Example

```typescript
// Old: MediaTekFlashPanel.tsx (complex, ~500 lines)
export function MediaTekFlashPanel() {
  const [devices, setDevices] = useState<MTKDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [currentJob, setCurrentJob] = useState<MTKFlashJob | null>(null);

  const scanDevices = async () => {
    setIsScanning(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/mtk/scan`);
      if (response.ok) {
        const data = await response.json();
        if (data.devices && data.devices.length > 0) {
          setDevices(data.devices);
          toast.success('MTK device scan complete', {
            description: `Found ${data.devices.length} MediaTek device(s)`,
          });
        } else {
          setDevices([]);
          toast.info('No MediaTek devices found');
        }
      } else {
        throw new Error('Backend unavailable');
      }
    } catch (error) {
      console.error('[MediaTekFlashPanel] Backend scan failed:', error);
      toast.error('Failed to scan devices', {
        description: error instanceof Error ? error.message : 'Backend unavailable',
      });
      setDevices([]);
    } finally {
      setIsScanning(false);
    }
  };

  // ... 400+ more lines of similar code
}
```

## After Migration Example

```typescript
// New: MediaTekFlashPanel.tsx (cleaner, ~300 lines)
import { useBaseFlashPanel, DeviceScanControls, FlashProgressDisplay } from '@/components/core/BaseFlashPanel';

interface MTKDevice extends BaseDevice {
  chipset: string;
  mode: 'preloader' | 'vcom' | 'unknown';
}

interface MTKFlashJob extends BaseFlashJob {
  scatterPath: string;
  images: string[];
}

export function MediaTekFlashPanel() {
  // Use the base hook - handles all the common logic
  const {
    devices,
    selectedDevice,
    isScanning,
    currentJob,
    error,
    scanDevices,
    selectDevice,
    updateJob,
  } = useBaseFlashPanel<MTKDevice, MTKFlashJob>('/api/mtk/scan', 'MediaTek');

  // Only implement MediaTek-specific logic
  const [scatterFile, setScatterFile] = useState<string>('');
  const [imageFiles, setImageFiles] = useState<string[]>([]);

  // ... MediaTek-specific implementation (~200 lines)
}
```

## Migration Steps

### Step 1: Update Imports

```typescript
// Add these imports
import {
  useBaseFlashPanel,
  DeviceScanControls,
  FlashProgressDisplay,
  type BaseDevice,
  type BaseFlashJob,
} from '@/components/core/BaseFlashPanel';
```

### Step 2: Extend Base Interfaces

```typescript
// Define your device type extending BaseDevice
interface YourDevice extends BaseDevice {
  // Add brand-specific fields
  brandSpecificField: string;
}

// Define your job type extending BaseFlashJob
interface YourFlashJob extends BaseFlashJob {
  // Add brand-specific fields
  additionalInfo: string;
}
```

### Step 3: Replace State Management

```typescript
// REMOVE this:
const [devices, setDevices] = useState<Device[]>([]);
const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
const [isScanning, setIsScanning] = useState(false);
const [currentJob, setCurrentJob] = useState<Job | null>(null);
const [error, setError] = useState<string | null>(null);

const scanDevices = async () => { /* ... 50+ lines ... */ };

// REPLACE with:
const {
  devices,
  selectedDevice,
  isScanning,
  currentJob,
  error,
  scanDevices,
  selectDevice,
  updateJob,
} = useBaseFlashPanel<YourDevice, YourFlashJob>(
  '/api/your-brand/scan',  // Your scan endpoint
  'YourBrand'              // Display name
);
```

### Step 4: Use Standardized Components

```typescript
// REMOVE custom scan UI:
<div className="flex items-center justify-between">
  <Badge>{devices.length} devices</Badge>
  <Button onClick={scanDevices} disabled={isScanning}>
    {isScanning ? 'Scanning...' : 'Scan Devices'}
  </Button>
</div>

// REPLACE with:
<DeviceScanControls
  isScanning={isScanning}
  deviceCount={devices.length}
  onScan={scanDevices}
  deviceType="YourBrand"
/>

// For progress display:
{currentJob && (
  <FlashProgressDisplay job={currentJob} showLogs={true} />
)}
```

### Step 5: Keep Brand-Specific Logic

Focus your component on what's unique to your brand:

```typescript
export function YourBrandFlashPanel() {
  // Use base hook
  const { devices, selectedDevice, scanDevices, ... } = useBaseFlashPanel(...);

  // Brand-specific state
  const [brandSpecificOption, setBrandSpecificOption] = useState(false);
  
  // Brand-specific functions
  const validateBrandSpecificFile = (file: File) => {
    // Your validation logic
  };

  const executeBrandSpecificFlash = async () => {
    // Your flash logic using selectedDevice
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Brand Flash Panel</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Common controls */}
        <DeviceScanControls ... />
        
        {/* Brand-specific UI */}
        <YourBrandSpecificControls />
        
        {/* Common progress */}
        {currentJob && <FlashProgressDisplay job={currentJob} />}
      </CardContent>
    </Card>
  );
}
```

## Checklist

Before merging:
- [ ] Extends BaseDevice and BaseFlashJob interfaces
- [ ] Uses useBaseFlashPanel hook
- [ ] Uses DeviceScanControls component
- [ ] Uses FlashProgressDisplay for progress
- [ ] Removed duplicate scanning logic
- [ ] Removed duplicate error handling
- [ ] Kept brand-specific functionality
- [ ] Tested device scanning
- [ ] Tested flash operation
- [ ] Tested error cases

## Testing

```bash
# Test your migrated component
npm run test:unit -- YourBrandFlashPanel

# Test integration with backend
npm run test:integration -- flash

# Run full test suite
npm run test:all
```

## Common Pitfalls

1. **Don't override base behavior unless necessary**
   - The base hook handles errors, notifications, and state updates
   - Only add custom logic for brand-specific requirements

2. **Use the provided utilities**
   - DeviceScanControls for scanning UI
   - FlashProgressDisplay for progress
   - Don't recreate these from scratch

3. **Type safety**
   - Always extend BaseDevice and BaseFlashJob
   - Don't use `any` types

4. **Error handling**
   - Base hook handles common errors
   - Only catch brand-specific errors

## Need Help?

- Check `src/components/core/BaseFlashPanel.tsx` for full API
- See existing implementations in `src/components/`
- Ask in team chat before making breaking changes
