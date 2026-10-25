// Fail-closed workflow state contract; does not execute hardware commands.
export const WorkflowStatus = Object.freeze({
  IDENTIFIED: 'identified', PREFLIGHT_FAILED: 'preflight_failed',
  AWAITING_CONFIRMATION: 'awaiting_confirmation', READY: 'ready',
  EXECUTING: 'executing', EXECUTION_FAILED: 'execution_failed',
  VERIFICATION_FAILED: 'verification_failed', VERIFIED: 'verified',
});
export function evaluateWorkflow({device, action, preflight, confirmed}) {
  if (!device?.identity || !device?.authorized || !Array.isArray(device?.supportedActions) || !device.supportedActions.includes(action)) {
    return {status: WorkflowStatus.PREFLIGHT_FAILED, reason: 'Device identity, authorization or action support unverified'};
  }
  if (preflight?.passed !== true || preflight?.identity !== device.identity) {
    return {status: WorkflowStatus.PREFLIGHT_FAILED, reason: 'Preflight evidence missing or stale'};
  }
  if (confirmed !== true) return {status: WorkflowStatus.AWAITING_CONFIRMATION};
  return {status: WorkflowStatus.READY};
}
export function finalizeWorkflow({device, action, execution, verification}) {
  if (!device?.identity || !action || execution?.success !== true) {
    return {status: WorkflowStatus.EXECUTION_FAILED};
  }
  if (verification?.passed !== true || verification?.identity !== device.identity || verification?.action !== action || !verification?.evidenceId) {
    return {status: WorkflowStatus.VERIFICATION_FAILED};
  }
  return {status: WorkflowStatus.VERIFIED, receipt: {deviceIdentity: device.identity, action, evidenceId: verification.evidenceId, status: 'verified'}};
}
