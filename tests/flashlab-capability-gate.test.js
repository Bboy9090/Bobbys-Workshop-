import {test,expect} from 'vitest';
import {evaluateFlashCapability, BUILTIN_MANIFESTS} from '../src/lib/flashlab-capability-gate.js';
const base={operation:'partition-flash',protocol:'fastboot',model:'TEST-1',trustedDeviceIdentity:true,
 explicitConsent:true,signedScopedGrantVerified:true,payloadSha256:'a'.repeat(64),
 firmwareCompatibilityVerified:true,recoveryPlanQualified:true,journalReady:true,partition:'boot'};
const manifest={model:'TEST-1',protocol:'fastboot',status:'PHYSICAL_WRITE_QUALIFIED',operations:['partition-flash']};
test('Samsung A17 5G catalog cannot authorize a partition write',()=>{
 const r=evaluateFlashCapability({...base,model:'SM-A176U',protocol:'samsung-download'},BUILTIN_MANIFESTS['SM-A176U']);
 expect(r.authorized).toBe(false);expect(r.blockers).toContain('Physical write qualification absent');
});
test('unsupported protocol cannot borrow another protocol qualification',()=>{
 const r=evaluateFlashCapability({...base,protocol:'samsung-download'},manifest);
 expect(r.authorized).toBe(false);
});
test('missing each mandatory physical-write control blocks authorization',()=>{
 for(const key of ['trustedDeviceIdentity','explicitConsent','signedScopedGrantVerified',
 'firmwareCompatibilityVerified','recoveryPlanQualified','journalReady','payloadSha256','partition']){
 const r=evaluateFlashCapability({...base,[key]:key==='payloadSha256'?'no':' '},manifest);
 expect(r.authorized,key).toBe(false);
 }
});
test('unsupported unknown model remains blocked despite claimed full controls',()=>{
 const r=evaluateFlashCapability({...base,model:'OTHER'},manifest);
 expect(r.authorized).toBe(false);
});
test('fully populated synthetic manifest can be policy-eligible without executing writes',()=>{
 const r=evaluateFlashCapability(base,manifest);
 expect(r.policyEligible).toBe(true);expect(r.authorized).toBe(false);
 expect(r.destructive).toBe(true);
});
test('catalog permits only supported read-only operations when identity is trusted',()=>{
 const r=evaluateFlashCapability({operation:'detect',protocol:'samsung-download',model:'SM-A176U',
 trustedDeviceIdentity:true},BUILTIN_MANIFESTS['SM-A176U']);
 expect(r.authorized).toBe(true);expect(r.destructive).toBe(false);
});
test('untrusted read-only reports cannot claim verified identity',()=>{
 const r=evaluateFlashCapability({operation:'detect',protocol:'samsung-download',model:'SM-A176U'},
 BUILTIN_MANIFESTS['SM-A176U']);
 expect(r.authorized).toBe(false);
});

test('read-only operations require an explicitly qualified manifest state',()=>{
 for(const status of ['NOT_IMPLEMENTED','SIMULATED']){
  const r=evaluateFlashCapability(
   {operation:'detect',protocol:'samsung-download',model:'SM-A176U',trustedDeviceIdentity:true},
   {model:'SM-A176U',protocol:'samsung-download',status,operations:['detect']}
  );
  expect(r.authorized,status).toBe(false);
  expect(r.blockers,status).toContain('Read-only qualification absent');
 }
});
