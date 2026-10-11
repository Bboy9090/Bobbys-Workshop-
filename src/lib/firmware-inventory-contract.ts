/**
 * Read-only firmware metadata normalization. A matching model or checksum does
 * not establish OEM signature trust or permission to flash.
 */
export type FirmwareRecord = {
  manufacturer: string;
  model: string;
  build: string;
  region: string | null;
  carrier: string | null;
  version: string | null;
  sourceUrl: string | null;
  expectedSha256: string | null;
};
export type FirmwareDecision = {
  state: 'inspection-only' | 'model-conflict' | 'missing-evidence';
  compatible: false;
  blockers: string[];
};
const textField = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

export function normalizeFirmwareRecord(value: unknown): FirmwareRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid firmware record');
  const data = value as Record<string, unknown>;
  const manufacturer = textField(data.manufacturer, 80);
  const model = textField(data.model, 80);
  const build = textField(data.build, 150);
  if (!manufacturer || !model || !build) throw Error('Manufacturer, exact model, and build are required');
  const sourceUrl = textField(data.sourceUrl, 1200);
  if (sourceUrl) {
    let address: URL;
    try { address = new URL(sourceUrl); } catch { throw Error('Invalid source URL'); }
    if (address.protocol !== 'https:' || !address.hostname || address.username || address.password)
      throw Error('Firmware sources require credential-free HTTPS');
  }
  const expectedSha256 = textField(data.expectedSha256, 64)?.toLowerCase() ?? null;
  if (expectedSha256 && !/^[a-f0-9]{64}$/.test(expectedSha256)) throw Error('Invalid SHA-256');
  return {
    manufacturer, model, build,
    region: textField(data.region, 40),
    carrier: textField(data.carrier, 40),
    version: textField(data.version, 80),
    sourceUrl, expectedSha256,
  };
}
export function normalizeFirmwareInventory(value: unknown): FirmwareRecord[] {
  if (!Array.isArray(value) || value.length > 5000) throw Error('Expected at most 5000 firmware records');
  const records = value.map(normalizeFirmwareRecord);
  const ids = records.map(r => [r.manufacturer,r.model,r.region ?? '',r.carrier ?? '',r.build].map(s => s.toUpperCase()).join('|'));
  if (new Set(ids).size !== ids.length) throw Error('Duplicate firmware build identity');
  return records;
}
export function inspectFirmwareCompatibility(device: {manufacturer?: string | null; model?: string | null; region?: string | null},
  firmware: FirmwareRecord): FirmwareDecision {
  const blockers: string[] = [];
  const norm = (s: string | null | undefined) => s?.trim().toUpperCase() || '';
  if (!norm(device.manufacturer) || !norm(device.model)) blockers.push('Exact connected-device identity missing');
  if (norm(device.manufacturer) && norm(device.manufacturer) !== norm(firmware.manufacturer))
    blockers.push('Manufacturer conflict');
  if (norm(device.model) && norm(device.model) !== norm(firmware.model))
    blockers.push('Model conflict');
  if (device.region && firmware.region && norm(device.region) !== norm(firmware.region))
    blockers.push('Regional firmware variant conflict');
  blockers.push('Hardware SKU, OEM signature, rollback policy, and flash authorization not certified');
  return {
    state: blockers.some(b => /conflict/.test(b)) ? 'model-conflict' :
      blockers.some(b => /missing/.test(b)) ? 'missing-evidence' : 'inspection-only',
    compatible: false,
    blockers,
  };
}
