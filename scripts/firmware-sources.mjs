#!/usr/bin/env node
// Node 24+ read-only command. No firmware downloads, writes or device actions.
import { discoverOfficialFirmwareSources } from '../src/lib/oem-source-discovery.ts';

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) {
  process.stdout.write('Usage: node scripts/firmware-sources.mjs --manufacturer Google --model "Pixel 8" [--json]\n');
  process.exit(0);
}
function value(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index+1] : undefined;
}
const manufacturer = value('--manufacturer');
const model = value('--model');
if (!manufacturer || !model) {
  process.stderr.write('Exact manufacturer and model are required.\n');
  process.exit(2);
}
const matches = discoverOfficialFirmwareSources(manufacturer, model);
const output = {
  manufacturer, model,
  recordType: 'official-source-directory-only',
  firmwarePackagesVerified: 0,
  executable: false,
  sources: matches,
};
if (args.includes('--json')) process.stdout.write(JSON.stringify(output, null, 2)+'\n');
else {
  process.stdout.write('Official source directory only; no firmware package or device compatibility verified.\n');
  if (!matches.length) process.stdout.write('No supported official source adapter for this model.\n');
  for (const item of matches) process.stdout.write(item.sourceName+': '+item.sourceUrl+'\n');
}
