import {describe,expect,it} from 'vitest';
import {auditPixelFirmwareRelease} from '../src/lib/pixel-release-audit';
const record={deviceCodename:'shiba',buildId:'AP1A.240505.004',releaseDate:'2024-05-05',filename:'shiba-ota.zip',downloadUrl:'https://dl.google.com/android/shiba-ota.zip',sha256:'a'.repeat(64),provenanceUrl:'https://developers.google.com/android/ota'};
describe('release audit receipts',()=>{
 it('reports full evidence gaps even if supplied hash matches',()=>{
  const audit=auditPixelFirmwareRelease(record,'shiba','a'.repeat(64),'2026-10-11T12:00:00Z');
  expect(audit.outcome).toBe('blocked');
  expect(audit.downloadAuthorized).toBe(false);
  expect(audit.flashAuthorized).toBe(false);
  expect(audit.evidence.packageSignature).toBe('unverified');
  expect(audit.blockers.some(x=>x.includes('hardware revision'))).toBe(true);
 });
 it('preserves exact device mismatch in evidence',()=>{
  const audit=auditPixelFirmwareRelease(record,'husky',null);
  expect(audit.blockers).toContain('Exact device codename does not match');
 });
});
