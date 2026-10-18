import type { HardwareFlowReadinessLane, TransportDevice } from './desktop';

// A vendor name alone never establishes a recovery transport.
export function isSamsungDownloadTransport(device: Pick<TransportDevice, 'vendorId' | 'mode'>): boolean {
  return device.vendorId === 0x04e8 && device.mode === 'samsung-download';
}

export function visibleHardwareLanes(
  lanes: HardwareFlowReadinessLane[],
  showUnavailable = false,
): HardwareFlowReadinessLane[] {
  return showUnavailable ? lanes : lanes.filter(lane => lane.detected && lane.applicableDevices.length > 0);
}
