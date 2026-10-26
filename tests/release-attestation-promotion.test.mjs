import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAwsKmsAttestation, verifyAwsKmsAttestation } from '../scripts/release/aws-kms-attestation.mjs';

const dir = await mkdtemp(join(tmpdir(), 'bobfw-attest-'));
const manifestPath = join(dir, 'provenance.json');
const receiptPath = join(dir, 'aws.json');
const publicKeyPath = join(dir, 'public.pem');
const manifest = {
  schema: 'com.bobbyblanco.bobfwtools.release-provenance.v1',
  manifestSha256: 'a'.repeat(64),
  source: { repository: 'Bboy9090/Bobbys-Workshop-', revision: 'b'.repeat(40), ref: 'refs/heads/release', workflowRunId: '123' },
};
await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
const bytes = await readFile(manifestPath);
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const signature = sign('sha256', bytes, privateKey);
await writeFile(publicKeyPath, publicKey.export({ type: 'spki', format: 'pem' }));
await createAwsKmsAttestation({
  manifestPath,
  signatureBase64: signature.toString('base64'),
  keyId: 'alias/bobfwtools-release-signing',
  outputPath: receiptPath,
  createdAt: '2026-10-26T00:00:00.000Z',
});
assert.equal(await verifyAwsKmsAttestation({ manifestPath, receiptPath, publicKeyPath }), true);
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
assert.equal(receipt.security.deviceWriteAuthorityGranted, false);
assert.equal(receipt.security.releasePromotionGranted, false);
await writeFile(manifestPath, `${JSON.stringify({ ...manifest, source: { ...manifest.source, revision: 'c'.repeat(40) } })}\n`);
await assert.rejects(() => verifyAwsKmsAttestation({ manifestPath, receiptPath, publicKeyPath }), /digest mismatch/);
console.log('release attestation contract passed');

import { spawnSync } from 'node:child_process';
const candidatePath = join(dir, 'candidate.json');
const policyPath = join(dir, 'policy.json');
const planPath = join(dir, 'plan.json');
const candidate = {
  schema: 'com.bobbyblanco.bobfwtools.release-candidate.v1',
  requestedChannel: 'canary',
  source: { revision: 'd'.repeat(40) },
  artifact: { name: 'BobFWTools.dmg', sha256: 'e'.repeat(64) },
  security: { deviceWriteAuthorityGranted: false },
  promotion: { rebuildRequired: false, artifactDigestMatchesQualified: true },
};
const policy = {
  schema: 'com.bobbyblanco.bobfwtools.release-policy-result.v1',
  requestedChannel: 'canary',
  releaseEligible: true,
  deviceWriteAuthorityGranted: false,
  reasons: [],
};
await writeFile(candidatePath, `${JSON.stringify(candidate)}\n`);
await writeFile(policyPath, `${JSON.stringify(policy)}\n`);
const promote = spawnSync(process.execPath, [
  'scripts/release/create-promotion-plan.mjs',
  '--policy', policyPath,
  '--candidate', candidatePath,
  '--channel', 'canary',
  '--source-bucket', 'evidence',
  '--source-key', 'candidate/BobFWTools.dmg',
  '--release-bucket', 'downloads',
  '--output', planPath,
], { cwd: process.cwd(), encoding: 'utf8' });
assert.equal(promote.status, 0, promote.stderr);
const plan = JSON.parse(await readFile(planPath, 'utf8'));
assert.equal(plan.destination.key, `canary/${'d'.repeat(40)}/BobFWTools.dmg`);
assert.equal(plan.artifact.sha256, 'e'.repeat(64));
assert.equal(plan.rebuildAllowed, false);
assert.equal(plan.deviceWriteAuthorityGranted, false);

await writeFile(policyPath, `${JSON.stringify({ ...policy, releaseEligible: false })}\n`);
const rejected = spawnSync(process.execPath, [
  'scripts/release/create-promotion-plan.mjs',
  '--policy', policyPath,
  '--candidate', candidatePath,
  '--channel', 'canary',
  '--source-bucket', 'evidence',
  '--source-key', 'candidate/BobFWTools.dmg',
  '--release-bucket', 'downloads',
  '--output', planPath,
], { cwd: process.cwd(), encoding: 'utf8' });
assert.notEqual(rejected.status, 0);
assert.match(rejected.stderr, /did not authorize promotion/);
console.log('release promotion contract passed');
