import {describe, it, expect} from 'vitest';
import {evaluateWorkflow, finalizeWorkflow, WorkflowStatus} from '../../core/engine/workflow_contract.js';
const device = {identity:'test-1', authorized:true, supportedActions:['diagnostics']};
describe('fail-closed workflow contract', () => {
 it('rejects missing authorization and unsupported operations', () => {
  expect(evaluateWorkflow({device:{...device,authorized:false},action:'diagnostics',preflight:{passed:true,identity:'test-1'},confirmed:true}).status).toBe(WorkflowStatus.PREFLIGHT_FAILED);
  expect(evaluateWorkflow({device,action:'flash',preflight:{passed:true,identity:'test-1'},confirmed:true}).status).toBe(WorkflowStatus.PREFLIGHT_FAILED);
 });
 it('rejects stale preflight and requires confirmation', () => {
  expect(evaluateWorkflow({device,action:'diagnostics',preflight:{passed:true,identity:'other'},confirmed:true}).status).toBe(WorkflowStatus.PREFLIGHT_FAILED);
  expect(evaluateWorkflow({device,action:'diagnostics',preflight:{passed:true,identity:'test-1'}}).status).toBe(WorkflowStatus.AWAITING_CONFIRMATION);
 });
 it('never treats command success as verified repair', () => {
  expect(finalizeWorkflow({device,action:'diagnostics',execution:{success:true},verification:{passed:true}}).status).toBe(WorkflowStatus.VERIFICATION_FAILED);
 });
 it('requires matching verification identity, action and evidence', () => {
  expect(finalizeWorkflow({device,action:'diagnostics',execution:{success:true},verification:{passed:true,identity:'other',action:'diagnostics',evidenceId:'proof'}}).status).toBe(WorkflowStatus.VERIFICATION_FAILED);
  expect(finalizeWorkflow({device,action:'diagnostics',execution:{success:true},verification:{passed:true,identity:'test-1',action:'diagnostics',evidenceId:'proof'}}).status).toBe(WorkflowStatus.VERIFIED);
 });
});
