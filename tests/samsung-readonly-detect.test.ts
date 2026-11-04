import {describe,it,expect} from 'vitest';
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

describe('Samsung read-only qualification helper',()=>{
 it('treats detect as attachment only and requires PIT proof for Download Mode qualification',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'samsung-detect-'));
  try{
   const mock=join(dir,'heimdall');
   await writeFile(mock,`#!/bin/sh
if [ "$1" = "detect" ]; then echo "Device detected"; exit 0; fi
if [ "$1" = "print-pit" ]; then echo "PIT Partition Name: BOOT"; exit 0; fi
exit 7
`);
   await chmod(mock,0o755);
   const run=(a)=>spawnSync(process.execPath,['scripts/samsung-readonly-detect.mjs',...a],{encoding:'utf8'});

   const denied=run(['--heimdall',mock]);
   expect(denied.status).toBe(2);

   const detectedOnly=run(['--heimdall',mock,'--confirm-readonly']);
   expect(detectedOnly.status).toBe(0);
   const detectionReceipt=JSON.parse(detectedOnly.stdout);
   expect(detectionReceipt.detected).toBe(true);
   expect(detectionReceipt.transportCandidate).toBe('samsung-usb');
   expect(detectionReceipt.downloadModeQualified).toBe(false);
   expect(detectionReceipt.protocolSessionVerified).toBe(false);
   expect(detectionReceipt.flashAuthorized).toBe(false);

   const qualified=run(['--heimdall',mock,'--confirm-readonly','--verify-protocol']);
   expect(qualified.status).toBe(0);
   const qualificationReceipt=JSON.parse(qualified.stdout);
   expect(qualificationReceipt.protocolSessionVerified).toBe(true);
   expect(qualificationReceipt.downloadModeQualified).toBe(true);
   expect(qualificationReceipt.pitDownloaded).toBe(true);
   expect(qualificationReceipt.flashAuthorized).toBe(false);
   expect(qualificationReceipt.frpStateChanged).toBe(false);
   expect(qualificationReceipt.oemLockStateChanged).toBe(false);
   expect(qualificationReceipt.kgStateChanged).toBe(false);

   expect(run(['--heimdall',mock,'--confirm-readonly','flash']).status).toBe(2);
   expect(run(['--heimdall',mock,'--confirm-readonly','--repartition']).status).toBe(2);
  }finally{
   await rm(dir,{recursive:true,force:true});
  }
 });

 it('fails closed when PIT handshake does not complete',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'samsung-detect-fail-'));
  try{
   const mock=join(dir,'heimdall');
   await writeFile(mock,`#!/bin/sh
if [ "$1" = "detect" ]; then echo "Device detected"; exit 0; fi
if [ "$1" = "print-pit" ]; then echo "ERROR: protocol timeout" >&2; exit 7; fi
exit 7
`);
   await chmod(mock,0o755);
   const run=spawnSync(process.execPath,[
     'scripts/samsung-readonly-detect.mjs',
     '--heimdall',mock,
     '--confirm-readonly',
     '--verify-protocol',
   ],{encoding:'utf8'});
   expect(run.status).toBe(4);
   const receipt=JSON.parse(run.stdout);
   expect(receipt.detected).toBe(true);
   expect(receipt.protocolSessionVerified).toBe(false);
   expect(receipt.downloadModeQualified).toBe(false);
   expect(receipt.flashAuthorized).toBe(false);
  }finally{
   await rm(dir,{recursive:true,force:true});
  }
 });
});
