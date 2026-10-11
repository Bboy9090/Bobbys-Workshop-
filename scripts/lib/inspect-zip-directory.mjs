import {open,lstat} from 'node:fs/promises';
/**
 * Read-only ZIP end-of-central-directory inspection. This is metadata validation,
 * not CRC, entry content, signature, or extraction verification.
 */
export async function inspectZipDirectory(path) {
 const st=await lstat(path);
 if(!st.isFile()||st.isSymbolicLink()) throw Error('Regular non-symlink archive required');
 if(st.size<22) return {directoryFound:false,reason:'File too short',flashAuthorized:false};
 const file=await open(path,'r');
 try {
  const count=Math.min(st.size,22+65535);
  const tail=Buffer.alloc(count);
  const {bytesRead}=await file.read(tail,0,count,st.size-count);
  if(bytesRead!==count) throw Error('Archive changed during inspection');
  for(let offset=count-22;offset>=0;offset--){
   if(tail.readUInt32LE(offset)!==0x06054b50) continue;
   const comment=tail.readUInt16LE(offset+20);
   if(offset+22+comment!==count) continue; // EOCD must terminate archive.
   const disk=tail.readUInt16LE(offset+4),directoryDisk=tail.readUInt16LE(offset+6);
   const diskEntries=tail.readUInt16LE(offset+8),totalEntries=tail.readUInt16LE(offset+10);
   const bytes=tail.readUInt32LE(offset+12),start=tail.readUInt32LE(offset+16);
   if(disk||directoryDisk||diskEntries!==totalEntries)
    return {directoryFound:false,reason:'Multi-disk ZIP unsupported',flashAuthorized:false};
   if(totalEntries===0xffff||bytes===0xffffffff||start===0xffffffff)
    return {directoryFound:false,reason:'ZIP64 requires separate validation',flashAuthorized:false};
   const footer=st.size-count+offset;
   if(start+bytes>footer) return {directoryFound:false,reason:'Central directory exceeds bounds',flashAuthorized:false};
   if(totalEntries===0 && (bytes!==0||start!==0))
    return {directoryFound:false,reason:'Inconsistent empty ZIP metadata',flashAuthorized:false};
   return {directoryFound:true,entryCountDeclared:totalEntries,directoryOffset:start,
    directorySize:bytes,structuralIntegrityVerified:false,oemSignatureVerified:false,flashAuthorized:false};
  }
  return {directoryFound:false,reason:'No terminal ZIP central-directory footer',flashAuthorized:false};
 } finally {await file.close();}
}
