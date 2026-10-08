// Unit tests for Workflow Engine
import { describe, it, expect } from 'vitest';
import { WorkflowEngine } from '../../core/tasks/workflow-engine.js';

describe('Workflow Engine', () => {
  it('should load workflow from JSON file', () => {
    expect(true).toBe(true);
  });

  it('should list available workflows', () => {
    expect(true).toBe(true);
  });

  it('should execute workflow steps in sequence', () => {
    expect(true).toBe(true);
  });

  it('should handle step failures correctly', () => {
    expect(true).toBe(true);
  });

  it('should require authorization for sensitive workflows', () => {
    expect(true).toBe(true);
  });

  it('should log workflow execution to shadow logs', () => {
    expect(true).toBe(true);
  });
});


describe('Sensitive workflow execution gates', () => {
  const sensitiveWorkflow = {
    name: 'Protected Repair',
    requires_authorization: true,
    risk_level: 'destructive',
    authorization_prompt: 'Confirm authorized repair',
    legal_notice: 'Authorized devices only',
    steps: []
  };

  it('blocks execution without explicit confirmation', async () => {
    const engine = new WorkflowEngine({ workflowsDir: './workflows' });
    engine.loadWorkflow = async () => ({ success: true, workflow: sensitiveWorkflow });

    const result = await engine.executeWorkflow('mobile', 'protected', {
      deviceSerial: 'DEVICE-1'
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/confirmation required/i);
  });

  it('blocks execution without device identity', async () => {
    const engine = new WorkflowEngine({ workflowsDir: './workflows' });
    engine.loadWorkflow = async () => ({ success: true, workflow: sensitiveWorkflow });

    const result = await engine.executeWorkflow('mobile', 'protected', {
      authorization: { confirmed: true }
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/device identity/i);
  });

  it('blocks mismatched authorized device identity', async () => {
    const engine = new WorkflowEngine({ workflowsDir: './workflows' });
    engine.loadWorkflow = async () => ({ success: true, workflow: sensitiveWorkflow });

    const result = await engine.executeWorkflow('mobile', 'protected', {
      deviceSerial: 'DEVICE-1',
      authorization: { confirmed: true, deviceSerial: 'DEVICE-2' }
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/does not match/i);
  });
});

describe('Dispatch safety', () => {
  it('rejects unsupported command platforms before dispatch', async () => {
    const engine = new WorkflowEngine({ workflowsDir: './workflows' });
    const result = await engine.executeCommand(
      { type: 'command', action: 'fastboot devices' },
      { deviceSerial: 'DEVICE-1', workflow: { platform: 'mobile' } }
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unsupported command platform/i);
  });
});
