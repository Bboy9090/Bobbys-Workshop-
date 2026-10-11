/**
 * Convert a Heimdall read-only PIT session log to a shareable receipt.
 * Never include raw device identifiers, partition labels, offsets or filenames.
 */
export function sanitizeSamsungPitEvidence(log) {
 if(typeof log!=='string'||log.length>2_000_000) throw Error('Bounded Heimdall log required');
 const protocol=log.includes('Protocol initialisation successful.');
 const session=log.includes('Session begun.');
 const downloaded=log.includes('PIT file download successful.');
 const count=/^Entry Count:\s*(\d+)\s*$/m.exec(log);
 const tag=/^CPU\/bootloader tag:\s*([A-Z0-9_-]{1,32})\s*$/m.exec(log);
 const entries=count?Number(count[1]):null;
 const valid=protocol&&session&&downloaded&&Number.isSafeInteger(entries)&&entries>0&&entries<4096&&!!tag;
 return {
  schema:'bobfwtools.samsung.pit-observation.v1',
  source:'heimdall read-only print-pit',
  protocolInitialized:protocol,sessionEstablished:session,pitDownloaded:downloaded,
  partitionCount:valid?entries:null,chipsetTag:valid?tag[1]:null,
  result:valid?'observed':'incomplete',
  modelIdentityVerified:false,firmwareVerified:false,frpStateChanged:false,
  flashAuthorized:false,hardwareQualificationComplete:false
 };
}
