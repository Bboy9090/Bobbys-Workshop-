export type RegisteredCommandManifest = readonly string[] | null;

export function hasRegisteredCommand(
  registeredCommands: RegisteredCommandManifest,
  command: string,
): boolean {
  return registeredCommands?.includes(command) === true;
}

export function capabilityState(
  registeredCommands: RegisteredCommandManifest,
  command: string,
): 'loading' | 'available' | 'unavailable' {
  if (registeredCommands === null) return 'loading';
  return hasRegisteredCommand(registeredCommands, command) ? 'available' : 'unavailable';
}

export function canRefreshWithManifest(
  nativeRuntime: boolean,
  registeredCommands: RegisteredCommandManifest,
): boolean {
  return !nativeRuntime || registeredCommands !== null;
}
