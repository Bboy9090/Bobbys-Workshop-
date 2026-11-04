import {describe,it,expect} from 'vitest';
import {selectExactPixelReleases,validatePixelRelease} from '../src/lib/pixel-release-intake';
const fixture={deviceCodename:'shiba',buildId:'AP1A.240505.004',releaseDate:'2024-05-05',
filename:'shiba-ota.zip',downloadUrl:'https://dl.google.com/android/shiba-ota.zip',
sha256:'a'.repeat(64),provenanceUrl:'https://developers.google.com/android/ota'};
describe('Pixel release metadata intake (synthetic fixtures, not OEM evidence)',()=>{
 it('normalizes a strictly scoped fixture without granting package or flash trust',()=>{
  const record=validatePixelRelease(fixture);
  expect(record.integrity).toBe('reference-unverified');
  expect(record.flashAuthorized).toBe(false);
  expect(selectExactPixelReleases([fixture,{...fixture,deviceCodename:'husky',filename:'husky-ota.zip',downloadUrl:'https://dl.google.com/android/husky-ota.zip'}],'shiba')).toHaveLength(1);
 });
 it('rejects attacker origins, URL credentials, traversal and ambiguous filenames',()=>{
  for(const change of [
   {downloadUrl:'https://dl.google.com.attacker.example/android/shiba-ota.zip'},
   {downloadUrl:'https://bob@dl.google.com/android/shiba-ota.zip'},
   {downloadUrl:'https://dl.google.com/android/not-the-same.zip'},
   {filename:'../evil.zip'},
   {provenanceUrl:'https://developers.google.com/search?q=shiba'},
   {sha256:'abcd'},
   {releaseDate:'2024-02-30'},
   {downloadUrl:'https://dl.google.com/android/shiba-ota.zip?mirror=1'},
   {downloadUrl:'https://dl.google.com/android/%73hiba-ota.zip'},
   {provenanceUrl:'https://developers.google.com/android/ota?redirect=1'},
  ]) expect(()=>validatePixelRelease({...fixture,...change})).toThrow();
 });
 it('rejects duplicate release identity and incomplete data',()=>{
  expect(()=>selectExactPixelReleases([fixture,fixture],'shiba')).toThrow('Duplicate');
  expect(()=>validatePixelRelease({...fixture,deviceCodename:'Pixel 8'})).toThrow();
  expect(()=>validatePixelRelease({...fixture,buildId:''})).toThrow();
 });
});
