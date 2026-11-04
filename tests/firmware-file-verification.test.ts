import {describe,it,expect} from 'vitest';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyFirmwareFile} from '../scripts/lib/verify-firmware-file.mjs';
describe('firmware file SHA-256 verifier',()=>{
 it('streams actual bytes and reports match without authorizing flashing',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'bobfwtools-'));
  try{
   const file=join(dir,'fixture.bin'),data=Buffer.from('firmware integrity fixture');
   await writeFile(file,data);
   const digest=createHash('sha256').update(data).digest('hex');
   const receipt=await verifyFirmwareFile(file,digest);
   expect(receipt.checksumMatched).toBe(true);
   expect(receipt.actualSha256).toBe(digest);
   expect(receipt.flashAuthorized).toBe(false);
   expect(receipt.oemSignatureVerified).toBe(false);
   expect((await verifyFirmwareFile(file,'0'.repeat(64))).checksumMatched).toBe(false);
   await expect(verifyFirmwareFile(file,'123')).rejects.toThrow();
   const alias=join(dir,'alias');await symlink(file,alias);
   await expect(verifyFirmwareFile(alias,digest)).rejects.toThrow();
  } finally {await rm(dir,{recursive:true,force:true});}
 });
});
