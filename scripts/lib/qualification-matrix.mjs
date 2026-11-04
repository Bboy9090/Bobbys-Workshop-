/**
 * Evidence reporting only. No matrix result authorizes device execution.
 * Cases bind exact model, device alias, protocol, operation, scope and revision.
 * Simulation and historical hardware observations never fill a current physical row.
 */
export const RESULTS = Object.freeze(['PASS', 'FAIL', 'BLOCKED', 'NOT TESTED']);
export const SCOPES = Object.freeze(['simulated', 'hardware-read', 'hardware-write', 'release']);
const SHA256 = /^[a-f0-9]{64}$/i;
const REVISION = /^[a-f0-9]{40}$/i;
const text = value => typeof value === 'string' && value.trim().length > 0;
const bindings = ['caseId', 'model', 'deviceAlias', 'protocol', 'operation', 'scope', 'sourceRevision'];
const priorities = {'FAIL': 3, 'BLOCKED': 2, 'NOT TESTED': 1, 'PASS': 0};

export function buildQualificationMatrix(cases, receipts, options = {}) {
  if (!Array.isArray(cases) || !Array.isArray(receipts)) throw Error('Cases and receipts must be arrays');
  const now = options.now ?? Date.now();
  if (!Number.isFinite(now)) throw Error('Invalid evaluation time');
  const maxAgeMs = options.maxAgeMs ?? 86400000;
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) throw Error('Invalid evidence lifetime');
  const ids = new Set();
  return cases.map(spec => {
    if (!spec || !bindings.every(key => text(spec[key])) || !SCOPES.includes(spec.scope) ||
        !REVISION.test(spec.sourceRevision) || ids.has(spec.caseId)) throw Error('Invalid or duplicate qualification case');
    ids.add(spec.caseId);
    const row = {...spec, status:'NOT TESTED', reason:'No current evidence for this exact capability', artifacts:[],
      executionAuthorized:false};
    if (text(spec.exception)) return {...row, status:'BLOCKED', reason:spec.exception};
    const matching = receipts.filter(receipt => receipt && bindings.every(key => receipt[key] === spec[key]));
    if (!matching.length) return row;
    // Latest observation wins. A tied failure cannot be masked by a passing receipt.
    matching.sort((a,b) => (Date.parse(b.observedAt) || 0) - (Date.parse(a.observedAt) || 0) ||
      (priorities[b.status] ?? 4) - (priorities[a.status] ?? 4));
    const receipt = matching[0];
    const observedAt = Date.parse(receipt.observedAt);
    if (!Number.isFinite(observedAt) || observedAt > now || now - observedAt > maxAgeMs) {
      return {...row, status:'BLOCKED', reason:'Evidence missing a valid current timestamp'};
    }
    if (!RESULTS.includes(receipt.status) || !text(receipt.detail)) {
      return {...row, status:'BLOCKED', reason:'Malformed evidence result'};
    }
    const artifacts = receipt.artifacts;
    const checked = Array.isArray(artifacts) && artifacts.length > 0 && artifacts.every(artifact =>
      artifact && text(artifact.path) && SHA256.test(artifact.sha256 ?? '') &&
      typeof options.verifyArtifact === 'function' && options.verifyArtifact(artifact) === true);
    if (!checked) return {...row, status:'BLOCKED', reason:'Evidence artifact missing or hash not verified'};
    if (receipt.status === 'PASS' && spec.scope === 'hardware-write') {
      const required = ['liveIdentity', 'trustedFirmware', 'firmwareCompatibility', 'recoveryReadiness', 'deviceSpecificApproval', 'postWriteVerification'];
      if (!required.every(key => Array.isArray(receipt.controls?.[key]) &&
          receipt.controls[key].length > 0 && receipt.controls[key].every(index =>
            Number.isInteger(index) && index >= 0 && index < artifacts.length))) {
        return {...row, status:'BLOCKED', reason:'Separate device-write evidence controls incomplete'};
      }
    }
    return {...row, status:receipt.status, reason:receipt.detail, observedAt:receipt.observedAt, artifacts};
  });
}

export function matrixMarkdown(rows) {
  const escape = value => String(value).replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
  return ['| Device / model | Protocol / operation | Evidence scope | Result | Detail |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(row => '| ' + [row.deviceAlias + ' / ' + row.model, row.protocol + ' / ' + row.operation,
      row.scope, row.status, row.reason].map(escape).join(' | ') + ' |'),
    '', 'Evidence report only. Every row keeps executionAuthorized=false.', ''].join('\n');
}
