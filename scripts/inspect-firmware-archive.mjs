#!/usr/bin/env node
// Read-only signature classification. Never extracts or authorizes flashing.
import { inspectFirmwareArchive } from './lib/inspect-firmware-archive.mjs';
const args=process.argv.slice(2);
const i=args.indexOf('--file');
if(args.includes('--help')) {
 console.log('Usage: node scripts/inspect-firmware-archive.mjs --file /path/to/firmware.zip');
 process.exit(0);
}
try {
 if(i<0 || !args[i+1]) throw Error('Local archive path required');
 const result=await inspectFirmwareArchive(args[i+1]);
 console.log(JSON.stringify(result,null,2));
 process.exitCode=result.format==='unknown'?3:0;
} catch(e) {
 console.error('Archive inspection refused: '+(e instanceof Error?e.message:String(e)));
 process.exitCode=2;
}
