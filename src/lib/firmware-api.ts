// Firmware API - Handles firmware discovery, version checking, and downloads
// Part of Bobby's World toolkit

import type { 
  FirmwareInfo, 
  FirmwareDatabase, 
  FirmwareCheckResult, 
  BrandFirmwareList,
  FirmwareVersion 
} from '../types/firmware';

const API_BASE = '/api/v1/firmware/library';

/**
 * Groups raw firmware entry objects into structured FirmwareDatabase records by brand and model.
 *
 * @param entries - Array of firmware entry objects. Each object may include properties: `brand`, `model`, `version`, `releaseDate` or `updatedAt` (build date), `securityPatch`, `filename` (build number), `downloadUrl`, and `description`.
 * @returns An array of FirmwareDatabase objects where each item represents a unique brand/model and contains `versions` (array of FirmwareVersion), `latestVersion`, `latestBuildDate`, optional `officialDownloadUrl`, and optional `notes`.
 */
function groupFirmwareEntries(entries: any[]): FirmwareDatabase[] {
  const grouped = new Map<string, FirmwareDatabase>();

  entries.forEach((entry) => {
    const brand = entry.brand || 'Unknown';
    const model = entry.model || 'Unknown';
    const key = `${brand}::${model}`;
    const version: FirmwareVersion = {
      version: entry.version || 'unknown',
      buildDate: entry.releaseDate || entry.updatedAt || null,
      securityPatch: entry.securityPatch || null,
      buildNumber: entry.filename || null
    };

    if (!grouped.has(key)) {
      grouped.set(key, {
        brand,
        model,
        versions: [],
        latestVersion: version.version,
        latestBuildDate: version.buildDate || undefined,
        officialDownloadUrl: entry.downloadUrl || undefined,
        notes: entry.description || undefined
      });
    }

    const record = grouped.get(key)!;
    record.versions.push(version);
    if (version.buildDate && (!record.latestBuildDate || version.buildDate > record.latestBuildDate)) {
      record.latestBuildDate = version.buildDate;
      record.latestVersion = version.version;
      record.officialDownloadUrl = entry.downloadUrl || record.officialDownloadUrl;
    }
  });

  return Array.from(grouped.values());
}

/**
 * Retrieve the list of brands that have firmware entries.
 *
 * @returns An array of brand names present in the firmware library; returns an empty array if no brands are found.
 * @throws Error with message 'Firmware service unavailable' if the firmware service cannot be reached or returns an error.
 */
export async function getAllBrandsWithFirmware(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE}/brands`);
    if (!response.ok) {
      throw new Error('Firmware service unavailable');
    }
    const payload = await response.json();
    if (!payload.ok) {
      throw new Error(payload.error?.message || 'Firmware service unavailable');
    }
    return payload.data.brands || [];
  } catch (err) {
    throw new Error('Firmware service unavailable');
  }
}

/**
 * Fetches and returns available firmware models and their versions for the specified brand.
 *
 * @returns An object with the requested `brand` and a `models` array; each model contains `model`, `versions`, `latestVersion`, and `downloadUrls`.
 * @throws Error with message 'Firmware service unavailable' when the firmware service is unreachable or returns an error.
 */
export async function getBrandFirmwareList(brand: string): Promise<BrandFirmwareList> {
  try {
    const response = await fetch(`${API_BASE}/search?brand=${encodeURIComponent(brand)}`);
    if (!response.ok) {
      throw new Error('Firmware service unavailable');
    }
    const payload = await response.json();
    if (!payload.ok) {
      throw new Error(payload.error?.message || 'Firmware service unavailable');
    }

    const entries = payload.data.results || [];
    const grouped = groupFirmwareEntries(entries);
    const models = grouped.map((entry) => ({
      model: entry.model,
      versions: entry.versions,
      latestVersion: entry.latestVersion,
      downloadUrls: entry.officialDownloadUrl ? [entry.officialDownloadUrl] : []
    }));

    return {
      brand,
      models
    };
  } catch (err) {
    throw new Error('Firmware service unavailable');
  }
}

/**
 * Searches the firmware library and returns grouped firmware entries that match the query.
 *
 * Queries the firmware service, groups raw entries by brand and model, and filters results so that
 * any brand, model, or version string containing the normalized query is returned. If `query` is
 * empty or whitespace, all grouped entries are returned.
 *
 * @param query - Search term used to filter results by brand, model, or version
 * @returns An array of grouped FirmwareDatabase objects matching the query
 * @throws 'Firmware service unavailable' if the firmware service is unreachable or returns an error
 */
export async function searchFirmware(query: string): Promise<FirmwareDatabase[]> {
  try {
    const response = await fetch(`${API_BASE}/search`);
    if (!response.ok) {
      throw new Error('Firmware service unavailable');
    }
    const payload = await response.json();
    if (!payload.ok) {
      throw new Error(payload.error?.message || 'Firmware service unavailable');
    }

    const entries = payload.data.results || [];
    const grouped = groupFirmwareEntries(entries);
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return grouped;
    }

    return grouped.filter((entry) =>
      entry.brand.toLowerCase().includes(normalized) ||
      entry.model.toLowerCase().includes(normalized) ||
      entry.versions.some((version) => version.version.toLowerCase().includes(normalized))
    );
  } catch (err) {
    throw new Error('Firmware service unavailable');
  }
}

/**
 * Provides a placeholder firmware check result for a single device serial.
 *
 * @param deviceSerial - The device serial to check
 * @returns A FirmwareCheckResult with `success` set to `false`, `error` set to "Firmware check endpoint not available", and `timestamp` set to the current time
 */
export async function checkDeviceFirmware(deviceSerial: string): Promise<FirmwareCheckResult> {
  return {
    deviceSerial,
    success: false,
    error: 'Firmware check endpoint not available',
    timestamp: Date.now()
  };
}

/**
 * Check firmware status for a list of device serials.
 *
 * @param deviceSerials - Array of device serial numbers to check
 * @returns An array of FirmwareCheckResult objects corresponding to each input serial, in the same order
 */
export async function checkMultipleDevicesFirmware(
  deviceSerials: string[]
): Promise<FirmwareCheckResult[]> {
  const results: FirmwareCheckResult[] = [];
  
  for (const serial of deviceSerials) {
    const result = await checkDeviceFirmware(serial);
    results.push(result);
  }
  
  return results;
}

/**
 * Retrieve consolidated firmware metadata for a specific brand and model.
 *
 * @returns A `FirmwareDatabase` object for the specified brand and model, or `null` if no entries are found.
 * @throws Error with message 'Firmware info service unavailable' when the firmware service is unavailable or returns an invalid response.
 */
export async function getFirmwareInfo(brand: string, model: string): Promise<FirmwareDatabase | null> {
  try {
    const response = await fetch(
      `${API_BASE}/search?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`
    );
    if (!response.ok) {
      throw new Error('Firmware info service unavailable');
    }
    const payload = await response.json();
    if (!payload.ok) {
      throw new Error(payload.error?.message || 'Firmware info service unavailable');
    }
    const entries = payload.data.results || [];
    const grouped = groupFirmwareEntries(entries);
    return grouped[0] || null;
  } catch (err) {
    throw new Error('Firmware info service unavailable');
  }
}

/**
 * Requests the server to initiate a download of a specific firmware version for a brand/model.
 *
 * @param brand - The firmware brand name
 * @param model - The device model identifier
 * @param version - The firmware version to download
 * @param onProgress - Optional callback invoked with progress percentage (0–100) if progress updates are delivered
 * @returns A Blob containing the downloaded firmware, or `null` when the server handles the download asynchronously
 * @throws When the server responds with an error or the response payload indicates failure
 */
export async function downloadFirmware(
  brand: string, 
  model: string, 
  version: string,
  onProgress?: (progress: number) => void
): Promise<Blob | null> {
  const response = await fetch(`${API_BASE}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand, model, version })
  });

  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error?.message || 'Firmware download failed');
  }

  // Downloads are handled server-side; return null to indicate async completion.
  return null;
}