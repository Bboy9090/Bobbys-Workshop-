/**
 * Workshop API client — same host in dev (Vite proxy → :3001), explicit URL in packaged/desktop.
 */

function resolveApiBase(): string {
  const env = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '');
  if (env) return env;
  if (import.meta.env.DEV) {
    return '';
  }
  if (typeof window !== 'undefined' && window.location?.protocol === 'file:') {
    return 'http://127.0.0.1:3001';
  }
  return 'http://127.0.0.1:3001';
}

export const API_BASE = resolveApiBase();

export function resolveWsBase(): string {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const { protocol, host } = window.location;
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${host}`;
  }
  const base = API_BASE || 'http://127.0.0.1:3001';
  return base.replace(/^http/, 'ws');
}

export type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: { ts: string; correlationId: string; apiVersion: string };
};

async function parseEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      error: { code: 'INVALID_JSON', message: text.slice(0, 200) },
    };
  }
  if (json && typeof json === 'object' && 'ok' in json) {
    return json as ApiEnvelope<T>;
  }
  return { ok: res.ok, data: json as T };
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    return parseEnvelope<T>(res);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: {
        code: 'NETWORK',
        message: `Cannot reach API at ${url || 'relative'} — ${message}. Start the workshop server (port 3001).`,
      },
    };
  }
}

/** GET /api/v1/health */
export async function getV1Health(): Promise<ApiEnvelope<{ status: string; healthy: boolean }>> {
  return fetchJson('/api/v1/health');
}

/** GET /api/v1/ready */
export async function getV1Ready(): Promise<
  ApiEnvelope<{ ready: boolean; checks?: Record<string, unknown>; version?: string }>
> {
  return fetchJson('/api/v1/ready');
}

/** GET /api/v1/system-tools */
export async function getSystemTools(): Promise<ApiEnvelope<Record<string, unknown>>> {
  return fetchJson('/api/v1/system-tools');
}

export type ScanDevice = {
  device_uid: string;
  display_name: string;
  platform_hint: string;
  mode: string;
  confidence: number;
  correlation_badge?: string;
  evidence?: Record<string, unknown>;
};

export type ScanResponse = {
  devices: ScanDevice[];
  count: number;
  tools?: {
    adb: { installed: boolean; resolvedPath?: string };
    fastboot: { installed: boolean; resolvedPath?: string };
  };
};

export async function getDeviceScan(): Promise<ApiEnvelope<ScanResponse>> {
  return fetchJson<ScanResponse>('/api/devices/scan');
}

export type AdbDeviceRow = {
  serial: string;
  status: string;
  properties: Record<string, string>;
  connected: boolean;
};

export async function getAdbDevices(): Promise<ApiEnvelope<{ devices: AdbDeviceRow[]; count: number }>> {
  return fetchJson('/api/v1/adb/devices');
}

export async function getAdbDeviceInfo(serial: string): Promise<ApiEnvelope<Record<string, unknown>>> {
  const q = new URLSearchParams({ serial });
  return fetchJson(`/api/v1/adb/device-info?${q.toString()}`);
}

export async function adbRebootBootloader(serial: string): Promise<ApiEnvelope<unknown>> {
  return fetchJson('/api/v1/authorization/adb/reboot-bootloader', {
    method: 'POST',
    body: JSON.stringify({ serial }),
  });
}

export async function adbRebootRecovery(serial: string): Promise<ApiEnvelope<unknown>> {
  return fetchJson('/api/v1/authorization/adb/reboot-recovery', {
    method: 'POST',
    body: JSON.stringify({ serial }),
  });
}

export type RepairCase = {
  id: string;
  title: string;
  notes: string;
  userId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  devicePassport?: unknown;
  ownershipVerification?: unknown;
};

export async function createCase(body: {
  title?: string;
  notes?: string;
  userId?: string;
}): Promise<ApiEnvelope<{ case: RepairCase }>> {
  return fetchJson<{ case: RepairCase }>('/api/v1/cases', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function postCaseIntake(
  caseId: string,
  body: { platform?: string; connectionState?: string; deviceInfo?: Record<string, unknown> }
): Promise<ApiEnvelope<{ case: RepairCase }>> {
  return fetchJson<{ case: RepairCase }>(`/api/v1/cases/${encodeURIComponent(caseId)}/intake`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function postOwnershipVerification(
  caseId: string,
  body: { checkboxConfirmed: boolean; typedPhrase: string; proofOfPurchase?: Record<string, unknown> }
): Promise<ApiEnvelope<{ case: RepairCase }>> {
  return fetchJson<{ case: RepairCase }>(`/api/v1/cases/${encodeURIComponent(caseId)}/ownership`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCaseAudit(caseId: string): Promise<
  ApiEnvelope<{ caseId: string; events: unknown[]; statistics: unknown }>
> {
  return fetchJson(`/api/v1/cases/${encodeURIComponent(caseId)}/audit`);
}

export async function triggerBackupAuth(serial: string): Promise<ApiEnvelope<unknown>> {
  return fetchJson('/api/v1/authorization/adb/trigger-backup', {
    method: 'POST',
    body: JSON.stringify({ serial }),
  });
}
