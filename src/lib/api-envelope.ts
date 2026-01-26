/**
 * API Envelope Types and Utilities (Frontend)
 * Matches server-side envelope format
 */

export interface ApiMeta {
  ts: string;
  correlationId: string;
  apiVersion: string;
  demo?: boolean;
  [key: string]: any;
}

export interface ApiErrorDetails {
  code: string;
  message: string;
  details?: any;
}

export interface ApiEnvelope<T> {
  ok: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiError {
  ok: false;
  error: ApiErrorDetails;
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiEnvelope<T> | ApiError;

/**
 * Check if response is a success envelope
 */
export function isSuccessEnvelope<T>(response: ApiResponse<T>): response is ApiEnvelope<T> {
  return response.ok === true;
}

/**
 * Check if response is an error envelope
 */
export function isErrorEnvelope<T>(response: ApiResponse<T>): response is ApiError {
  return response.ok === false;
}

/**
 * Extract data from envelope, throwing if error
 */
export function unwrapEnvelope<T>(response: ApiResponse<T>): T {
  if (isSuccessEnvelope(response)) {
    return response.data;
  }
  throw new Error(response.error.message || 'API request failed');
}

/**
 * Parse fetch response as envelope.
 * Detects HTML (e.g. 404/SPA fallback) and throws a clear error instead of "Unexpected token '<'".
 */
export async function parseEnvelope<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text();
  const ct = response.headers.get('content-type') ?? '';
  if (
    !ct.includes('application/json') &&
    (text.trimStart().startsWith('<') || /^\s*<!DOCTYPE/i.test(text))
  ) {
    throw new Error(
      'Backend returned HTML instead of JSON. Is the API server running at http://localhost:3001? Start it with "npm run server:start" or ensure the desktop app started the backend.'
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from API: ${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`);
  }

  // Check if it's already an envelope (has 'ok' property)
  if (typeof data === 'object' && data !== null && 'ok' in data) {
    return data as ApiResponse<T>;
  }

  // Legacy format - wrap it
  return {
    ok: response.ok as true,
    data: data as T,
    meta: {
      ts: new Date().toISOString(),
      correlationId: response.headers.get('X-Correlation-Id') || '',
      apiVersion: 'v1'
    }
  };
}

/**
 * Fetch with automatic envelope parsing
 */
export async function fetchEnvelope<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(url, options);
  return parseEnvelope<T>(response);
}

