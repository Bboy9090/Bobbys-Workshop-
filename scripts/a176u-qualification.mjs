#!/usr/bin/env node
/** Read-only A17 5G (SM-A176U) qualification report. Never invokes tools or writes to a device. */
import { readFileSync } from 'node:fs';

export function qualifyA176U(evidence = {}) {
  const model = typeof evidence.model === 'string' ? evidence.model.trim().toUpperCase() : '';
  const build = typeof evidence.build === 'string' ? evidence.build.trim().toUpperCase() : '';
  const csc = typeof evidence.csc === 'string' ? evidence.csc.trim().toUpperCase() : '';
  const source = evidence.source === 'device-readonly' ? 'unattested-device-claim' : 'user-reported';
  // JSON evidence is caller-controlled; only a trusted probe integration may attest hardware.
  const modelVerified = false;
  const buildObserved = /^A176U[A-Z0-9]{5,32}$/.test(build);
  const cscObserved = /^[A-Z0-9]{3}$/.test(csc);
  const blockers = [];
  if (model !== 'SM-A176U') blockers.push('Exact SM-A176U identity not established');
  if (!modelVerified) blockers.push('Device identity not attested by a trusted read-only probe');
  if (!buildObserved) blockers.push('Exact installed build is missing or has invalid format');
  if (!cscObserved) blockers.push('Exact active CSC has not been supplied');
  blockers.push('Official firmware package, binary revision and regional compatibility not verified');
  blockers.push('Supported Download Mode servicing path and physical recovery tests not qualified');
  return {
    schema: 'bobfwtools.samsung.a176u.readiness.v1',
    targetFamily: 'Galaxy A17 5G',
    expectedModel: 'SM-A176U',
    observedModel: model || null,
    identitySource: source,
    deviceIdentityVerified: modelVerified,
    installedBuildObserved: buildObserved,
    activeCscObserved: cscObserved,
    diagnosticsOnly: true,
    flashAuthorized: false,
    bootloaderUnlockAuthorized: false,
    partitionsWritable: false,
    blockers,
  };
}

if (import.meta.main === true) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node scripts/a176u-qualification.mjs --evidence /path/to/read-only-evidence.json');
  } else {
    try {
      const i = args.indexOf('--evidence');
      if (i < 0 || !args[i + 1] || args.length !== 2)
        throw new Error('Only --evidence /path/to/read-only-evidence.json is accepted');
      const evidence = JSON.parse(readFileSync(args[i + 1], 'utf8'));
      console.log(JSON.stringify(qualifyA176U(evidence), null, 2));
    } catch (error) {
      console.error('Qualification refused: ' + error.message);
      process.exitCode = 2;
    }
  }
}
