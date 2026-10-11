#!/usr/bin/env node
// Read-only signature classification. Never extracts or authorizes flashing.
import { inspectFirmwareArchive } from './lib/inspect-firmware-archive.mjs';
import { inspectZipEntries } from './lib/inspect-zip-entries.mjs';
const args=process.argv.slice(2);
const i=args.indexOf('--file');
if(args.includes('--help')) {
 console.log('Usage: node scripts/inspect-firmware-archive.mjs --file /path/to/firmware.zip');
 process.exit(0);
}
try {
 if(i<0 || !args[i+1]) throw Error('Local archive path required');
 const signature=await inspectFirmwareArchive(args[i+1]);
 const entries=signature.format==='zip-local-header'||signature.format==='zip-empty-marker'
   ? await inspectZipEntries(args[i+1]) : {accepted:false,reason:'Not a supported ZIP archive'};
 const result={...signature,centralDirectory:entries,readOnly:true,flashAuthorized:false};
 console.log(JSON.stringify(result,null,2));
 process.exitCode=entries.accepted?0:3;
} catch(e) {
 console.error('Archive inspection refused: '+(e instanceof Error?e.message:String(e)));
 process.exitCode=2;
}
