#!/usr/bin/env node
// Performs live HEAD requests to the two allowlisted official Pixel catalog pages.
// Does not download, parse, or certify any firmware release.
import { probeOfficialSources } from '../src/lib/oem-catalog-probe.ts';

const args = process.argv.slice(2);
const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
if (args.includes('--help')) {
  console.log('Usage: node scripts/probe-official-catalogs.mjs --manufacturer Google --model "Pixel 8" [--json]');
  process.exit(0);
}
const manufacturer = value('--manufacturer');
const model = value('--model');
if (!manufacturer || !model) {
  console.error('Manufacturer and exact model are required.');
  process.exitCode = 2;
} else {
  const probes = await probeOfficialSources(manufacturer, model);
  const report = {
    manufacturer, model,
    checkedAt: new Date().toISOString(),
    firmwarePackagesVerified: 0,
    authenticityCertified: false,
    probes,
  };
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    for (const probe of probes) console.log(probe.url + ': ' + (probe.reachable ? 'HTTP ' + probe.httpStatus : probe.error));
    if (!probes.length) console.log('No supported official catalog probe for this manufacturer/model.');
  }
  if (!probes.length || probes.some(probe => !probe.reachable)) process.exitCode = 1;
}
