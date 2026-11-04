/** OEM source discovery. This is NOT a package catalog or firmware downloader. */
export type CatalogSource = {
  manufacturer: string;
  model: string;
  sourceName: string;
  sourceUrl: string;
  kind: 'official-ota-catalog' | 'official-factory-image-catalog';
  matchStatus: 'source-available-model-unverified';
  packageVerified: false;
  warnings: string[];
};

const PIXEL_OTA = 'https://developers.google.com/android/ota';
const PIXEL_IMAGES = 'https://developers.google.com/android/images';

/**
 * Discover legitimate manufacturer-owned firmware catalog pages.
 * No model/build is marked as available until a trusted, exact release manifest
 * has been independently parsed and verified (not implemented here).
 */
export function discoverOfficialFirmwareSources(manufacturer: string, model: string): CatalogSource[] {
  const maker = manufacturer.trim().toLowerCase();
  const exactModel = model.trim();
  if (!exactModel || exactModel.length > 80 || !/^[\p{L}\p{N} ._+()-]+$/u.test(exactModel)) return [];
  if (!['google', 'google pixel'].includes(maker) || !/^pixel(?:[ -][a-z0-9 .+()-]+)?$/i.test(exactModel)) return [];
  const common = {
    manufacturer: 'Google',
    model: exactModel,
    matchStatus: 'source-available-model-unverified' as const,
    packageVerified: false as const,
    warnings: [
      'Catalog source only: exact model, device codename and build have not been matched',
      'No firmware file, hash, signature or rollback compatibility has been verified',
      'Read and accept Google terms directly on its website before downloading',
    ],
  };
  return [
    { ...common, sourceName:'Google Pixel Full OTA', sourceUrl:PIXEL_OTA, kind:'official-ota-catalog' },
    { ...common, sourceName:'Google Pixel Factory Images', sourceUrl:PIXEL_IMAGES, kind:'official-factory-image-catalog' },
  ];
}
