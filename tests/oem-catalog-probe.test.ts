import {describe,expect,it,vi} from 'vitest';
import {probeOfficialSources} from '../src/lib/oem-catalog-probe';
describe('OEM live catalog probe',()=>{
  it('uses HEAD only against two allowlisted URLs, never a firmware download',async()=>{
    const seen:string[]=[];
    const fake=vi.fn(async(input:RequestInfo|URL,options?:RequestInit)=>{
      seen.push(String(input));
      expect(options?.method).toBe('HEAD');
      expect(options?.redirect).toBe('manual');
      return {status:200} as Response;
    });
    const result=await probeOfficialSources('Google','Pixel 8',fake as typeof fetch);
    expect(result).toHaveLength(2);
    expect(result.every(item=>item.reachable && !item.packageVerified && item.packageCount===null)).toBe(true);
    expect(seen).toEqual(['https://developers.google.com/android/ota','https://developers.google.com/android/images']);
  });
  it('does not query arbitrary domains or unsupported brands',async()=>{
    const fake=vi.fn();
    expect(await probeOfficialSources('Samsung','SM-S911U',fake)).toEqual([]);
    expect(fake).not.toHaveBeenCalled();
  });
  it('does not accept redirects or errors as catalog availability',async()=>{
    const redirected=await probeOfficialSources('Google','Pixel 8',vi.fn(async()=>({status:302} as Response)));
    expect(redirected.every(item=>!item.reachable)).toBe(true);
    const failed=await probeOfficialSources('Google','Pixel 8',vi.fn(async()=>{throw Error('Offline');}));
    expect(failed.every(item=>!item.reachable && item.error==='Offline')).toBe(true);
  });
});
