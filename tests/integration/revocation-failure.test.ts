// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useDeviceSession } from '../../src/hooks/useDeviceSession';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const bridge = vi.mocked(invoke);

describe('ADB session revocation failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bridge.mockImplementation(async (command) => {
      if (command === 'tauri_allocate_adb_intent') return 'intent_1';
      if (command === 'tauri_initialize_adb_session') return {
        token: 'token_1', status: 'adb_transport_authorized', expiresInSeconds: 300,
      };
      if (command === 'tauri_validate_adb_session') return {
        valid: true, status: 'adb_transport_authorized',
      };
      if (command === 'tauri_revoke_adb_session') throw new Error('REMOTE_IPC_FAULT');
      return undefined;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('clears the local session even if native revocation rejects', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useDeviceSession('SERIAL_1'));
    await act(async () => { await result.current.initializeSession(); });
    expect(result.current.active).toBe(true);
    expect(result.current.status).toBe('TRANSPORT_AUTHORIZED');
    act(() => result.current.clearSession());
    expect(result.current.active).toBe(false);
    expect(result.current.status).toBe('OFFLINE');
    expect(result.current.leaseAge).toBe(0);
    await waitFor(() => expect(warning).toHaveBeenCalledWith(
      'Native session revocation failed:', expect.any(Error),
    ));
    expect(bridge).toHaveBeenCalledWith('tauri_revoke_adb_session', {
      request: { token: 'token_1' },
    });
    unmount();
  });
});
