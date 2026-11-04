import { preparePixelDownloadCandidate } from './pixel-download-candidate.ts';
export type FirmwareAudit = {
  outcome: 'blocked';
  evaluatedAt: string;
  deviceCodename: string;
  buildId: string;
  evidence: {
    metadataSyntax: 'valid';
    sourceReference: 'unverified';
    packageSignature: 'unverified';
    rollbackEligibility: 'unverified';
    hardwareQualification: 'unverified';
  };
  blockers: string[];
  downloadAuthorized: false;
  flashAuthorized: false;
};
/** Read-only, explicit account of unproven OEM trust and hardware checks. */
export function auditPixelFirmwareRelease(raw: unknown, deviceCodename: string,
  suppliedReferenceHash: string | null, now = new Date().toISOString()): FirmwareAudit {
  if (!Number.isFinite(Date.parse(now))) throw Error('Audit timestamp invalid');
  const candidate = preparePixelDownloadCandidate(raw, deviceCodename, suppliedReferenceHash);
  const blockers = [...candidate.blockers, 'Independent OEM release provenance not certified',
    'Device hardware revision and partition layout not qualified'];
  return {
    outcome: 'blocked', evaluatedAt: now, deviceCodename,
    buildId: candidate.release.buildId,
    evidence: {
      metadataSyntax: 'valid', sourceReference: 'unverified',
      packageSignature: 'unverified', rollbackEligibility: 'unverified',
      hardwareQualification: 'unverified',
    },
    blockers: [...new Set(blockers)],
    downloadAuthorized: false, flashAuthorized: false,
  };
}
