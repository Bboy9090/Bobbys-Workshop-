/** Read-only gate evaluator. User consent is not technical proof of device safety. */
const SHA=/^[a-f0-9]{64}$/i;
export function evaluateFirmwareReadiness(receipt) {
 const checks={
  deviceSerial: typeof receipt?.deviceSerial==='string' && receipt.deviceSerial.trim().length>=4,
  deviceModel: typeof receipt?.deviceModel==='string' && receipt.deviceModel.trim().length>=2,
  oemModelMatch: receipt?.oemModelMatch===true,
  sourceHash: SHA.test(receipt?.manufacturerPublishedSha256??''),
  actualHashMatch: receipt?.actualSha256?.toLowerCase()===receipt?.manufacturerPublishedSha256?.toLowerCase() && SHA.test(receipt?.actualSha256??''),
  oemSignature: receipt?.oemSignatureVerified===true,
  rollbackSafe: receipt?.antiRollbackVerified===true,
  hardwareQualified: receipt?.hardwareQualified===true,
  recoveryPrepared: receipt?.recoveryPrepared===true,
  explicitUserConsent: receipt?.explicitUserConsent===true
 };
 // This evaluator never grants permission to write: independent provenance and
 // hardware verification must be implemented and enforced by a future trusted executor.
 return {checks,missing:Object.keys(checks).filter(k=>!checks[k]),
  inspectionEnabled:true,downloadEligible:false,flashAuthorized:false,
  reason:'Readiness evidence is user-supplied and not independently authenticated'};
}
