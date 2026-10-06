import { invoke } from '@tauri-apps/api/core';

export type MtpStorageSummary = {
  description: string;
  freeSpaceBytes: number;
};

export type MtpStatus = {
  connected: boolean;
  manufacturer: string;
  model: string;
  serialNumber: string;
  deviceFamily: string;
  storages: MtpStorageSummary[];
  capabilities: string[];
  evidenceSource: string;
};

export type MtpRootObject = {
  handle: string;
  filename: string;
  isFolder: boolean;
};

export type UsbDeviceRecord = {
  deviceUid: string;
  vendorId: number;
  productId: number;
  manufacturer?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
  class: number;
  subclass: number;
  protocol: number;
  busNumber: number;
  deviceAddress: number;
  platformHint: string;
  mode: string;
  transport: string;
  evidenceSource: string;
};

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getNativeUsbDevices(): Promise<UsbDeviceRecord[]> {
  if (!isTauriRuntime()) return [];
  return invoke<UsbDeviceRecord[]>('bootforgeusb_scan');
}

export async function getMtpStatus(): Promise<MtpStatus | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke<MtpStatus>('mtp_status');
  } catch {
    return null;
  }
}

export async function listMtpRoot(storageIndex: number): Promise<MtpRootObject[]> {
  if (!isTauriRuntime()) return [];
  return invoke<MtpRootObject[]>('mtp_list_root', { storageIndex });
}

export { isTauriRuntime };
