import { describe, expect, it } from 'vitest';
import { discoverOfficialFirmwareSources } from '../src/lib/oem-source-discovery';
describe('official OEM source discovery', () => {
  it('returns two actual official Pixel catalog pages, not claimed model packages', () => {
    const found = discoverOfficialFirmwareSources('Google', 'Pixel 8');
    expect(found).toHaveLength(2);
    expect(found.map(entry => entry.sourceUrl)).toEqual([
      'https://developers.google.com/android/ota',
      'https://developers.google.com/android/images',
    ]);
    expect(found.every(entry=>entry.matchStatus==='source-available-model-unverified' && !entry.packageVerified)).toBe(true);
  });
  it('never fabricates results for unimplemented OEMs or questionable model strings', () => {
    expect(discoverOfficialFirmwareSources('Samsung','SM-S911U')).toEqual([]);
    expect(discoverOfficialFirmwareSources('Google','SM-S911U')).toEqual([]);
    expect(discoverOfficialFirmwareSources('Google','../Pixel 8')).toEqual([]);
    expect(discoverOfficialFirmwareSources('Google','')).toEqual([]);
  });
  it('does not claim device firmware compatibility from model wording alone', () => {
    for (const entry of discoverOfficialFirmwareSources('Google Pixel','Pixel 9 Pro')) {
      expect(entry.warnings.some(w=>w.includes('codename'))).toBe(true);
      expect(entry.packageVerified).toBe(false);
    }
  });
});
