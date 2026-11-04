import type { ReactNode } from 'react';
import { capabilityState } from '../../lib/featureGates';

export interface FeatureGateProps {
  requiredCommand: string;
  registeredCommands: readonly string[] | null;
  children: ReactNode;
  fallbackMessage?: string;
}

export function FeatureGate({
  requiredCommand,
  registeredCommands,
  children,
  fallbackMessage,
}: FeatureGateProps) {
  const state = capabilityState(registeredCommands, requiredCommand);
  if (state === 'available') return <>{children}</>;

  const loading = state === 'loading';
  return (
    <section
      role="status"
      aria-label={loading ? 'Capability loading' : 'Unavailable capability'}
      className="my-3 rounded border-l-4 border-amber-500 bg-slate-800 p-4 text-sm text-slate-200"
    >
      <strong>{loading ? 'Checking capability availability' : 'Capability unavailable in this edition'}</strong>
      <p className="mt-2 text-slate-300">
        {loading
          ? 'The native command manifest is still loading.'
          : fallbackMessage ?? 'This operation is not enabled in this edition. Available read-only diagnostics remain usable.'}
      </p>
    </section>
  );
}
