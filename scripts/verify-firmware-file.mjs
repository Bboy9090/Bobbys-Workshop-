#!/usr/bin/env node
import { verifyFirmwareFile } from './lib/verify-firmware-file.mjs';
const args=process.argv.slice(2);
const get=(k)=>{const i=args.indexOf(k);return i>=0?args[i+1]:null};
if(args.includes('--help')) {
 console.log('Usage: node scripts/verify-firmware-file.mjs --file /path/to/firmware.zip --sha256 64_HEX_CHARS');
 process.exit(0);
}
try {
 const receipt=await verifyFirmwareFile(get('--file'),get('--sha256'));
 console.log(JSON.stringify(receipt,null,2));
 process.exitCode=receipt.checksumMatched?0:1;
} catch(e) {
 console.error('Verification refused: '+(e instanceof Error?e.message:String(e)));
 process.exitCode=2;
}
