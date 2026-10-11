import { describe, expect, it } from 'vitest';
import { comparePublishedSha256, createFirmwarePreflight } from '../src/lib/firmware-preflight';
const firmware = {manufacturer:'Google Pixel',model:'Pixel 8',build:'UD1A',region:'US'};
const device = {manufacturer:'Google Pixel',model:'Pixel 8',region:'US'};
const allEvidence = {
  actualSha256:'a'.repeat(64), trustedPublishedSha256:'a'.repeat(64),
  sourceAuthenticated:true, oemSignatureVerified:true,
  rollbackCompatible:true, partitionMapQualified:true,
};
describe('firmware preflight receipts',()=>{
  it('separates checksum integrity from OEM authorization',()=>{
    expect(comparePublishedSha256('A'.repeat(64),'a'.repeat(64))).toBe('match');
    expect(comparePublishedSha256('a'.repeat(64),'b'.repeat(64))).toBe('mismatch');
    expect(comparePublishedSha256(null,'b'.repeat(64))).toBe('missing');
    expect(comparePublishedSha256('invalid','b'.repeat(64))).toBe('invalid');
  });
  it('always blocks execution even when all reported conditions are positive',()=>{
    const receipt=createFirmwarePreflight(device,firmware,allEvidence,'2026-10-10T00:00:00Z');
    expect(receipt.status).toBe('blocked');
    expect(receipt.blockers).toContain('Hardware SKU, OEM signature, rollback policy, and flash authorization not certified');
    expect(receipt.evidence.checksum).toBe('match');
  });
  it('reports missing signatures, rollback evidence and partition qualification independently',()=>{
    const receipt=createFirmwarePreflight(device,firmware,{
      ...allEvidence, trustedPublishedSha256:null, oemSignatureVerified:false,
      rollbackCompatible:false, partitionMapQualified:false,
    });
    expect(receipt.evidence.checksum).toBe('missing');
    expect(receipt.blockers.some(x=>x.includes('OEM package signature'))).toBe(true);
    expect(receipt.blockers.some(x=>x.includes('anti-rollback'))).toBe(true);
    expect(receipt.blockers.some(x=>x.includes('Partition layout'))).toBe(true);
  });
  it('propagates model and region mismatches',()=>{
    const receipt=createFirmwarePreflight({...device,model:'Pixel 7',region:'EU'},firmware,allEvidence);
    expect(receipt.blockers).toContain('Model conflict');
    expect(receipt.blockers).toContain('Regional firmware variant conflict');
  });
});
