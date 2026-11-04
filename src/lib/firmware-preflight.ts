import { normalizeFirmwareRecord, inspectFirmwareCompatibility, type FirmwareRecord } from './firmware-inventory-contract';

export type FirmwareArtifactEvidence = {
  actualSha256: string | null;
  trustedPublishedSha256: string | null;
  sourceAuthenticated: boolean;
  oemSignatureVerified: boolean;
  rollbackCompatible: boolean;
  partitionMapQualified: boolean;
};
export type FirmwarePreflightReceipt = {
  status: 'blocked';
  firmware: FirmwareRecord;
  evidence: { checksum: 'match' | 'mismatch' | 'missing' | 'invalid'; trustedSource: boolean; signed: boolean };
  blockers: string[];
  timestamp: string;
};
const validHash = (value: string | null) => value !== null && /^[a-f0-9]{64}$/i.test(value);
export function comparePublishedSha256(actual: string | null, published: string | null):
  'match' | 'mismatch' | 'missing' | 'invalid' {
  if (actual === null || published === null) return 'missing';
  if (!validHash(actual) || !validHash(published)) return 'invalid';
  return actual.toLowerCase() === published.toLowerCase() ? 'match' : 'mismatch';
}
export function createFirmwarePreflight(
  device: {manufacturer?: string | null; model?: string | null; region?: string | null},
  rawFirmware: unknown,
  evidence: FirmwareArtifactEvidence,
  timestamp = new Date().toISOString()
): FirmwarePreflightReceipt {
  const firmware = normalizeFirmwareRecord(rawFirmware);
  const match = inspectFirmwareCompatibility(device, firmware);
  const checksum = comparePublishedSha256(evidence.actualSha256, evidence.trustedPublishedSha256);
  const blockers = [...match.blockers];
  if (checksum !== 'match') blockers.push('Published firmware SHA-256 not matched');
  if (!evidence.sourceAuthenticated) blockers.push('OEM source authenticity not established');
  if (!evidence.oemSignatureVerified) blockers.push('OEM package signature not cryptographically validated');
  if (!evidence.rollbackCompatible) blockers.push('Bootloader and anti-rollback compatibility not validated');
  if (!evidence.partitionMapQualified) blockers.push('Partition layout and hardware revision not qualified');
  // This read-only receipt is intentionally unable to authorize a firmware write.
  return {
    status: 'blocked',
    firmware,
    evidence: {checksum, trustedSource: evidence.sourceAuthenticated, signed: evidence.oemSignatureVerified},
    blockers: [...new Set(blockers)],
    timestamp,
  };
}
