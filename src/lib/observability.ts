import * as Sentry from '@sentry/react';

const REDACTED = '[REDACTED]';
const REDACTED_URL = '[REDACTED_URL]';
const MAX_STRING_LENGTH = 256;
const MAX_DEPTH = 6;

const SENSITIVE_KEY = /(?:serial|imei|meid|udid|device.?id|firmware|build.?fingerprint|file.?path|source.?path|destination.?path|token|authorization|password|secret|cookie|dsn)/i;
const ABSOLUTE_PATH = /(?:\/Users\/[^\s]+|\/home\/[^\s]+|[A-Za-z]:\\Users\\[^\s]+)/g;
const FILE_URL = /file:\/\/[^\s]+/gi;

function sanitizeString(value: string): string {
  const scrubbed = value.replace(FILE_URL, REDACTED_URL).replace(ABSOLUTE_PATH, REDACTED);
  return scrubbed.length > MAX_STRING_LENGTH ? `${scrubbed.slice(0, MAX_STRING_LENGTH)}…` : scrubbed;
}

export function sanitizeObservabilityUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  if (/^file:/i.test(value)) return REDACTED_URL;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
    return `${url.protocol}//${url.host || 'local'}`;
  } catch {
    return REDACTED_URL;
  }
}

export function sanitizeObservabilityValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[TRUNCATED]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeObservabilityValue(item, depth + 1));
  if (typeof value !== 'object') return String(value);

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
    output[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitizeObservabilityValue(item, depth + 1);
  }
  return output;
}

export function sanitizeSentryEvent<T extends Record<string, unknown>>(event: T): T {
  const sanitized = sanitizeObservabilityValue(event) as T;
  delete (sanitized as Record<string, unknown>).user;

  const request = sanitized.request as Record<string, unknown> | undefined;
  if (request) {
    request.url = sanitizeObservabilityUrl(request.url);
    delete request.cookies;
    delete request.data;
    delete request.query_string;
    delete request.headers;
  }

  return sanitized;
}

function observabilityEnvironment(): Record<string, string | undefined> {
  return import.meta.env as unknown as Record<string, string | undefined>;
}

export function initPrivacySafeObservability(): boolean {
  const env = observabilityEnvironment();
  const enabled = env.VITE_OBSERVABILITY_ENABLED === 'true';
  const dsn = env.VITE_SENTRY_DSN?.trim();
  if (!enabled || !dsn || !/^https:\/\//i.test(dsn)) return false;

  Sentry.init({
    dsn,
    environment: sanitizeString(env.VITE_APP_ENV?.trim() || 'production'),
    release: env.VITE_RELEASE_SHA?.trim().slice(0, 80),
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    tracesSampleRate: 0,
    maxBreadcrumbs: 20,
    beforeSend(event) {
      return sanitizeSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
    },
    beforeBreadcrumb(breadcrumb) {
      return sanitizeObservabilityValue(breadcrumb) as typeof breadcrumb;
    },
  });

  Sentry.setTag('app', 'bobfwtools');
  return true;
}
