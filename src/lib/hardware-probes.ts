export type HardwareProbeFailure = { probe: string; message: string };

// A failed or stalled read-only probe must not erase successful observations.
export async function runHardwareProbe<T>(
  probe: string,
  run: () => Promise<T>,
  fallback: T,
  failures: HardwareProbeFailure[],
  timeoutMs = 12000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(run),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Read-only probe timed out; status is unverified.')), timeoutMs);
      }),
    ]);
  } catch (error) {
    failures.push({ probe, message: error instanceof Error ? error.message : String(error) });
    return fallback;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Coalesce unfinished native probes across UI timeouts; timeout is not cancellation. */
export function createReadOnlyProbeRunner() {
  const pending = new Map<string, Promise<unknown>>();
  return <T>(
    probe: string, run: () => Promise<T>, fallback: T,
    failures: HardwareProbeFailure[], timeoutMs = 12000,
  ): Promise<T> => runHardwareProbe(probe, () => {
    let task = pending.get(probe) as Promise<T> | undefined;
    if (!task) {
      task = Promise.resolve().then(run);
      pending.set(probe, task);
      const settled = () => {
        if (pending.get(probe) === task) pending.delete(probe);
      };
      void task.then(settled, settled);
    }
    return task;
  }, fallback, failures, timeoutMs);
}
