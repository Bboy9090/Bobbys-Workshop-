import { test, expect } from 'vitest';
import { qualifyA176U } from '../scripts/a176u-qualification.mjs';

test('reported suffix U is never considered device verified', () => {
  const r = qualifyA176U({model:'SM-A176U',source:'user-reported'});
  expect(r.deviceIdentityVerified).toBe(false);
  expect(r.flashAuthorized).toBe(false);
});
test('claimed device model and plausible build still cannot authorize flash', () => {
  const r = qualifyA176U({model:'SM-A176U',build:'A176USQS1AYK2',csc:'TMB',source:'device-readonly'});
  expect(r.deviceIdentityVerified).toBe(false);
  expect(r.installedBuildObserved).toBe(true);
  expect(r.activeCscObserved).toBe(true);
  expect(r.flashAuthorized).toBe(false);
  expect(r.blockers.some(x=>x.includes('firmware package'))).toBe(true);
});
test('international variants cannot inherit US authorization', () => {
  for (const model of ['SM-A176B','SM-A176U1','SM-A175U','']) {
    const r = qualifyA176U({model,source:'device-readonly'});
    expect(r.deviceIdentityVerified).toBe(false);
    expect(r.partitionsWritable).toBe(false);
  }
});
test('unknown build and CSC are reported as blockers', () => {
  const r = qualifyA176U({model:'SM-A176U',source:'device-readonly'});
  expect(r.installedBuildObserved).toBe(false);
  expect(r.activeCscObserved).toBe(false);
  expect(r.blockers.some(x=>x.includes('installed build'))).toBe(true);
});
test('malformed identifiers never authorize an action', () => {
  const r = qualifyA176U({model:'SM-A176U; fastboot flash',build:'x',csc:'INVALID',source:'device-readonly'});
  expect(r.flashAuthorized).toBe(false);
  expect(r.bootloaderUnlockAuthorized).toBe(false);
  expect(r.deviceIdentityVerified).toBe(false);
});

test('untrusted device-readonly source label cannot attest model identity', () => {
  const r = qualifyA176U({model:'SM-A176U',source:'device-readonly'});
  expect(r.identitySource).toBe('unattested-device-claim');
  expect(r.deviceIdentityVerified).toBe(false);
  expect(r.flashAuthorized).toBe(false);
});
