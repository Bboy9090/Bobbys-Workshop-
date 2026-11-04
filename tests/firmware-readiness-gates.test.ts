import {describe,it,expect} from 'vitest';
import {evaluateFirmwareReadiness} from '../scripts/lib/firmware-readiness-gates.mjs';
describe('evidence gate cannot be bypassed by user authorization',()=>{
 it('lists all missing evidence from an empty receipt',()=>{
  const result=evaluateFirmwareReadiness({});
  expect(result.missing.length).toBeGreaterThan(5);
  expect(result.inspectionEnabled).toBe(true);
  expect(result.flashAuthorized).toBe(false);
 });
 it('never treats unverified claims or full user consent as flash proof',()=>{
  const hash='a'.repeat(64);
  const result=evaluateFirmwareReadiness({deviceSerial:'ABC123',deviceModel:'Pixel',
   oemModelMatch:true,manufacturerPublishedSha256:hash,actualSha256:hash,
   oemSignatureVerified:true,antiRollbackVerified:true,hardwareQualified:true,
   recoveryPrepared:true,explicitUserConsent:true});
  expect(result.missing).toEqual([]);
  expect(result.flashAuthorized).toBe(false);
  expect(result.downloadEligible).toBe(false);
 });
});