// Network-only OEM catalog reachability. Never downloads firmware artifacts.
import { discoverOfficialFirmwareSources } from './oem-source-discovery.ts';

export type CatalogProbe = {
  manufacturer: string;
  model: string;
  url: string;
  httpStatus: number | null;
  reachable: boolean;
  checkedAt: string;
  packageCount: null;
  packageVerified: false;
  error: string | null;
};
export async function probeOfficialSources(manufacturer: string, model: string,
  fetcher: typeof fetch = fetch): Promise<CatalogProbe[]> {
  const sources = discoverOfficialFirmwareSources(manufacturer, model);
  return Promise.all(sources.map(async source => {
    const result: CatalogProbe = {
      manufacturer: source.manufacturer, model: source.model, url: source.sourceUrl,
      httpStatus: null, reachable: false, checkedAt: new Date().toISOString(),
      packageCount: null, packageVerified: false, error: null,
    };
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 10000);
    try {
      // Manual redirects prevent following source-site redirects onto arbitrary domains.
      const response = await fetcher(source.sourceUrl, {
        method: 'HEAD', redirect: 'manual', signal: abort.signal,
      });
      result.httpStatus = response.status;
      result.reachable = response.status >= 200 && response.status < 300;
      if (!result.reachable) result.error = 'Catalog returned HTTP ' + response.status;
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Network probe failed';
    } finally {
      clearTimeout(timeout);
    }
    return result;
  }));
}
