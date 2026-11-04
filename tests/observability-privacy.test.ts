import { describe, expect, it } from 'vitest';
import {
  sanitizeObservabilityUrl,
  sanitizeObservabilityValue,
  sanitizeSentryEvent,
} from '../src/lib/observability';

describe('privacy-safe observability', () => {
  it('redacts device identifiers, firmware details, credentials, and filesystem paths', () => {
    const value = sanitizeObservabilityValue({
      operation: 'adb-scan-failed',
      serial: 'R52T123456A',
      imei: '123456789012345',
      firmwareFingerprint: 'samsung/build/fingerprint',
      nested: {
        token: 'secret-token',
        message: 'failed reading /Users/bobby/private/device.bin',
      },
    });

    expect(value).toEqual({
      operation: 'adb-scan-failed',
      serial: '[REDACTED]',
      imei: '[REDACTED]',
      firmwareFingerprint: '[REDACTED]',
      nested: {
        token: '[REDACTED]',
        message: 'failed reading [REDACTED]',
      },
    });
  });

  it('removes user identity and request payloads while reducing URLs to origins', () => {
    const event = sanitizeSentryEvent({
      message: 'UI failure',
      user: { id: 'person-1', email: 'person@example.com' },
      request: {
        url: 'https://service.example.com/device/secret?serial=123#private',
        cookies: { session: 'abc' },
        headers: { authorization: 'Bearer secret' },
        data: { deviceSerial: 'R52T123' },
        query_string: 'serial=123',
      },
    });

    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: 'https://service.example.com' });
  });

  it('never emits local file URLs and fails closed on malformed URLs', () => {
    expect(sanitizeObservabilityUrl('file:///Users/bobby/private.txt')).toBe('[REDACTED_URL]');
    expect(sanitizeObservabilityUrl('not a url')).toBe('[REDACTED_URL]');
  });
});
