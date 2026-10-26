import { createHash, verify as verifySignature } from 'node:crypto';

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function validateCatalog(catalog) {
  const errors=[];
  if (catalog?.schema !== 'com.bobbyblanco.bobfwtools.device-support-catalog.v1') errors.push('unsupported schema');
  if (!Number.isInteger(catalog?.catalogVersion) || catalog.catalogVersion < 1) errors.push('catalogVersion must be a positive integer');
  if (!Array.isArray(catalog?.entries) || catalog.entries.length === 0) errors.push('entries must be non-empty');
  const seen=new Set();
  for (const entry of catalog?.entries || []) {
    if (!/^[a-z0-9-]+$/.test(entry.vendor || '')) errors.push('vendor must be normalized');
    if (!Array.isArray(entry.models) || entry.models.length === 0) errors.push('models must be non-empty');
    for (const model of entry.models || []) {
      if (!/^[A-Z0-9-]{3,32}$/.test(model)) errors.push(`invalid exact model ${model}`);
      if (seen.has(model)) errors.push(`duplicate exact model ${model}`);
      seen.add(model);
    }
    if (entry.executionAuthorized !== false) errors.push('catalog entries must never grant execution authority');
    if (entry.physicalQualificationRequiredForWrites !== true) errors.push('write-capable models must retain physical qualification');
    if (!Array.isArray(entry.allowedOperations) || entry.allowedOperations.length === 0) errors.push('allowedOperations must be non-empty');
    const prohibited = new Set(entry.prohibitedOperations || []);
    for (const required of ['identity-spoof','frp-bypass','bootloader-rollback','unsigned-loader','security-state-bypass']) {
      if (!prohibited.has(required)) errors.push(`${entry.models?.[0] || 'entry'} missing prohibited operation ${required}`);
    }
  }
  return errors;
}

export function catalogDigest(catalog) {
  return createHash('sha256').update(canonical(catalog)).digest('hex');
}

export function verifyCatalogEnvelope(envelope, publicKeyPem) {
  if (envelope?.schema !== 'com.bobbyblanco.bobfwtools.signed-device-support-catalog.v1') throw new Error('unsupported signed catalog envelope');
  const errors=validateCatalog(envelope.catalog);
  if (errors.length) throw new Error(errors.join('; '));
  const digest=catalogDigest(envelope.catalog);
  if (envelope.catalogSha256 !== digest) throw new Error('catalog digest mismatch');
  if (!['aws-kms','gcp-kms','test-key'].includes(envelope.signature?.provider)) throw new Error('unsupported signature provider');
  const signature=Buffer.from(envelope.signature?.value || '', 'base64');
  if (!signature.length) throw new Error('missing catalog signature');
  const ok=verifySignature('sha256', Buffer.from(canonical(envelope.catalog)), publicKeyPem, signature);
  if (!ok) throw new Error('catalog signature verification failed');
  return { catalogSha256:digest, executionAuthorized:false, entries:envelope.catalog.entries.length };
}
