import {expect, test} from 'vitest';
import {mkdirSync, mkdtempSync, writeFileSync, rmSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildQualificationMatrix, matrixMarkdown} from '../scripts/lib/qualification-matrix.mjs';
import {reportQualificationFile} from '../scripts/qualification-matrix.mjs';
const now = Date.parse('2026-10-18T19:00:00Z');
const spec = {caseId:'read', model:'SM-TEST', deviceAlias:'bench-1', protocol:'adb',
 operation:'identity', scope:'hardware-read', sourceRevision:'a'.repeat(40)};
const receipt = {...spec, observedAt:new Date(now - 1000).toISOString(), status:'PASS', detail:'Read-only model observation',
 artifacts:[{path:'probe.json',sha256:'b'.repeat(64)}]};
const evaluate = (cases = [spec], receipts = [receipt], options = {}) =>
 buildQualificationMatrix(cases, receipts, {now,verifyArtifact:() => true,...options});
test('missing evidence stays NOT TESTED and simulated success cannot qualify hardware', () => {
 expect(evaluate([spec],[])[0].status).toBe('NOT TESTED');
 expect(evaluate([spec],[{...receipt,scope:'simulated'}])[0].status).toBe('NOT TESTED');
});
test.each(['model','deviceAlias','protocol','operation','sourceRevision'])('evidence cannot cross %s boundaries', key => {
 expect(evaluate([spec],[{...receipt,[key]:'other'}])[0].status).toBe('NOT TESTED');
});
test('current hashed observation may pass reporting but never authorize execution', () => {
 expect(evaluate()[0]).toMatchObject({status:'PASS',executionAuthorized:false});
 expect(evaluate([spec],[receipt],{verifyArtifact:undefined})[0].status).toBe('BLOCKED');
 expect(evaluate([spec],[receipt],{verifyArtifact:()=>'true'})[0].status).toBe('BLOCKED');
});
test.each(['2026-10-01T00:00:00Z','2026-10-19T00:00:00Z','invalid'])('stale, future or malformed evidence is blocked: %s', observedAt => {
 expect(evaluate([spec],[{...receipt,observedAt}])[0].status).toBe('BLOCKED');
});
test('latest failure supersedes earlier pass and tied failures remain visible', () => {
 const failure = {...receipt,status:'FAIL',detail:'Transport disconnected'};
 expect(evaluate([spec],[receipt,failure])[0].status).toBe('FAIL');
 expect(evaluate([spec],[failure,receipt])[0].status).toBe('FAIL');
 expect(evaluate([spec],[{...failure,observedAt:new Date(now).toISOString()},receipt])[0].status).toBe('FAIL');
});
test('model-specific exception blocks reporting even with a passing claimed receipt', () => {
 expect(evaluate([{...spec,exception:'Model has no qualified recovery path'}])[0]).toMatchObject({status:'BLOCKED'});
});
test('write report requires all separate control categories and never grants execution', () => {
 const write = {...spec,scope:'hardware-write',operation:'partition-flash'};
 const claimed = {...receipt,...write};
 expect(evaluate([write],[claimed])[0].status).toBe('BLOCKED');
 const controls = Object.fromEntries(['liveIdentity','trustedFirmware','firmwareCompatibility','recoveryReadiness',
 'deviceSpecificApproval','postWriteVerification'].map(key=>[key,[0]]));
 expect(evaluate([write],[{...claimed,controls}])[0]).toMatchObject({status:'PASS',executionAuthorized:false});
 expect(evaluate([write],[{...claimed,controls:{...controls,postWriteVerification:[10]}}])[0].status).toBe('BLOCKED');
});
test('malformed case, duplicate case ID and invalid lifetime are rejected', () => {
 expect(()=>evaluate([spec,spec])).toThrow();
 expect(()=>evaluate([{...spec,sourceRevision:'main'}])).toThrow();
 expect(()=>evaluate([spec],[receipt],{maxAgeMs:-1})).toThrow();
});
test('CLI verifies actual artifact bytes and refuses path traversal and symlinks outside ledger', () => {
 const parent = mkdtempSync(join(tmpdir(),'bobfw-matrix-'));
 try {
  const root = join(parent,'ledger');
  // Use a nested directory to exercise both realpath and digest validation.
  mkdirSync(root);
  writeFileSync(join(root,'probe.json'),'real probe');
  writeFileSync(join(parent,'outside.json'),'real probe');
  const digest = createHash('sha256').update('real probe').digest('hex');
  const file = join(root,'ledger.json');
  const run = path => {
   writeFileSync(file,JSON.stringify({cases:[spec],receipts:[{...receipt,artifacts:[{path,sha256:digest}]}]}));
   return reportQualificationFile(file,now).rows[0];
  };
  expect(run('probe.json').status).toBe('PASS');
  writeFileSync(join(root,'probe.json'),'tampered');
  expect(run('probe.json').status).toBe('BLOCKED');
  expect(run('../outside.json').status).toBe('BLOCKED');
  symlinkSync(join(parent,'outside.json'),join(root,'external.json'));
  expect(run('external.json').status).toBe('BLOCKED');
 } finally {rmSync(parent,{recursive:true,force:true});}
});
test('Markdown escapes device-controlled cells', () => {
 expect(matrixMarkdown([{...spec,status:'BLOCKED',reason:'bad|value\nline'}])).toContain('bad\\|value line');
});
