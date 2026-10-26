#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function arg(name, required = false) {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (required && !value) throw new Error(`Missing --${name}`);
  return value;
}

const input = JSON.parse(await readFile(resolve(arg('input', true)), 'utf8'));
const output = resolve(arg('output', true));
const reasons = [];
const hex64 = /^[a-f0-9]{64}$/;
const sha40 = /^[a-f0-9]{40}$/;

if (input.schema !== 'com.bobbyblanco.bobfwtools.release-candidate.v1') reasons.push('unsupported candidate schema');
if (!sha40.test(input.source?.revision || '')) reasons.push('source revision is missing or invalid');
if (!hex64.test(input.provenance?.manifestSha256 || '')) reasons.push('provenance manifest digest is missing or invalid');
if (input.provenance?.verified !== true) reasons.push('provenance manifest is not verified');
if (!hex64.test(input.sbom?.sha256 || '')) reasons.push('SBOM digest is missing or invalid');
if (input.sbom?.verified !== true) reasons.push('SBOM is not verified');
if (input.security?.dependencyAuditClean !== true) reasons.push('dependency audit is not clean');
if (input.security?.malwareScanPassed !== true) reasons.push('malware scan is not proven');
if (input.security?.deviceWriteAuthorityGranted !== false) reasons.push('release candidate must not grant device-write authority');

const requiredPlatforms = ['macos', 'windows', 'linux'];
for (const platform of requiredPlatforms) {
  const gate = input.platforms?.[platform];
  if (!gate?.buildPassed) reasons.push(`${platform} build is not proven`);
  if (!gate?.packageVerified) reasons.push(`${platform} package verification is not proven`);
}
if (input.platforms?.macos?.developerIdSigned !== true) reasons.push('macOS Developer ID signature is not proven');
if (input.platforms?.macos?.notarized !== true) reasons.push('macOS notarization is not proven');
if (input.platforms?.windows?.authenticodeSigned !== true) reasons.push('Windows Authenticode signature is not proven');
if (input.platforms?.linux?.packageSigned !== true) reasons.push('Linux package signature is not proven');

const signatures = input.signatures || {};
if (signatures.awsKmsVerified !== true) reasons.push('AWS KMS provenance signature is not verified');
if (signatures.gcpKmsVerified !== true) reasons.push('Google Cloud KMS provenance signature is not verified');

const channel = input.requestedChannel;
if (!['dev', 'canary', 'qualified', 'stable'].includes(channel)) reasons.push('requested release channel is invalid');
if (channel === 'stable' && input.promotion?.canaryObserved !== true) reasons.push('stable promotion requires canary observation');
if (['qualified', 'stable'].includes(channel) && input.promotion?.humanApproval !== true) reasons.push(`${channel} promotion requires explicit human approval`);
if (input.promotion?.rebuildRequired === true) reasons.push('promotion must reuse the qualified artifact and must not rebuild');
if (input.promotion?.artifactDigestMatchesQualified !== true) reasons.push('artifact digest does not match the qualified artifact');

const result = {
  schema: 'com.bobbyblanco.bobfwtools.release-policy-result.v1',
  requestedChannel: channel || null,
  releaseEligible: reasons.length === 0,
  deviceWriteAuthorityGranted: false,
  reasons,
};
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
if (reasons.length) {
  console.error(reasons.join('\n'));
  process.exitCode = 2;
} else {
  console.log(`release eligible for ${channel}`);
}
