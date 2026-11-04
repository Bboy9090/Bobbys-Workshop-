#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { readFile, stat, writeFile } from 'node:fs/promises';

function arg(name, required = false) {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (required && !value) throw new Error(`Missing --${name}`);
  return value;
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const artifactPath = resolve(arg('artifact', true));
const outputPath = resolve(arg('output', true));
const sbomArg = arg('sbom');
const sbomPath = sbomArg ? resolve(sbomArg) : null;
const artifactStat = await stat(artifactPath);
if (!artifactStat.isFile()) throw new Error('Artifact must be a regular file');

const payload = {
  schema: 'com.bobbyblanco.bobfwtools.release-provenance.v1',
  artifact: {
    name: basename(artifactPath),
    bytes: artifactStat.size,
    sha256: await sha256(artifactPath),
  },
  source: {
    repository: process.env.GITHUB_REPOSITORY || arg('repository') || 'unknown',
    revision: process.env.GITHUB_SHA || arg('revision') || 'unknown',
    ref: process.env.GITHUB_REF || arg('ref') || 'unknown',
    workflowRunId: process.env.GITHUB_RUN_ID || arg('run-id') || null,
  },
  build: {
    platform: arg('platform') || process.platform,
    createdAt: arg('created-at') || new Date().toISOString(),
  },
  security: {
    deviceWriteAuthorityGranted: false,
    releasePromotionGranted: false,
  },
};

if (sbomPath) {
  const sbomStat = await stat(sbomPath);
  if (!sbomStat.isFile()) throw new Error('SBOM must be a regular file');
  payload.sbom = {
    name: basename(sbomPath),
    bytes: sbomStat.size,
    sha256: await sha256(sbomPath),
  };
}

const manifest = {
  ...payload,
  manifestSha256: createHash('sha256').update(canonical(payload)).digest('hex'),
};
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(outputPath);
