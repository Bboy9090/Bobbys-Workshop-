export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  USE_MOCK: false,
  API_VERSION: 'v1',
  ENDPOINTS: {
    HEALTH: '/api/v1/health',
    READY: '/api/v1/ready',
    SYSTEM_TOOLS: '/api/v1/system-tools',
    SYSTEM_TOOLS_RUST: '/api/system-tools/rust',
    SYSTEM_TOOLS_ANDROID: '/api/system-tools/android',
    SYSTEM_TOOLS_ANDROID_ENSURE: '/api/system-tools/android/ensure',
    SYSTEM_TOOLS_PYTHON: '/api/system-tools/python',
    SYSTEM_INFO: '/api/system-info',
    ADB_DEVICES: '/api/v1/adb/devices',
    ADB_COMMAND: '/api/v1/adb/command',
    ADB_TRIGGER_AUTH: '/api/v1/adb/trigger-auth',
    FASTBOOT_DEVICES: '/api/v1/fastboot/devices',
    FASTBOOT_DEVICE_INFO: '/api/v1/fastboot/device-info',
    FASTBOOT_FLASH: '/api/v1/fastboot/flash',
    FASTBOOT_UNLOCK: '/api/v1/fastboot/unlock',
    FASTBOOT_REBOOT: '/api/v1/fastboot/reboot',
    FASTBOOT_ERASE: '/api/v1/fastboot/erase',
    FLASH_DEVICES: '/api/v1/flash/devices',
    FLASH_DEVICE_INFO: '/api/v1/flash/devices',
    FLASH_DEVICE_PARTITIONS: '/api/v1/flash/devices',
    FLASH_VALIDATE_IMAGE: '/api/v1/flash/validate-image',
    FLASH_START: '/api/v1/flash/start',
    FLASH_PAUSE: '/api/v1/flash/pause',
    FLASH_RESUME: '/api/v1/flash/resume',
    FLASH_CANCEL: '/api/v1/flash/cancel',
    FLASH_STATUS: '/api/v1/flash/status',
    FLASH_ACTIVE_OPERATIONS: '/api/v1/flash/operations/active',
    FLASH_HISTORY: '/api/v1/flash/history',
    BOOTFORGEUSB_SCAN: '/api/v1/bootforgeusb/scan',
    BOOTFORGEUSB_STATUS: '/api/v1/bootforgeusb/status',
    AUTHORIZATION_TRIGGERS: '/api/v1/authorization/triggers',
    MONITOR_START: '/api/v1/monitor/start',
    MONITOR_STOP: '/api/v1/monitor/stop',
    MONITOR_LIVE: '/api/v1/monitor/live',
    TESTS_RUN: '/api/v1/tests/run',
    TESTS_RESULTS: '/api/v1/tests/results',
    STANDARDS: '/api/v1/standards',
    HOTPLUG_EVENTS: '/api/v1/hotplug/events',
  },
  TIMEOUT: 10000,
};

export async function checkAPIHealth(): Promise<boolean> {
  if (API_CONFIG.USE_MOCK) return true;
  
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.HEALTH}`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function getAPIUrl(endpoint: string): string {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}

export function getWSUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  try {
    const base = new URL(API_CONFIG.BASE_URL);
    const wsProtocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    const basePath = base.pathname && base.pathname !== '/' ? base.pathname.replace(/\/+$/g, '') : '';
    return `${wsProtocol}//${base.host}${basePath}${normalizedPath}`;
  } catch {
    return `ws://localhost:3001${normalizedPath}`;
  }
}
