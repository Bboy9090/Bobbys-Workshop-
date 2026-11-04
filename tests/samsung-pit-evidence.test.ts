import {describe,it,expect} from 'vitest';
import {sanitizeSamsungPitEvidence} from '../scripts/lib/samsung-pit-evidence.mjs';
describe('Samsung PIT read-only evidence',()=>{
 it('summarizes a successful real-session-shaped log without leaking identifiers',()=>{
  const log='Serial Number: SECRET123\nProtocol initialisation successful.\nSession begun.\nPIT file download successful.\nEntry Count: 27\nCPU/bootloader tag: LSI7870\nPartition Name: USERDATA';
  const r=sanitizeSamsungPitEvidence(log);
  expect(r.result).toBe('observed');expect(r.partitionCount).toBe(27);
  expect(r.flashAuthorized).toBe(false);expect(r.modelIdentityVerified).toBe(false);
  expect(JSON.stringify(r)).not.toContain('SECRET123');
  expect(JSON.stringify(r)).not.toContain('USERDATA');
 });
 it('rejects incomplete log claims and never authorizes flashing',()=>{
  const r=sanitizeSamsungPitEvidence('PIT file download successful.\nEntry Count: 27');
  expect(r.result).toBe('incomplete');expect(r.flashAuthorized).toBe(false);
  expect(r.hardwareQualificationComplete).toBe(false);
 });
});