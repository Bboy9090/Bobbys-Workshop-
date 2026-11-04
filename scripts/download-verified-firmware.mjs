#!/usr/bin/env node
// Explicit opt-in. Downloads only from allowlisted OEM domains and never flashes.
import { downloadVerifiedFirmware } from './lib/download-verified-firmware.mjs';

const args = process.argv.slice(2);
const get = key => { const idx = args.indexOf(key); return idx >= 0 ? args[idx+1] : null; };
if (args.includes('--help')) {
  console.log('Usage: node scripts/download-verified-firmware.mjs --url HTTPS_OEM_PACKAGE_URL --file /path/to/output.zip --sha256 TRUSTED_64_HEX_SHA256 --accept-download');
  process.exit(0);
}
if (!args.includes('--accept-download')) {
  console.error('No download performed. Explicit --accept-download is required.');
  process.exitCode = 2;
} else {
  try {
    const result = await downloadVerifiedFirmware({
      url: get('--url'), destination: get('--file'), expectedSha256: get('--sha256')
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Download refused: ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 2;
  }
}
