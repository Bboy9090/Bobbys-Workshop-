#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const path = process.argv[2] || 'resources/remote-config/default.json';
const value = JSON.parse(await readFile(path, 'utf8'));
const errors = [];
const allowed = new Set([
  'schema',
  'diagnosticsEnabled',
  'telemetrySampleRate',
  'cloudPublicationEnabled',
  'catalogRefreshEnabled',
  'releaseChannel',
  'observationConcurrencyLimit',
  'adbObservationTtlMs',
]);
const forbiddenPattern = /(write|flash|frp|unlock|bypass|wipe|erase|root|execution|authorization|destructive)/i;

if (value.schema !== 'com.bobbyblanco.bobfwtools.safe-remote-config.v1') {
  errors.push('unsupported remote config schema');
}
for (const key of Object.keys(value)) {
  if (!allowed.has(key)) errors.push(`unsupported remote config key: ${key}`);
  if (forbiddenPattern.test(key)) errors.push(`dangerous remote config key is forbidden: ${key}`);
}
if (typeof value.diagnosticsEnabled !== 'boolean') errors.push('diagnosticsEnabled must be boolean');
if (typeof value.cloudPublicationEnabled !== 'boolean') errors.push('cloudPublicationEnabled must be boolean');
if (typeof value.catalogRefreshEnabled !== 'boolean') errors.push('catalogRefreshEnabled must be boolean');
if (!Number.isFinite(value.telemetrySampleRate) || value.telemetrySampleRate < 0 || value.telemetrySampleRate > 0.25) {
  errors.push('telemetrySampleRate must be between 0 and 0.25');
}
if (!['dev', 'canary', 'qualified', 'stable'].includes(value.releaseChannel)) {
  errors.push('releaseChannel is invalid');
}
if (!Number.isInteger(value.observationConcurrencyLimit) || value.observationConcurrencyLimit < 1 || value.observationConcurrencyLimit > 4) {
  errors.push('observationConcurrencyLimit must be 1-4');
}
if (!Number.isInteger(value.adbObservationTtlMs) || value.adbObservationTtlMs < 100 || value.adbObservationTtlMs > 5000) {
  errors.push('adbObservationTtlMs must be 100-5000');
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(2);
}
console.log(JSON.stringify({ valid: true, deviceWriteAuthorityGranted: false }));
