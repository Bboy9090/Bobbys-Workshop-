/**
 * Flash Lab capability gate. Pure policy engine: never invokes a device or a writer.
 * Never authorizes device writes: eligibility is advisory until a trusted execution service validates receipts.
 */
export const CAPABILITY_STATES = Object.freeze([
  'NOT_IMPLEMENTED', 'SIMULATED', 'READ_ONLY_QUALIFIED', 'PHYSICAL_WRITE_QUALIFIED'
]);

const READS = new Set(['detect', 'inspect']);
const WRITES = new Set(['partition-flash', 'userdata-wipe', 'bootloader-unlock', 'recovery-sideload', 'media-write']);
const string = value => typeof value === 'string' ? value.trim() : '';
const sha256 = value => /^[a-f\d]{64}$/i.test(string(value));

export function evaluateFlashCapability(request = {}, manifest = {}) {
  const blockers = [];
  const operation = string(request.operation);
  const protocol = string(request.protocol);
  const model = string(request.model).toUpperCase();
  const state = CAPABILITY_STATES.includes(manifest.status) ? manifest.status : 'NOT_IMPLEMENTED';
  const write = WRITES.has(operation);
  if (!READS.has(operation) && !write) blockers.push('Unknown operation; explicit capability classification required');
  if (!operation || !protocol) blockers.push('Operation and protocol required');
  if (!model || model !== string(manifest.model).toUpperCase()) blockers.push('Exact device model mismatch');
  if (protocol !== string(manifest.protocol)) blockers.push('Protocol does not match qualified adapter');
  if (!Array.isArray(manifest.operations) || !manifest.operations.includes(operation)) blockers.push('Operation absent from capability manifest');
  if (request.trustedDeviceIdentity !== true) blockers.push('No trusted live device identity attestation');
  if (!write && state !== 'READ_ONLY_QUALIFIED' && state !== 'PHYSICAL_WRITE_QUALIFIED') {
    blockers.push('Read-only qualification absent');
  }
  if (write) {
    if (state !== 'PHYSICAL_WRITE_QUALIFIED') blockers.push('Physical write qualification absent');
    if (request.explicitConsent !== true) blockers.push('Explicit operator consent missing');
    if (request.signedScopedGrantVerified !== true) blockers.push('Signed scoped qualification grant not verified');
    if (!sha256(request.payloadSha256)) blockers.push('Verified SHA-256 payload evidence missing');
    if (request.firmwareCompatibilityVerified !== true) blockers.push('Exact firmware, region and bootloader revision unverified');
    if (request.recoveryPlanQualified !== true) blockers.push('Model-specific recovery procedure unqualified');
    if (request.journalReady !== true) blockers.push('Durable transaction evidence not ready');
    if (operation === 'partition-flash' && !string(request.partition)) blockers.push('Exact target partition missing');
  }
  // No caller-provided field can override a manifest that is not physically qualified.
  const policyEligible = blockers.length === 0;
  // Read-only capabilities may be authorized after identity/policy validation.
  // Destructive operations remain advisory-only here and require the trusted execution service.
  const authorized = !write && policyEligible;
  return Object.freeze({schema:'bobfwtools.flashlab.capability.v1', operation,
    protocol, model, status:state, destructive:write,
    policyEligible, authorized, blockers});
}

// No write adapters are qualified by this built-in catalog. Entries are diagnostic-only.
export const BUILTIN_MANIFESTS = Object.freeze({
  'SM-A176U': Object.freeze({model:'SM-A176U',protocol:'samsung-download',
    status:'READ_ONLY_QUALIFIED',operations:['detect','inspect']})
});
