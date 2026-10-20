import type { UsbDeviceRecord } from './desktop';

// USB enumeration includes host controllers and peripherals. A vendor name alone
// never makes one of them a phone or establishes a usable service protocol.
export function isAndroidUsbCandidate(
  device: Pick<UsbDeviceRecord, 'platformHint' | 'mode'>,
): boolean {
  return device.platformHint.startsWith('android-') ||
    ['adb', 'mtp', 'fastboot', 'samsung-download', 'qualcomm-edl',
      'mediatek-brom', 'mediatek-preloader'].includes(device.mode);
}
