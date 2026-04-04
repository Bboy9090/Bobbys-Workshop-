/**
 * API base URL for the Node workshop backend.
 * Vite injects VITE_API_BASE in dev/desktop builds when needed.
 */
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  'http://127.0.0.1:3001';

export type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: { ts: string; correlationId: string; apiVersion: string };
};

async function parseEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
  const json = (await res.json()) as ApiEnvelope<T> | T;
  if (json && typeof json === 'object' && 'ok' in json) {
    return json as ApiEnvelope<T>;
  }
  return { ok: res.ok, data: json as T };
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  return parseEnvelope<T>(res);
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
