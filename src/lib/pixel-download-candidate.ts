import { validatePixelRelease } from './pixel-release-intake';
import type { PixelRelease } from './pixel-release-intake';
/** Evidence-aware release selection. Never upgrades user-entered metadata to trusted source evidence. */
export type PixelReleaseCandidate = { release: PixelRelease; status:'reference-unverified'; blockers:string[] };
export function preparePixelDownloadCandidate(raw:unknown, deviceCodename:string, confirmedOemDigest:string|null):PixelReleaseCandidate {
 const release=validatePixelRelease(raw);
 const blockers:string[]=[];
 if(release.deviceCodename!==deviceCodename) blockers.push('Exact device codename does not match');
 if(!confirmedOemDigest || !/^[a-f0-9]{64}$/i.test(confirmedOemDigest) ||
    confirmedOemDigest.toLowerCase()!==release.sha256)
   blockers.push('OEM-published SHA-256 reference has not been independently confirmed');
 blockers.push('OEM package signature and anti-rollback eligibility unverified');
 return {release,status:'reference-unverified',blockers};
}
