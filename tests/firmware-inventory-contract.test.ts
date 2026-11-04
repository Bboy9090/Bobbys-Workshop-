import { describe, expect, it } from 'vitest';
import { inspectFirmwareCompatibility, normalizeFirmwareRecord, normalizeFirmwareInventory } from '../src/lib/firmware-inventory-contract';

const example = {
  manufacturer: 'Samsung', model: 'SM-S911U', build: 'S911USQS5',
  region: 'USA', carrier: 'TMB', sourceUrl: 'https://www.samsung.com/',
  expectedSha256: 'a'.repeat(64),
};
describe('Firmware inventory contract', () => {
  it('normalizes data but never treats metadata as flashing authorization', () => {
    const record = normalizeFirmwareRecord(example);
    const result = inspectFirmwareCompatibility({ manufacturer:'Samsung', model:'SM-S911U',region:'USA' }, record);
    expect(result.state).toBe('inspection-only');
    expect(result.compatible).toBe(false);
    expect(result.blockers.some(b => b.includes('OEM signature'))).toBe(true);
  });
  it('rejects different models, manufacturers, and regional variants', () => {
    const record = normalizeFirmwareRecord(example);
    for (const device of [
      { manufacturer:'Samsung', model:'SM-S911B', region:'USA' },
      { manufacturer:'Motorola', model:'SM-S911U', region:'USA' },
      { manufacturer:'Samsung', model:'SM-S911U', region:'EUR' },
    ]) {
      expect(inspectFirmwareCompatibility(device, record).state).toBe('model-conflict');
    }
  });
  it('fails closed without a verified device identity', () => {
    const result=inspectFirmwareCompatibility({},normalizeFirmwareRecord(example));
    expect(result.state).toBe('missing-evidence');
    expect(result.compatible).toBe(false);
  });
  it('rejects unsafe sources and invalid digests', () => {
    for (const sourceUrl of ['http://example.com/', 'https://user:pass@example.com/', 'file:///tmp/image']) {
      expect(() => normalizeFirmwareRecord({...example,sourceUrl})).toThrow();
    }
    expect(() => normalizeFirmwareRecord({...example,expectedSha256:'abc'})).toThrow();
  });
  it('rejects duplicates and oversized inventories', () => {
    expect(() => normalizeFirmwareInventory([example,example])).toThrow('Duplicate');
    expect(() => normalizeFirmwareInventory(Array.from({length:5001}, (_,i)=>({...example,build:String(i)})))).toThrow();
  });
});
