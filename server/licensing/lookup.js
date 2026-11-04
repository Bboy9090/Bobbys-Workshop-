import { createHmac } from 'node:crypto';

/**
 * Keyed lookup digest for a license key. Stored in users.license_key_lookup.
 * A bare hash of a low-entropy license key can be brute-forced if the table leaks; a
 * server-side pepper that is absent from the database prevents that. Rotating the pepper
 * requires re-keying every row, so the pepper must be held in a secret store.
 */
export function licenseKeyLookup(licenseKey, pepper) {
  if (typeof licenseKey !== 'string' || licenseKey.length === 0) {
    throw new TypeError('licenseKey must be a non-empty string');
  }
  if (typeof pepper !== 'string' || pepper.length < 32) {
    throw new TypeError('pepper must be at least 32 characters');
  }
  return createHmac('sha256', pepper).update(licenseKey, 'utf8').digest('hex');
}
