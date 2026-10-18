import {expect, test} from 'vitest';
import {evaluateFlashCapability} from '../src/lib/flashlab-capability-gate.js';
const request = {operation:'partition-flash',protocol:'fastboot',model:'TEST-1',trustedDeviceIdentity:true,
 explicitConsent:true,signedScopedGrantVerified:true,payloadSha256:'a'.repeat(64),
 firmwareCompatibilityVerified:true,recoveryPlanQualified:true,journalReady:true,partition:'boot'};
const manifest = {model:'TEST-1',protocol:'fastboot',status:'PHYSICAL_WRITE_QUALIFIED',operations:['partition-flash']};
test('unknown operations cannot become read-only through a caller supplied manifest', () => {
 for (const operation of ['erase','flash','format','oem-unlock','unexpected']) {
  const result = evaluateFlashCapability({...request,operation},{...manifest,operations:[operation]});
  expect(result.authorized).toBe(false); expect(result.policyEligible).toBe(false);
 }
});
test('every evidence flag requires literal true, including for advisory eligibility', () => {
 for (const key of ['trustedDeviceIdentity','explicitConsent','signedScopedGrantVerified',
 'firmwareCompatibilityVerified','recoveryPlanQualified','journalReady']) {
  for (const value of ['true','false',' ',1,{},[],null,false]) {
   const result = evaluateFlashCapability({...request,[key]:value}, manifest);
   expect(result.policyEligible, key + ':' + String(value)).toBe(false);
  }
 }
});
test('read-only identity also rejects truthy strings', () => {
 const result = evaluateFlashCapability({...request,operation:'inspect',trustedDeviceIdentity:'true'},
 {...manifest,operations:['inspect']});
 expect(result.authorized).toBe(false);
});
