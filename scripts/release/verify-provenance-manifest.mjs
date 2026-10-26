#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { readFile, stat } from 'node:fs/promises';

function arg(name, required = false) {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (required && !value) throw new Error(`Missing --${name}`);
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function verifyFile(path, record, label) {
  const info = await stat(path);
  const digest = createHash('sha256').update(await readFile(path)).digest('hex');
  if (!info.isFile() || basename(path) !== record.name || info.size !== record.bytes || digest !== record.sha256) {
    throw new Error(`${label} does not match provenance manifest`);
  }
}

const manifestPath = resolve(arg('manifest', true));
const artifactPath = resolve(arg('artifact', true));
const sbomArg = arg('sbom');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.schema !== 'com.bobbyblanco.bobfwtools.release-provenance.v1') throw new Error('Unsupported provenance schema');
if (manifest.security?.deviceWriteAuthorityGranted !== false || manifest.security?.releasePromotionGranted !== false) {
  throw new Error('Unsigned provenance must never grant device-write or release-promotion authority');
}
const { manifestSha256, ...payload } = manifest;
const expected = createHash('sha256').update(canonical(payload)).digest('hex');
if (manifestSha256 !== expected) throw new Error('Provenance manifest digest mismatch');
await verifyFile(artifactPath, manifest.artifact, 'Artifact');
if (manifest.sbom) {
  if (!sbomArg) throw new Error('Manifest requires --sbom');
  await verifyFile(resolve(sbomArg), manifest.sbom, 'SBOM');
}
console.log(`verified ${manifest.artifact.name} ${manifest.artifact.sha256}`);
