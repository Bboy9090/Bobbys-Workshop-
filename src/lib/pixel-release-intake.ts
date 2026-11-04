/**
 * OEM release metadata intake. Data must come from an independently captured,
 * legitimate OEM release listing; this module does not scrape gated pages.
 */
export type PixelRelease = {
  deviceCodename: string;
  buildId: string;
  releaseDate: string;
  filename: string;
  downloadUrl: string;
  sha256: string;
  provenanceUrl: string;
  integrity: 'reference-unverified';
  flashAuthorized: false;
};
const hash = /^[a-f0-9]{64}$/i;
const token = /^[a-z0-9][a-z0-9_-]{1,49}$/;
const build = /^[A-Za-z0-9][A-Za-z0-9._-]{2,99}$/;
function officialHttps(value: unknown, host: string): string {
  if(typeof value !== 'string') throw Error('Official HTTPS URL is required');
  const u = new URL(value);
  if(u.protocol !== 'https:' || u.hostname !== host || u.port || u.username || u.password || u.hash || u.search)
    throw Error('URL is not an approved OEM origin');
  return u.href;
}
export function validatePixelRelease(input: unknown): PixelRelease {
  if(!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Expected release record');
  const obj = input as Record<string, unknown>;
  const deviceCodename = obj.deviceCodename;
  const buildId = obj.buildId;
  const releaseDate = obj.releaseDate;
  const filename = obj.filename;
  const sha256 = obj.sha256;
  if(typeof deviceCodename !== 'string' || !token.test(deviceCodename)) throw Error('Exact device codename required');
  if(typeof buildId !== 'string' || !build.test(buildId)) throw Error('Exact build ID required');
  if(typeof releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate) ||
    Number.isNaN(Date.parse(releaseDate+'T00:00:00Z')) ||
    new Date(releaseDate+'T00:00:00Z').toISOString().slice(0,10) !== releaseDate) throw Error('Valid release date required');
  if(typeof filename !== 'string' || filename.length > 180 || !/^[A-Za-z0-9][A-Za-z0-9._-]+\.zip$/.test(filename) ||
    filename.includes('..')) throw Error('Safe ZIP filename required');
  if(typeof sha256 !== 'string' || !hash.test(sha256)) throw Error('Published 64-character SHA-256 required');
  const downloadUrl = officialHttps(obj.downloadUrl,'dl.google.com');
  if(new URL(downloadUrl).pathname.split('/').pop() !== filename)
    throw Error('Download filename mismatch');
  const provenanceUrl = officialHttps(obj.provenanceUrl,'developers.google.com');
  if(!['/android/ota','/android/images'].includes(new URL(provenanceUrl).pathname))
    throw Error('Only official Pixel listing provenance accepted');
  return {deviceCodename,buildId,releaseDate,filename,downloadUrl,sha256:sha256.toLowerCase(),
    provenanceUrl,integrity:'reference-unverified',flashAuthorized:false};
}
export function selectExactPixelReleases(input: readonly unknown[], codename: string): PixelRelease[] {
  if(input.length > 5000) throw Error('Release collection too large');
  if(!token.test(codename)) throw Error('Exact codename required');
  const releases = input.map(validatePixelRelease);
  const ids=new Set<string>();
  for(const r of releases){
    const id=[r.deviceCodename,r.buildId,r.filename].join('|');
    if(ids.has(id)) throw Error('Duplicate OEM release identity');
    ids.add(id);
  }
  return releases.filter(r=>r.deviceCodename===codename);
}
