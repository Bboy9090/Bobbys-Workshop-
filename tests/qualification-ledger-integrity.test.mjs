import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {reportQualificationFile} from '../scripts/qualification-matrix.mjs';

// Archival integrity at capture time. Live reports still use the normal 24-hour expiry.
test('the published qualification snapshot has intact receipts and no execution authority',()=>{
  const file=fileURLToPath(new URL('../docs/evidence/qualification-20261020/ledger.json',import.meta.url));
  const ledger=JSON.parse(readFileSync(file,'utf8'));
  const report=reportQualificationFile(file,Date.parse(ledger.reportedAt));
  expect(ledger.executionAuthorized).toBe(false);
  expect(report.rows).toHaveLength(ledger.cases.length);
  expect(report.rows.every(row=>row.executionAuthorized===false)).toBe(true);
  for(const receipt of ledger.receipts){
    expect(report.rows.find(row=>row.caseId===receipt.caseId)).toMatchObject({
      status:receipt.status,sourceRevision:receipt.sourceRevision,executionAuthorized:false,
    });
  }
  expect(report.rows.some(row=>row.scope.startsWith('hardware-') && row.status==='PASS')).toBe(false);
});
