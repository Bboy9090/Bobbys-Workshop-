#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

function arg(name, required = false) {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (required && !value) throw new Error(`Missing --${name}`);
  return value;
}

const policy = JSON.parse(await readFile(resolve(arg('policy', true)), 'utf8'));
const candidate = JSON.parse(await readFile(resolve(arg('candidate', true)), 'utf8'));
const channel = arg('channel', true);
const sourceBucket = arg('source-bucket', true);
const sourceKey = arg('source-key', true);
const releaseBucket = arg('release-bucket', true);
const output = resolve(arg('output', true));

if (policy.schema !== 'com.bobbyblanco.bobfwtools.release-policy-result.v1') throw new Error('Unsupported release-policy result');
if (policy.releaseEligible !== true) throw new Error('Release policy did not authorize promotion');
if (policy.deviceWriteAuthorityGranted !== false) throw new Error('Release policy must not grant device-write authority');
if (policy.requestedChannel !== channel) throw new Error('Policy channel does not match requested channel');
if (!['canary', 'qualified', 'stable'].includes(channel)) throw new Error('Only canary, qualified, or stable promotion is supported');
if (candidate.schema !== 'com.bobbyblanco.bobfwtools.release-candidate.v1') throw new Error('Unsupported release candidate');
if (candidate.requestedChannel !== channel) throw new Error('Candidate channel does not match requested channel');
if (candidate.security?.deviceWriteAuthorityGranted !== false) throw new Error('Candidate must explicitly deny device-write authority');
if (candidate.promotion?.rebuildRequired === true) throw new Error('Promotion cannot rebuild the artifact');
if (candidate.promotion?.artifactDigestMatchesQualified !== true) throw new Error('Candidate artifact is not bound to the qualified digest');
const digest = candidate.artifact?.sha256;
if (!/^[a-f0-9]{64}$/.test(digest || '')) throw new Error('Candidate artifact SHA-256 is missing or invalid');
const revision = candidate.source?.revision;
if (!/^[a-f0-9]{40}$/.test(revision || '')) throw new Error('Candidate source revision is missing or invalid');
const artifactName = basename(candidate.artifact?.name || '');
if (!artifactName || artifactName === '.' || artifactName === '..') throw new Error('Candidate artifact name is invalid');

const plan = {
  schema: 'com.bobbyblanco.bobfwtools.release-promotion-plan.v1',
  channel,
  source: { bucket: sourceBucket, key: sourceKey },
  destination: { bucket: releaseBucket, key: `${channel}/${revision}/${artifactName}` },
  artifact: { name: artifactName, sha256: digest },
  sourceRevision: revision,
  rebuildAllowed: false,
  deviceWriteAuthorityGranted: false,
};
await writeFile(output, `${JSON.stringify(plan, null, 2)}\n`);
console.log(output);
