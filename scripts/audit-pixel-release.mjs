#!/usr/bin/env node
/**
 * Read-only audit of manually supplied Pixel metadata; never executes a firmware download.
 * Inputs are untrusted and cannot prove OEM origin merely by including an official URL.
 */
import { readFile } from 'node:fs/promises';
import { auditPixelFirmwareRelease } from '../src/lib/pixel-release-audit.ts';

const args=process.argv.slice(2);
const option=(key)=>{const i=args.indexOf(key);return i>=0?args[i+1]:null;};
if(args.includes('--help')){
 console.log('Usage: node scripts/audit-pixel-release.mjs --record release.json --codename shiba [--reference-sha256 HEX]');
 process.exit(0);
}
try {
 const path=option('--record'),codename=option('--codename');
 if(!path||!codename) throw Error('Release JSON file and exact device codename required');
 const text=await readFile(path,'utf8');
 if(Buffer.byteLength(text)>1024*1024) throw Error('Metadata exceeds one MiB limit');
 const input=JSON.parse(text);
 const audit=auditPixelFirmwareRelease(input,codename,option('--reference-sha256'));
 console.log(JSON.stringify(audit,null,2));
 process.exitCode=3; // audited but blocked; NEVER a readiness success
} catch(error) {
 console.error('Release audit refused: '+(error instanceof Error?error.message:String(error)));
 process.exitCode=2;
}
