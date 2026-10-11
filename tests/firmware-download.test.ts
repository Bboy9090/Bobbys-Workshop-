import { describe,it,expect,vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { downloadVerifiedFirmware } from '../scripts/lib/download-verified-firmware.mjs';
const DATA = Buffer.from('actual fixture bytes');
const SHA = createHash('sha256').update(DATA).digest('hex');
function mockResponse(status=200, bytes=DATA) {
  return {status, headers:new Headers({'content-length':String(bytes.length)}),
    body:new ReadableStream({start(controller){controller.enqueue(bytes); controller.close();}})};
}
describe('verified OEM downloader',()=>{
  it('downloads real streamed bytes, confirms digest and never authorizes flashing',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'bobfw-dl-'));
    try{
      const dest=join(dir,'firmware.zip'),fetcher=vi.fn(async()=>mockResponse());
      const receipt=await downloadVerifiedFirmware({url:'https://dl.google.com/test.zip',destination:dest,expectedSha256:SHA,fetcher});
      expect((await readFile(dest)).equals(DATA)).toBe(true);
      expect(receipt.checksumMatched).toBe(true);
      expect(await readdir(dir)).toEqual(['firmware.zip']);
      expect(receipt.flashAuthorized).toBe(false);
      expect(fetcher.mock.calls[0][1]).toMatchObject({redirect:'manual',method:'GET'});
      await expect(downloadVerifiedFirmware({url:'https://dl.google.com/test.zip',destination:dest,expectedSha256:SHA,fetcher})).rejects.toThrow('already exists');
    } finally {await rm(dir,{force:true,recursive:true});}
  });
  it('rejects hash mismatch and removes partial download',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'bobfw-dl-'));
    try{
      await expect(downloadVerifiedFirmware({url:'https://dl.google.com/a.zip',destination:join(dir,'a.zip'),
        expectedSha256:'f'.repeat(64),fetcher:async()=>mockResponse()})).rejects.toThrow('SHA-256 mismatch');
      expect(await readdir(dir)).toEqual([]);
    } finally {await rm(dir,{force:true,recursive:true});}
  });
  it('does not allow arbitrary hosts or redirected downloads',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'bobfw-dl-'));
    try{
      const destination=join(dir,'a.zip');
      await expect(downloadVerifiedFirmware({url:'https://evil.example/a.zip',destination,expectedSha256:SHA})).rejects.toThrow('allowlisted');
      await expect(downloadVerifiedFirmware({url:'https://dl.google.com/a.zip',destination,expectedSha256:SHA,
        fetcher:async()=>mockResponse(302)})).rejects.toThrow('HTTP 200');
      expect(await readdir(dir)).toEqual([]);
    } finally {await rm(dir,{force:true,recursive:true});}
  });
});

describe('download failure and concurrency gates',()=>{
  it('rejects truncated HTTP bodies and clears temporary files',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'bobfw-short-'));
    try {
      const bad=()=>({status:200,headers:new Headers({'content-length':String(DATA.length+5)}),
        body:new ReadableStream({start(c){c.enqueue(DATA);c.close();}})});
      await expect(downloadVerifiedFirmware({url:'https://dl.google.com/a.zip',destination:join(dir,'a.zip'),
        expectedSha256:SHA,fetcher:async()=>bad()})).rejects.toThrow('Incomplete download');
      expect(await readdir(dir)).toEqual([]);
    } finally {await rm(dir,{recursive:true,force:true});}
  });
  it('refuses to overwrite a destination created during transfer',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'bobfw-race-'));
    const destination=join(dir,'image.zip');
    try {
      let injected=false;
      await expect(downloadVerifiedFirmware({url:'https://dl.google.com/a.zip',destination,
        expectedSha256:SHA,fetcher:async()=>mockResponse(),
        onProgress:()=>{if(!injected){injected=true;writeFile(destination,'existing file');}}})).rejects.toThrow();
      expect((await readFile(destination,'utf8'))).toBe('existing file');
      expect(await readdir(dir)).toEqual(['image.zip']);
    } finally {await rm(dir,{recursive:true,force:true});}
  });
});
