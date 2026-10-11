import {describe,it,expect} from 'vitest';
import {preparePixelDownloadCandidate} from '../src/lib/pixel-download-candidate';
const f={deviceCodename:'shiba',buildId:'AP1A.240505.004',releaseDate:'2024-05-05',filename:'shiba-ota.zip',downloadUrl:'https://dl.google.com/android/shiba-ota.zip',sha256:'a'.repeat(64),provenanceUrl:'https://developers.google.com/android/ota'};
describe('Pixel download candidate policy',()=>{
 it('retains unverified status even when supplied digest agrees',()=>{
  const r=preparePixelDownloadCandidate(f,'shiba','a'.repeat(64));
  expect(r.status).toBe('reference-unverified');
  expect(r.blockers.some(x=>x.includes('signature'))).toBe(true);
 });
 it('rejects identity conflicts and unconfirmed references',()=>{
  const r=preparePixelDownloadCandidate(f,'husky',null);
  expect(r.blockers).toContain('Exact device codename does not match');
  expect(r.blockers.some(x=>x.includes('independently confirmed'))).toBe(true);
 });
});