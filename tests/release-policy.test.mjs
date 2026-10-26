import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = await mkdtemp(join(tmpdir(), 'bobfw-policy-'));
const input = join(dir, 'candidate.json');
const output = join(dir, 'result.json');
const base = {
  schema: 'com.bobbyblanco.bobfwtools.release-candidate.v1',
  source: { revision: 'a'.repeat(40) },
  provenance: { manifestSha256: 'b'.repeat(64), verified: true },
  sbom: { sha256: 'c'.repeat(64), verified: true },
  security: { dependencyAuditClean: true, malwareScanPassed: true, deviceWriteAuthorityGranted: false },
  platforms: {
    macos: { buildPassed: true, packageVerified: true, developerIdSigned: true, notarized: true },
    windows: { buildPassed: true, packageVerified: true, authenticodeSigned: true },
    linux: { buildPassed: true, packageVerified: true, packageSigned: true },
  },
  signatures: { awsKmsVerified: true, gcpKmsVerified: true },
  requestedChannel: 'stable',
  promotion: { canaryObserved: true, humanApproval: true, rebuildRequired: false, artifactDigestMatchesQualified: true },
};

async function run(candidate) {
  await writeFile(input, JSON.stringify(candidate));
  const p = spawnSync(process.execPath, ['scripts/release/evaluate-release-policy.mjs','--input',input,'--output',output], { encoding:'utf8' });
  return { p, result: JSON.parse(await readFile(output,'utf8')) };
}

let r = await run(base);
assert.equal(r.p.status, 0, r.p.stderr);
assert.equal(r.result.releaseEligible, true);
assert.equal(r.result.deviceWriteAuthorityGranted, false);

r = await run({ ...base, signatures: { ...base.signatures, gcpKmsVerified: false } });
assert.equal(r.p.status, 2);
assert.equal(r.result.releaseEligible, false);
assert.ok(r.result.reasons.some(x => x.includes('Google Cloud KMS')));

r = await run({ ...base, promotion: { ...base.promotion, rebuildRequired: true } });
assert.equal(r.p.status, 2);
assert.ok(r.result.reasons.some(x => x.includes('must not rebuild')));

r = await run({ ...base, security: { ...base.security, deviceWriteAuthorityGranted: true } });
assert.equal(r.p.status, 2);
assert.equal(r.result.deviceWriteAuthorityGranted, false);
assert.ok(r.result.reasons.some(x => x.includes('device-write')));

r = await run({ ...base, requestedChannel:'canary', promotion:{...base.promotion,humanApproval:false} });
assert.equal(r.p.status, 0, r.p.stderr);
assert.equal(r.result.releaseEligible, true);
console.log('release policy contract passed');
