import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = await mkdtemp(join(tmpdir(), 'bobfw-provenance-'));
const artifact = join(dir, 'BobFWTools-test.bin');
const sbom = join(dir, 'BobFWTools.sbom.json');
const manifest = join(dir, 'provenance.json');
await writeFile(artifact, 'qualified-artifact-fixture\n');
await writeFile(sbom, '{"bomFormat":"CycloneDX","specVersion":"1.6"}\n');

const create = spawnSync(process.execPath, [
  'scripts/release/create-provenance-manifest.mjs', '--artifact', artifact, '--sbom', sbom,
  '--output', manifest, '--repository', 'Bboy9090/Bobbys-Workshop-', '--revision', 'a'.repeat(40),
  '--ref', 'refs/heads/test', '--run-id', '42', '--platform', 'test', '--created-at', '2026-10-26T00:00:00.000Z',
], { encoding: 'utf8' });
assert.equal(create.status, 0, create.stderr);

const verify = spawnSync(process.execPath, [
  'scripts/release/verify-provenance-manifest.mjs', '--manifest', manifest, '--artifact', artifact, '--sbom', sbom,
], { encoding: 'utf8' });
assert.equal(verify.status, 0, verify.stderr);

const parsed = JSON.parse(await readFile(manifest, 'utf8'));
assert.equal(parsed.schema, 'com.bobbyblanco.bobfwtools.release-provenance.v1');
assert.equal(parsed.security.deviceWriteAuthorityGranted, false);
assert.equal(parsed.security.releasePromotionGranted, false);
assert.match(parsed.artifact.sha256, /^[a-f0-9]{64}$/);
assert.match(parsed.sbom.sha256, /^[a-f0-9]{64}$/);
assert.match(parsed.manifestSha256, /^[a-f0-9]{64}$/);

await writeFile(artifact, 'tampered\n');
const tampered = spawnSync(process.execPath, [
  'scripts/release/verify-provenance-manifest.mjs', '--manifest', manifest, '--artifact', artifact, '--sbom', sbom,
], { encoding: 'utf8' });
assert.notEqual(tampered.status, 0);
assert.match(tampered.stderr, /does not match provenance manifest/);
console.log('release provenance contract passed');
