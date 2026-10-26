import {afterEach, expect, test, vi} from 'vitest';
import {invoke} from '@tauri-apps/api/core';
import {
  getMtpStatus, listMtpRoot, listMtpDirectory, downloadMtpFile,
  uploadMtpFile, downloadMtpPath, uploadMtpPath,
} from '../src/lib/desktop';

vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const targetId='a'.repeat(64);
function host() {
  vi.stubGlobal('window',{__TAURI_INTERNALS__:{}});
  vi.mocked(invoke).mockReset().mockResolvedValue([]);
}

test('connected MTP status requires a backend target identity',async()=>{
  host();
  for(const invalid of [undefined,'', 'NVMe', 'A'.repeat(64)]) {
    vi.mocked(invoke).mockResolvedValue({connected:true,targetId:invalid});
    await expect(getMtpStatus(true)).rejects.toThrow('unverified');
    await expect(getMtpStatus()).resolves.toBeNull();
  }
});

test.each([
  ['list root',()=>listMtpRoot(0,targetId),'mtp_list_root',{storageIndex:0}],
  ['list folder',()=>listMtpDirectory(1,['DCIM'],targetId),'mtp_list_directory',{storageIndex:1,path:['DCIM']}],
  ['download handle',()=>downloadMtpFile(0,'123','chosen-output',targetId),'mtp_download_file',{storageIndex:0,handle:'123',destinationPath:'chosen-output'}],
  ['upload handle',()=>uploadMtpFile(0,'chosen-source',targetId,'123'),'mtp_upload_file',{storageIndex:0,sourcePath:'chosen-source',parentHandle:'123'}],
  ['download path',()=>downloadMtpPath(0,['photo.jpg'],'chosen-output',targetId),'mtp_download_path',{storageIndex:0,objectPath:['photo.jpg'],destinationPath:'chosen-output'}],
  ['upload path',()=>uploadMtpPath(0,['DCIM'],'chosen-source',targetId),'mtp_upload_path',{storageIndex:0,folderPath:['DCIM'],sourcePath:'chosen-source'}],
] as const)('%s binds the exact observed USB MTP target',async(_label,operation,command,args)=>{
  host();
  await operation();
  expect(invoke).toHaveBeenCalledExactlyOnceWith(command,{...args,targetId});
});

test('all file endpoints reject invalid targets before native IPC',async()=>{
  host();
  for(const invalid of [undefined,'','not-a-target','A'.repeat(64)]) {
    const token=invalid as unknown as string;
    for(const operation of [
      ()=>listMtpRoot(0,token),()=>listMtpDirectory(0,[],token),
      ()=>downloadMtpFile(0,'1','output',token),()=>uploadMtpFile(0,'source',token),
      ()=>downloadMtpPath(0,['file'],'output',token),()=>uploadMtpPath(0,[],'source',token),
    ]) await expect(operation()).rejects.toThrow('unverified');
  }
  expect(invoke).not.toHaveBeenCalled();
});
