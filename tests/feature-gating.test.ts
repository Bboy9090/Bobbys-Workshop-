import { describe, expect, it } from 'vitest';
import {
  canRefreshWithManifest,
  capabilityState,
  hasRegisteredCommand,
} from '../src/lib/featureGates';

describe('frontend native command gating', () => {
  it('fails closed while the native command manifest is still loading', () => {
    expect(hasRegisteredCommand(null, 'adb_scan')).toBe(false);
    expect(capabilityState(null, 'adb_scan')).toBe('loading');
  });

  it('does not start a native refresh before the manifest resolves', () => {
    expect(canRefreshWithManifest(true, null)).toBe(false);
  });

  it('allows browser preview refresh without a native manifest', () => {
    expect(canRefreshWithManifest(false, null)).toBe(true);
  });

  it('enables only an exactly registered command', () => {
    const commands = ['adb_scan', 'mtp_status'] as const;
    expect(hasRegisteredCommand(commands, 'adb_scan')).toBe(true);
    expect(capabilityState(commands, 'adb_scan')).toBe('available');
  });

  it('keeps an absent or near-match command unavailable', () => {
    const commands = ['adb_scan', 'mtp_status'] as const;
    expect(hasRegisteredCommand(commands, 'adb_prepare')).toBe(false);
    expect(hasRegisteredCommand(commands, 'adb_scan_extra')).toBe(false);
    expect(capabilityState(commands, 'adb_prepare')).toBe('unavailable');
  });

  it('treats a resolved empty manifest as ready but capability-empty', () => {
    const commands: string[] = [];
    expect(canRefreshWithManifest(true, commands)).toBe(true);
    expect(hasRegisteredCommand(commands, 'workflow_job_retry')).toBe(false);
    expect(capabilityState(commands, 'workflow_job_retry')).toBe('unavailable');
  });
});
