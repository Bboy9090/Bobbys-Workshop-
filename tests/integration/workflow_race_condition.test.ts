// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { useDeviceSession } from '../../src/hooks/useDeviceSession';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const ipc = vi.mocked(invoke);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const authorized = (token: string) => ({ token, status: 'adb_transport_authorized', expiresInSeconds: 300 });

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('ADB session frontend cancellation races', () => {
  it('revokes a late scan token after a target switch without activating it', async () => {
    const scan = deferred<ReturnType<typeof authorized>>();
    ipc.mockImplementation(async (command) => {
      if (command === 'tauri_allocate_adb_intent') return 'intent-a';
      if (command === 'tauri_initialize_adb_session') return scan.promise;
      return true;
    });
    const hook = renderHook(({ serial }) => useDeviceSession(serial), { initialProps: { serial: 'device-a' } });
    await act(async () => { void hook.result.current.initializeSession(); await Promise.resolve(); });
    expect(ipc).toHaveBeenCalledWith('tauri_allocate_adb_intent', { request: { targetSerial: 'device-a' } });
    expect(ipc).toHaveBeenCalledWith('tauri_initialize_adb_session', { request: { targetSerial: 'device-a', intentId: 'intent-a' } });
    hook.rerender({ serial: 'device-b' });
    await act(async () => { scan.resolve(authorized('late-token')); await scan.promise; });
    expect(hook.result.current.active).toBe(false);
    expect(hook.result.current.status).toBe('OFFLINE');
    expect(ipc).toHaveBeenCalledWith('tauri_cancel_adb_intent', { request: { intentId: 'intent-a' } });
    expect(ipc).toHaveBeenCalledWith('tauri_revoke_adb_session', { request: { token: 'late-token' } });
    hook.unmount();
  });

  it('cancels a pending intent on unmount and revokes its late token', async () => {
    const scan = deferred<ReturnType<typeof authorized>>();
    ipc.mockImplementation(async (command) => {
      if (command === 'tauri_allocate_adb_intent') return 'intent-b';
      if (command === 'tauri_initialize_adb_session') return scan.promise;
      return true;
    });
    const hook = renderHook(() => useDeviceSession('device-b'));
    await act(async () => { void hook.result.current.initializeSession(); await Promise.resolve(); });
    hook.unmount();
    expect(ipc).toHaveBeenCalledWith('tauri_cancel_adb_intent', { request: { intentId: 'intent-b' } });
    await act(async () => { scan.resolve(authorized('unmounted-token')); await scan.promise; });
    expect(ipc).toHaveBeenCalledWith('tauri_revoke_adb_session', { request: { token: 'unmounted-token' } });
  });

  it('cancels allocation returned after the view has unmounted', async () => {
    const allocation = deferred<string>();
    ipc.mockImplementation(async (command) => command === 'tauri_allocate_adb_intent' ? allocation.promise : true);
    const hook = renderHook(() => useDeviceSession('device-c'));
    await act(async () => { void hook.result.current.initializeSession(); await Promise.resolve(); });
    hook.unmount();
    await act(async () => { allocation.resolve('late-intent'); await allocation.promise; });
    expect(ipc).toHaveBeenCalledWith('tauri_cancel_adb_intent', { request: { intentId: 'late-intent' } });
    expect(ipc).not.toHaveBeenCalledWith('tauri_initialize_adb_session', expect.anything());
  });
});
