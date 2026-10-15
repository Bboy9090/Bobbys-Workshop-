import test from 'node:test';
import assert from 'node:assert/strict';
import { qualifyA176U } from '../scripts/a176u-qualification.mjs';

test('reported suffix U is never considered device verified', () => {
  const r = qualifyA176U({model:'SM-A176U',source:'user-reported'});
  assert.equal(r.deviceIdentityVerified,false);
  assert.equal(r.flashAuthorized,false);
});
test('verified model and plausible build still cannot authorize flash', () => {
  const r = qualifyA176U({model:'SM-A176U',build:'A176USQS1AYK2',csc:'TMB',source:'device-readonly'});
  assert.equal(r.deviceIdentityVerified,true);
  assert.equal(r.installedBuildObserved,true);
  assert.equal(r.activeCscObserved,true);
  assert.equal(r.flashAuthorized,false);
  assert.ok(r.blockers.some(x=>x.includes('firmware package')));
});
test('international variants cannot inherit US authorization', () => {
  for (const model of ['SM-A176B','SM-A176U1','SM-A175U','']) {
    const r = qualifyA176U({model,source:'device-readonly'});
    assert.equal(r.deviceIdentityVerified,false);
    assert.equal(r.partitionsWritable,false);
  }
});
test('unknown build and CSC are reported as blockers', () => {
  const r = qualifyA176U({model:'SM-A176U',source:'device-readonly'});
  assert.equal(r.installedBuildObserved,false);
  assert.equal(r.activeCscObserved,false);
  assert.ok(r.blockers.some(x=>x.includes('installed build')));
});
test('invalid model and malformed identifiers do not authorize any action', () => {
  const r = qualifyA176U({model:'SM-A176U; fastboot flash',build:'x',csc:'INVALID',source:'device-readonly'});
  assert.equal(r.flashAuthorized,false);
  assert.equal(r.bootloaderUnlockAuthorized,false);
  assert.equal(r.deviceIdentityVerified,false);
});
