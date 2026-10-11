import {describe,it,expect} from 'vitest';
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
describe('Samsung diagnostic only invokes detect',()=>{
 it('requires opt-in and never permits arbitrary Heimdall actions',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'samsung-detect-'));
  try{
   const mock=join(dir,'heimdall');
   await writeFile(mock,'#!/bin/sh\nif [ "$1" = "detect" ]; then echo "Device detected"; exit 0; fi\nexit 7\n');
   await chmod(mock,0o755);
   const run=(a)=>spawnSync(process.execPath,['scripts/samsung-readonly-detect.mjs',...a],{encoding:'utf8'});
   const denied=run(['--heimdall',mock]);expect(denied.status).toBe(2);
   const allowed=run(['--heimdall',mock,'--confirm-readonly']);
   expect(allowed.status).toBe(0);
   const receipt=JSON.parse(allowed.stdout);
   expect(receipt.detected).toBe(true);expect(receipt.flashAuthorized).toBe(false);
   expect(run(['--heimdall',mock,'--confirm-readonly','flash']).status).toBe(2);
  }finally{await rm(dir,{recursive:true,force:true});}
 });
});