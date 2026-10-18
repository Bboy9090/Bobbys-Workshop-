import { expect, test } from 'vitest';
import { isSamsungDownloadTransport, visibleHardwareLanes } from '../src/lib/hardware-lane-visibility';
import type { HardwareFlowReadinessLane } from '../src/lib/desktop';

const lane = (id: string, detected: boolean, devices: string[]): HardwareFlowReadinessLane => ({
  id, title: id, state: 'blocked', automation: 'automatic-read-only', detected,
  applicableDevices: devices, firmwareCandidates: [], blockers: [], nextSteps: [],
});
test('a Samsung vendor ID in normal USB mode cannot suggest Download Mode', () => {
  expect(isSamsungDownloadTransport({vendorId: 0x04e8, mode: 'usb'})).toBe(false);
  expect(isSamsungDownloadTransport({vendorId: 0x05c6, mode: 'samsung-download'})).toBe(false);
  expect(isSamsungDownloadTransport({vendorId: 0x04e8, mode: 'samsung-download'})).toBe(true);
});
test('default view contains only target-bound detected lanes, including guided blockers', () => {
  const lanes = [lane('adb', true, ['device-1']), lane('absent', false, []), lane('unbound', true, [])];
  expect(visibleHardwareLanes(lanes).map(l => l.id)).toEqual(['adb']);
  expect(visibleHardwareLanes(lanes, true)).toEqual(lanes);
  expect(visibleHardwareLanes([])).toEqual([]);
});
