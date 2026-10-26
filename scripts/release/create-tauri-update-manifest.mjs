#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function values(name) {
  const flag = `--${name}`;
  const out = [];
  for (let i = 0; i < process.argv.length; i += 1) if (process.argv[i] === flag && process.argv[i + 1]) out.push(process.argv[++i]);
  return out;
}
function one(name, required = false) {
  const list = values(name);
  if (list.length > 1) throw new Error(`Duplicate --${name}`);
  if (required && !list[0]) throw new Error(`Missing --${name}`);
  return list[0];
}
function validVersion(value) {
  return /^v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value || '');
}
function validTarget(value) {
  return /^(?:linux|darwin|windows)-(?:x86_64|aarch64|i686|armv7)$/.test(value || '');
}
function httpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Update URLs must use HTTPS');
  if (url.username || url.password) throw new Error('Update URLs must not contain credentials');
  return url.toString();
}

const version = one('version', true);
const output = resolve(one('output', true));
if (!validVersion(version)) throw new Error('Update version must be valid SemVer');
const pubDate = one('pub-date');
if (pubDate && Number.isNaN(Date.parse(pubDate))) throw new Error('pub-date must be RFC3339-compatible');
const notes = one('notes') || '';
const platformSpecs = values('platform');
if (!platformSpecs.length) throw new Error('At least one --platform is required');

const platforms = {};
for (const spec of platformSpecs) {
  const first = spec.indexOf(',');
  const second = spec.indexOf(',', first + 1);
  if (first < 1 || second < first + 2) throw new Error('Platform spec must be target,url,signature-file');
  const target = spec.slice(0, first);
  const url = spec.slice(first + 1, second);
  const signaturePath = spec.slice(second + 1);
  if (!validTarget(target)) throw new Error(`Unsupported update target: ${target}`);
  if (platforms[target]) throw new Error(`Duplicate update target: ${target}`);
  const signature = (await readFile(resolve(signaturePath), 'utf8')).trim();
  if (!signature || signature.length < 32 || /\s{2,}/.test(signature)) throw new Error(`Invalid updater signature for ${target}`);
  platforms[target] = { url: httpsUrl(url), signature };
}

const manifest = { version, notes, ...(pubDate ? { pub_date: new Date(pubDate).toISOString() } : {}), platforms };
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(output);
