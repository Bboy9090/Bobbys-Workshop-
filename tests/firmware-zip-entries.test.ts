import {describe,it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectZipEntries} from '../scripts/lib/inspect-zip-entries.mjs';
function zip(name='payload.bin',method=0){
 const filename=Buffer.from(name),local=Buffer.alloc(30+filename.length),central=Buffer.alloc(46+filename.length),footer=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(filename.length,26);filename.copy(local,30);
 central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(method,10);
 central.writeUInt16LE(filename.length,28);filename.copy(central,46);
 footer.writeUInt32LE(0x06054b50,0);footer.writeUInt16LE(1,8);footer.writeUInt16LE(1,10);
 footer.writeUInt32LE(central.length,12);footer.writeUInt32LE(local.length,16);
 return Buffer.concat([local,central,footer]);
}
describe('ZIP central entry metadata inspection',()=>{
 it('inspects a bounded synthetic entry but never asserts signature trust',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zipentries-'));
  try{
   const path=join(dir,'fixture.zip');await writeFile(path,zip());
   const r=await inspectZipEntries(path);
   expect(r.accepted).toBe(true);expect(r.entryPayloadVerified).toBe(false);
   expect(r.flashAuthorized).toBe(false);
   for(const name of ['../escape.bin','/root.bin','folder/../escape.bin','C:drive.bin']){
    await writeFile(path,zip(name));
    expect((await inspectZipEntries(path)).accepted).toBe(false);
   }
   await writeFile(path,zip('payload.bin',99));
   expect((await inspectZipEntries(path)).accepted).toBe(false);
  }finally{await rm(dir,{recursive:true,force:true});}
 });
});
