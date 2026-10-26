#!/usr/bin/env node
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SCHEMA = 'com.bobbyblanco.bobfwtools.release-attestation.v1';
const HEX64 = /^[a-f0-9]{64}$/;

function arg(name, required = false) {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (required && !value) throw new Error(`Missing --${name}`);
  return value;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function createAwsKmsAttestation({ manifestPath, signatureBase64, keyId, outputPath, createdAt }) {
  const manifestBytes = await readFile(resolve(manifestPath));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.schema !== 'com.bobbyblanco.bobfwtools.release-provenance.v1') throw new Error('Unsupported provenance manifest schema');
  if (!HEX64.test(manifest.manifestSha256 || '')) throw new Error('Manifest payload digest is missing or invalid');
  const signature = Buffer.from(signatureBase64.trim(), 'base64');
  if (signature.length < 64 || signature.length > 80) throw new Error('AWS KMS ECDSA signature is malformed');
  if (!keyId || !/^(?:arn:aws:kms:|alias\/)/.test(keyId)) throw new Error('AWS KMS key identity is missing or invalid');

  const receipt = {
    schema: SCHEMA,
    provider: 'aws-kms',
    manifest: {
      fileSha256: sha256(manifestBytes),
      manifestSha256: manifest.manifestSha256,
    },
    key: { id: keyId, algorithm: 'ECDSA_SHA_256' },
    signatureBase64: signature.toString('base64'),
    source: {
      repository: manifest.source?.repository || null,
      revision: manifest.source?.revision || null,
      ref: manifest.source?.ref || null,
      workflowRunId: manifest.source?.workflowRunId || null,
    },
    createdAt: createdAt || new Date().toISOString(),
    security: { deviceWriteAuthorityGranted: false, releasePromotionGranted: false },
  };
  await writeFile(resolve(outputPath), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

export async function verifyAwsKmsAttestation({ manifestPath, receiptPath, publicKeyPath }) {
  const manifestBytes = await readFile(resolve(manifestPath));
  const receipt = JSON.parse(await readFile(resolve(receiptPath), 'utf8'));
  if (receipt.schema !== SCHEMA || receipt.provider !== 'aws-kms') throw new Error('Unsupported attestation receipt');
  if (receipt.security?.deviceWriteAuthorityGranted !== false || receipt.security?.releasePromotionGranted !== false) {
    throw new Error('Attestation must not grant release or device-write authority');
  }
  if (receipt.manifest?.fileSha256 !== sha256(manifestBytes)) throw new Error('Manifest file digest mismatch');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (receipt.manifest?.manifestSha256 !== manifest.manifestSha256) throw new Error('Manifest payload digest mismatch');
  const publicKey = createPublicKey(await readFile(resolve(publicKeyPath), 'utf8'));
  const signature = Buffer.from(receipt.signatureBase64 || '', 'base64');
  if (!verifySignature('sha256', manifestBytes, publicKey, signature)) throw new Error('AWS KMS signature verification failed');
  return true;
}

async function main() {
  const command = process.argv[2];
  if (command === 'receipt') {
    const signatureBase64 = (await readFile(resolve(arg('signature', true)), 'utf8')).trim();
    const receipt = await createAwsKmsAttestation({
      manifestPath: arg('manifest', true),
      signatureBase64,
      keyId: arg('key-id', true),
      outputPath: arg('output', true),
    });
    console.log(JSON.stringify({ manifestSha256: receipt.manifest.manifestSha256, fileSha256: receipt.manifest.fileSha256 }));
    return;
  }
  if (command === 'verify') {
    await verifyAwsKmsAttestation({
      manifestPath: arg('manifest', true),
      receiptPath: arg('receipt', true),
      publicKeyPath: arg('public-key', true),
    });
    console.log('AWS KMS attestation verified');
    return;
  }
  throw new Error('Usage: aws-kms-attestation.mjs receipt|verify ...');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
