// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open, save: mocks.save }));

vi.mock('../../src/components/RepairCommandCenter', () => ({ default: () => null }));
vi.mock('../../src/components/SamsungDownloadStatus', () => ({ SamsungDownloadStatus: () => null }));
vi.mock('../../src/components/OperatorTimeline', () => ({ default: () => null }));
vi.mock('../../src/components/AuditLedger', () => ({ default: () => null }));
vi.mock('../../src/components/RecoverySafetyTools', () => ({ default: () => null }));
vi.mock('../../src/components/FirehoseDryRun', () => ({ default: () => null }));
vi.mock('../../src/components/QualificationDossier', () => ({ default: () => null }));
vi.mock('../../src/components/QualifiedFlashConsole', () => ({ default: () => null }));
vi.mock('../../src/components/DeviceModeGuide', () => ({ DeviceModeGuide: () => null }));

import App from '../../src/App';

const mainSource = readFileSync(process.cwd() + '/src-tauri/src/main.rs', 'utf8');

function parseRegisteredCommands() {
  const match = mainSource.match(
    /fn tauri_get_registered_commands\(\).*?let mut commands = vec!\[(?<common>.*?)\];\s*#\[cfg\(feature = "qualified-flash"\)\]\s*commands\.extend_from_slice\(&\[(?<qualified>.*?)\]\);/s,
  );
  if (!match?.groups) throw new Error('registered command manifest not found');
  const names = (body: string) => [...body.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g)].map((m) => m[1]);
  return { common: names(match.groups.common), qualified: names(match.groups.qualified) };
}

const COMMANDS = parseRegisteredCommands();
const handshake = {
  protocol: 'bobfwtools-handshake-v1',
  backend: 'native-tauri-rust',
  status: 'ready',
  greeting: 'ready',
  correlation_id: 'test-handshake',
};
const disconnectedMtp = {
  connected: false,
  targetId: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  deviceFamily: 'none',
  storages: [],
  capabilities: [],
  evidenceSource: 'test:none',
};
const emptyCapabilities = {
  usbDevicesSeen: 0,
  adbDevicesSeen: 0,
  mtpConnected: false,
  workflows: [],
};

type BackendOptions = {
  commands?: string[];
  rejectManifest?: boolean;
  deferManifest?: boolean;
  adbDevices?: unknown[];
  usbDevices?: unknown[];
  mtpStatus?: unknown;
  mtpDirectory?: (path: string[]) => unknown[];
};

function installBackend(options: BackendOptions = {}) {
  const commands = options.commands ?? COMMANDS.common;
  const calls: Array<{ command: string; args: unknown }> = [];
  let resolveManifest: ((value: string[]) => void) | null = null;

  mocks.invoke.mockImplementation((command: string, args?: unknown) => {
    calls.push({ command, args });
    if (command === 'tauri_get_registered_commands') {
      if (options.deferManifest) {
        return new Promise<string[]>((resolve) => {
          resolveManifest = resolve;
        });
      }
      if (options.rejectManifest) return Promise.reject(new Error('manifest unavailable'));
      return Promise.resolve(commands);
    }

    if (!commands.includes(command) && command !== 'frontend_backend_handshake') {
      return Promise.reject(new Error('command not registered in diagnostic edition: ' + command));
    }

    const response = (() => {
      switch (command) {
        case 'frontend_backend_handshake': return handshake;
        case 'bootforgeusb_scan': return options.usbDevices ?? [];
        case 'bootforge_recovery_scan': return [];
        case 'adb_scan': return options.adbDevices ?? [];
        case 'adb_mode_capabilities': return {
          serial: (args as { serial?: string })?.serial ?? 'ADB-1',
          manufacturer: 'Test',
          model: 'Phone',
          normal: true,
          recovery: true,
          bootloader: true,
          download: false,
          qualcommEdl: false,
          mediatekBrom: false,
          notes: [],
        };
        case 'fastboot_mode_devices': return [];
        case 'mtp_status': return options.mtpStatus ?? disconnectedMtp;
        case 'mtp_list_directory':
          return options.mtpDirectory?.((args as { path?: string[] })?.path ?? []) ?? [];
        case 'workflow_capabilities': return emptyCapabilities;
        case 'firmware_library_scan': return { roots: [], bundles: [] };
        case 'workflow_job_list': return [];
        case 'adb_battery_info': return { serial: 'ADB-1', workflow: 'battery-info', output: 'level: 80', verified: true, evidenceSource: 'adb:test' };
        case 'adb_device_info': return { serial: 'ADB-1', properties: { 'ro.product.model': 'Phone' }, verified: true, evidenceSource: 'adb:test' };
        case 'adb_logcat_snapshot': return { serial: 'ADB-1', workflow: 'logcat', output: 'log', verified: true, evidenceSource: 'adb:test' };
        default: return null;
      }
    })();

    return new Promise((resolve) => setTimeout(() => resolve(response), 0));
  });

  return {
    calls,
    commands,
    resolveManifest: (value = commands) => resolveManifest?.(value),
  };
}

function called(calls: Array<{ command: string }>, command: string) {
  return calls.some((entry) => entry.command === command);
}

beforeEach(() => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: vi.fn(), configurable: true });
  mocks.invoke.mockReset();
  mocks.open.mockReset();
  mocks.save.mockReset();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 50));
  vi.restoreAllMocks();
});

describe('capability manifest integration', () => {
  it('derives diagnostic and qualified-write command sets from the real Rust manifest', () => {
    expect(COMMANDS.common).toContain('tauri_get_registered_commands');
    expect(COMMANDS.common).toContain('adb_scan');
    expect(COMMANDS.qualified).toContain('flash_start');
    expect(COMMANDS.qualified).toContain('bootforge_issue_qualified_flash_grant');
    expect(COMMANDS.common.some((name) => COMMANDS.qualified.includes(name))).toBe(false);
  });

  it('waits for the command manifest before starting native scans', async () => {
    const backend = installBackend({ deferManifest: true });
    render(<App />);

    await waitFor(() => expect(called(backend.calls, 'tauri_get_registered_commands')).toBe(true));
    expect(called(backend.calls, 'frontend_backend_handshake')).toBe(false);
    expect(called(backend.calls, 'adb_scan')).toBe(false);

    backend.resolveManifest();
    await waitFor(() => expect(called(backend.calls, 'frontend_backend_handshake')).toBe(true));
    await waitFor(() => expect(called(backend.calls, 'adb_scan')).toBe(true));
  });

  it('fails closed when the manifest query rejects', async () => {
    const backend = installBackend({ rejectManifest: true });
    render(<App />);

    await waitFor(() => expect(called(backend.calls, 'frontend_backend_handshake')).toBe(true));
    const gated = backend.calls
      .map((entry) => entry.command)
      .filter((name) => name !== 'tauri_get_registered_commands' && name !== 'frontend_backend_handshake');
    expect(gated).toEqual([]);
  });

  it('discovers ADB when the USB scanner is unavailable', async () => {
    const commands = COMMANDS.common.filter((name) => name !== 'bootforgeusb_scan');
    const backend = installBackend({
      commands,
      adbDevices: [{ serial: 'ADB-1', state: 'device', details: [], authorized: true, evidenceSource: 'adb:test' }],
    });
    render(<App />);

    expect((await screen.findAllByText('ADB-1')).length).toBeGreaterThan(0);
    expect(called(backend.calls, 'adb_scan')).toBe(true);
    expect(called(backend.calls, 'bootforgeusb_scan')).toBe(false);
  });

  it('shows a fail-closed recovery notice when recovery commands are unavailable', async () => {
    const commands = COMMANDS.common.filter((name) => !name.startsWith('bootforge_recovery_'));
    const backend = installBackend({ commands });
    render(<App />);

    expect(await screen.findByText(/Recovery planning is unavailable in this build/i)).toBeTruthy();
    expect(called(backend.calls, 'bootforge_recovery_scan')).toBe(false);
  });

  it('browses MTP folders while transfer commands are unavailable', async () => {
    const commands = COMMANDS.common.filter((name) => !['mtp_upload_path', 'mtp_download_path'].includes(name));
    const backend = installBackend({
      commands,
      mtpStatus: {
        connected: true,
        targetId: 'a'.repeat(64),
        manufacturer: 'Test',
        model: 'MTP Phone',
        serialNumber: 'MTP-1',
        deviceFamily: 'android',
        storages: [{ description: 'Internal storage', freeSpaceBytes: 1024 }],
        capabilities: ['browse'],
        evidenceSource: 'mtp:test',
      },
      mtpDirectory: (path) => path.length === 0
        ? [{ filename: 'DCIM', path: ['DCIM'], isFolder: true, sizeBytes: 0 }]
        : [{ filename: 'photo.jpg', path: ['DCIM', 'photo.jpg'], isFolder: false, sizeBytes: 1234 }],
    });
    render(<App />);

    const dcim = await screen.findByText('DCIM');
    const row = dcim.closest('li');
    expect(row).toBeTruthy();
    fireEvent.click(within(row!).getByRole('button', { name: 'Open' }));

    expect(await screen.findByText('photo.jpg')).toBeTruthy();
    expect(called(backend.calls, 'mtp_list_directory')).toBe(true);

    const upload = screen.getByRole('button', { name: /Upload Mac file here/i });
    const download = screen.getByRole('button', { name: /Download to Mac/i });
    expect((upload as HTMLButtonElement).disabled).toBe(true);
    expect((download as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(upload);
    fireEvent.click(download);
    expect(called(backend.calls, 'mtp_upload_path')).toBe(false);
    expect(called(backend.calls, 'mtp_download_path')).toBe(false);
  });

  it('keeps read-only ADB diagnostics enabled without granting qualified write commands', async () => {
    const backend = installBackend({
      commands: COMMANDS.common,
      adbDevices: [{ serial: 'ADB-1', state: 'device', details: [], authorized: true, evidenceSource: 'adb:test' }],
    });
    render(<App />);

    expect((await screen.findAllByText('ADB-1')).length).toBeGreaterThan(0);
    const battery = screen.getByRole('button', { name: 'Battery info' });
    await waitFor(() => expect((battery as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(battery);
    await waitFor(() => expect(called(backend.calls, 'adb_battery_info')).toBe(true));

    for (const writeCommand of COMMANDS.qualified) {
      expect(called(backend.calls, writeCommand)).toBe(false);
    }
  });

  it('does not spin native refresh while MTP is disconnected', async () => {
    const backend = installBackend();
    render(<App />);

    await waitFor(() => {
      expect(backend.calls.filter((entry) => entry.command === 'frontend_backend_handshake').length).toBe(1);
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    expect(backend.calls.filter((entry) => entry.command === 'frontend_backend_handshake').length).toBe(1);
  });
});
