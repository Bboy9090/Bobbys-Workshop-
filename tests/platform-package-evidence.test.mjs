// Explicitly simulated headers test rejection logic, never artifact qualification.
import {describe,expect,it} from 'vitest';
import {inspectStandardExecutable,requirePackageSet} from '../scripts/lib/platform-package-evidence.mjs';
const revision='a'.repeat(40);
function executable(platform) {
  const bytes=Buffer.alloc(512);
  bytes.write(revision,256);
  if(platform==='windows') { bytes.write('MZ');bytes.writeUInt32LE(64,60);bytes.writeUInt32LE(0x4550,64);bytes.writeUInt16LE(0x8664,68); }
  else {bytes.write('7f454c46','hex');bytes[4]=2;bytes[5]=1;bytes.writeUInt16LE(62,18);}
  return bytes;
}
describe('standard public package provenance boundary',()=>{
  it.each(['windows','linux'])('accepts a source-bound %s header without granting write authority',platform=>{
    expect(inspectStandardExecutable(executable(platform),revision,platform)).toMatchObject({architecture:'x86_64',qualifiedDestructiveWriterIncluded:false});
  });
  it.each(['windows','linux'])('rejects stale source in %s copies',platform=>{
    expect(()=>inspectStandardExecutable(executable(platform),'b'.repeat(40),platform)).toThrow('source revision');
    expect(()=>inspectStandardExecutable(executable(platform),'short',platform)).toThrow('Full lowercase');
  });
  it.each(['bootforge_qualified_fastboot_devices','issue-qualified-flash-grant'])('rejects compiled destructive marker %s',marker=>{
    const bytes=executable('linux');bytes.write(marker,350);
    expect(()=>inspectStandardExecutable(bytes,revision,'linux')).toThrow('Qualified destructive');
  });
  it('rejects wrong and truncated architecture headers',()=>{
    const pe=executable('windows');pe.writeUInt32LE(1000,60);
    expect(()=>inspectStandardExecutable(pe,revision,'windows')).toThrow('architecture');
    const elf=executable('linux');elf.writeUInt16LE(183,18);
    expect(()=>inspectStandardExecutable(elf,revision,'linux')).toThrow('architecture');
    expect(()=>inspectStandardExecutable(Buffer.from(revision),revision,'windows')).toThrow('PE');
  });
  it('refuses a partial, duplicated, empty, or unhashed installer set',()=>{
    const a={kind:'msi',path:'app.msi',sha256:'a'.repeat(64),bytes:100};
    const b={kind:'nsis',path:'app.exe',sha256:'b'.repeat(64),bytes:200};
    expect(()=>requirePackageSet('windows',[a,b])).not.toThrow();
    for(const set of [[a],[a,a],[a,{...b,path:a.path}],[a,{...b,bytes:0}],[a,{...b,sha256:'missing'}]])expect(()=>requirePackageSet('windows',set)).toThrow();
  });
});
