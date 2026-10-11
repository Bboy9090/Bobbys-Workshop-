import {describe,it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectZipDirectory} from '../scripts/lib/inspect-zip-directory.mjs';
describe('bounded ZIP directory footer inspection',()=>{
 it('recognizes a valid empty ZIP EOCD without asserting package integrity',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'zipfooter-'));
  try{
   const file=join(dir,'empty.zip');
   const footer=Buffer.alloc(22);footer.writeUInt32LE(0x06054b50,0);
   await writeFile(file,footer);
   const r=await inspectZipDirectory(file);
   expect(r.directoryFound).toBe(true);
   expect(r.entryCountDeclared).toBe(0);
   expect(r.structuralIntegrityVerified).toBe(false);
   expect(r.flashAuthorized).toBe(false);
   footer.writeUInt32LE(999999,12);await writeFile(file,footer);
   expect((await inspectZipDirectory(file)).directoryFound).toBe(false);
   await writeFile(file,Buffer.from('PK\\x03\\x04fake'));
   expect((await inspectZipDirectory(file)).directoryFound).toBe(false);
  }finally{await rm(dir,{recursive:true,force:true});}
 });
});
