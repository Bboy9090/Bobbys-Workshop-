import {open,lstat} from 'node:fs/promises';
import {inspectZipDirectory} from './inspect-zip-directory.mjs';
const MAX_ENTRIES=10000;
const MAX_DIRECTORY_BYTES=32*1024*1024;
function unsafeName(name) {
 return !name || name.startsWith('/') || name.includes('\\') || name.includes('\\0') ||
   /^[a-zA-Z]:/.test(name) || name.split('/').some(s=>s==='..'||s==='.') ||
   name.includes('//');
}
/** Reads ZIP central-directory metadata only; no extraction or data CRC validation. */
export async function inspectZipEntries(path) {
 const footer=await inspectZipDirectory(path);
 if(!footer.directoryFound) return {accepted:false,reason:footer.reason,flashAuthorized:false};
 if(footer.entryCountDeclared>MAX_ENTRIES||footer.directorySize>MAX_DIRECTORY_BYTES)
  return {accepted:false,reason:'ZIP directory resource limit exceeded',flashAuthorized:false};
 const st=await lstat(path);
 if(!st.isFile()||st.isSymbolicLink()) throw Error('Archive is not a regular file');
 const file=await open(path,'r');
 try {
  const buffer=Buffer.alloc(footer.directorySize);
  const {bytesRead}=await file.read(buffer,0,buffer.length,footer.directoryOffset);
  if(bytesRead!==buffer.length) return {accepted:false,reason:'Truncated ZIP directory',flashAuthorized:false};
  let cursor=0;
  const names=new Set();
  for(let i=0;i<footer.entryCountDeclared;i++){
   if(cursor+46>buffer.length||buffer.readUInt32LE(cursor)!==0x02014b50)
    return {accepted:false,reason:'Malformed central directory entry',flashAuthorized:false};
   const method=buffer.readUInt16LE(cursor+10);
   const packed=buffer.readUInt32LE(cursor+20),unpacked=buffer.readUInt32LE(cursor+24);
   const nameLen=buffer.readUInt16LE(cursor+28),extraLen=buffer.readUInt16LE(cursor+30),
    commentLen=buffer.readUInt16LE(cursor+32),disk=buffer.readUInt16LE(cursor+34);
   const localOffset=buffer.readUInt32LE(cursor+42);
   const end=cursor+46+nameLen+extraLen+commentLen;
   if(end>buffer.length||disk!==0||localOffset>=footer.directoryOffset||
      [packed,unpacked,localOffset].includes(0xffffffff))
    return {accepted:false,reason:'ZIP entry bounds or unsupported ZIP64',flashAuthorized:false};
   const raw=buffer.subarray(cursor+46,cursor+46+nameLen);
   const name=new TextDecoder('utf-8',{fatal:true}).decode(raw);
   if(unsafeName(name)||names.has(name))
    return {accepted:false,reason:'Unsafe or duplicate archive path',flashAuthorized:false};
   names.add(name);
   if(method!==0&&method!==8)
    return {accepted:false,reason:'Unsupported compression method',flashAuthorized:false};
   cursor=end;
  }
  if(cursor!==buffer.length) return {accepted:false,reason:'Central directory trailing bytes',flashAuthorized:false};
  return {accepted:true,entries:footer.entryCountDeclared,metadataOnly:true,
    entryPayloadVerified:false,structuralIntegrityVerified:false,oemSignatureVerified:false,flashAuthorized:false};
 }catch(e){
  if(e instanceof TypeError) return {accepted:false,reason:'Invalid filename encoding',flashAuthorized:false};
  throw e;
 }finally{await file.close();}
}
