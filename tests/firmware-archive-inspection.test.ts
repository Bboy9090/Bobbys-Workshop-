import {describe,it,expect} from 'vitest';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectFirmwareArchive} from '../scripts/lib/inspect-firmware-archive.mjs';
describe('firmware archive magic header inspector',()=>{
 it('identifies a ZIP marker without claiming structural or OEM verification',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'bobfw-archive-'));
  try{
   const file=join(dir,'fixture.zip');
   await writeFile(file,Buffer.from([0x50,0x4b,0x03,0x04,0,0,0,0]));
   const result=await inspectFirmwareArchive(file);
   expect(result.format).toBe('zip-local-header');
   expect(result.structuralIntegrityVerified).toBe(false);
   expect(result.flashAuthorized).toBe(false);
   const alias=join(dir,'alias.zip');
   await symlink(file,alias);
   await expect(inspectFirmwareArchive(alias)).rejects.toThrow('non-symlink');
   await writeFile(file,'not firmware');
   expect((await inspectFirmwareArchive(file)).format).toBe('unknown');
  } finally {await rm(dir,{recursive:true,force:true});}
 });
});