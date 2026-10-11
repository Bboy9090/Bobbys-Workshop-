import type { ReactNode } from 'react';

export type SamsungReadOnlyReceipt = {
  schema: 'bobfwtools.samsung.detect.v1';
  transport: string;
  detected: boolean;
  protocolSessionVerified: boolean;
  pitDownloaded: boolean;
  modelIdentityVerified: boolean;
  flashAuthorized: false;
  frpStateChanged: false;
  exitCode: number | null;
};

/** UI-only diagnostic receipt display; never executes a device command. */
export function SamsungDownloadStatus({receipt}: {receipt: SamsungReadOnlyReceipt | null}): ReactNode {
  const observed = receipt?.detected === true && receipt.exitCode === 0;
  return <section aria-label="Samsung Download Mode diagnostics" className="rounded-lg border border-slate-700 p-4">
    <h2 className="text-sm font-bold">Samsung Download Mode</h2>
    <p role="status">{observed ? 'Samsung USB observation only' : 'No verified Samsung connection'}</p>
    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
      <dt>USB observation (not Odin confirmation)</dt><dd>{observed ? 'Observed' : 'Not verified'}</dd>
      <dt>Protocol session</dt><dd>{receipt?.protocolSessionVerified ? 'Reported; verify evidence' : 'Not verified'}</dd>
      <dt>PIT retrieval</dt><dd>{receipt?.pitDownloaded ? 'Reported; verify evidence' : 'Not verified'}</dd>
      <dt>Exact model</dt><dd>{receipt?.modelIdentityVerified ? 'Reported; verify evidence' : 'Not verified'}</dd>
      <dt>Flash readiness</dt><dd>Blocked — independent qualification required</dd>
      <dt>FRP state</dt><dd>Not modified by this diagnostic</dd>
    </dl>
  </section>;
}
