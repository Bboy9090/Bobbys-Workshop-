/**
 * APARTMENT ROOM TYPES
 * 
 * Physical layer canon for Bobby's Secret Workshop.
 * Each room has specific access rules and capabilities.
 */

/**
 * The physical layers of the apartment
 */
export type ApartmentLayer = 
  | 'front-room'      // Phoenix Forge surface (public)
  | 'back-room'       // Codex access (passcode required)
  | 'closet'          // Phoenix Keys (confirmation required)
  | 'floor-trap'      // Local tooling (contextual)
  | 'ceiling-hatch'   // Warp routing (system-controlled)
  | 'basement';       // BootForge USB (code-only)

/**
 * Room visibility states
 */
export type RoomVisibility = 
  | 'always'          // Front Room
  | 'conditional'     // Back Room, Floor Trap
  | 'hidden'          // Ceiling Hatch
  | 'code-only';      // Basement

/**
 * Room access methods
 */
export type RoomAccessMethod =
  | 'direct'          // Front Room
  | 'passcode'        // Back Room
  | 'confirmation'    // Closet
  | 'context'         // Floor Trap
  | 'system'          // Ceiling Hatch
  | 'code';           // Basement

/**
 * Room definition
 */
export interface ApartmentRoom {
  id: ApartmentLayer;
  name: string;
  description: string;
  visibility: RoomVisibility;
  accessMethod: RoomAccessMethod;
  persistence: 'permanent' | 'session' | 'action' | 'ephemeral' | 'invisible';
  capabilities: string[];
  rules: string[];
}

/**
 * The apartment room registry
 */
export const APARTMENT_ROOMS: Record<ApartmentLayer, ApartmentRoom> = {
  'front-room': {
    id: 'front-room',
    name: 'Front Room',
    description: 'Phoenix Forge surface - professional device repair interface',
    visibility: 'always',
    accessMethod: 'direct',
    persistence: 'permanent',
    capabilities: [
      'dashboard',
      'device-management',
      'flash-forge',
      'case-management',
      'workflows',
      'settings',
    ],
    rules: [
      'Customer-safe operations only',
      'Full confirmation for destructive actions',
      'Complete audit trail',
      'Professional presentation',
    ],
  },

  'back-room': {
    id: 'back-room',
    name: 'Back Room',
    description: 'Codex access - intelligence and analysis',
    visibility: 'conditional',
    accessMethod: 'passcode',
    persistence: 'session',
    capabilities: [
      'sonic-codex',
      'ghost-codex',
      'pandora-codex',
    ],
    rules: [
      'Codex rooms NEVER execute blindly',
      'Observe, Classify, Recommend, Hand off only',
      'Execution through Front Room or Phoenix Key',
      'Analysis is read-only by default',
    ],
  },

  'closet': {
    id: 'closet',
    name: 'Closet',
    description: 'Phoenix Keys - bootable recovery media creation',
    visibility: 'conditional',
    accessMethod: 'confirmation',
    persistence: 'action',
    capabilities: [
      'phoenix-key-builder',
      'usb-imaging',
      'boot-repair',
      'state-freeze',
    ],
    rules: [
      'Physical action required (USB insertion)',
      'Offline-capable operations',
      'Signed and controlled output',
      'No network required for core function',
    ],
  },

  'floor-trap': {
    id: 'floor-trap',
    name: 'Floor Trap',
    description: 'Local tooling - advanced device operations',
    visibility: 'conditional',
    accessMethod: 'context',
    persistence: 'ephemeral',
    capabilities: [
      'root-vault',
      'bypass-laboratory',
      'jailbreak-sanctum',
      'shadow-archive',
      'unlock-chamber',
    ],
    rules: [
      'Trapdoors are CONTEXTUAL',
      'Only visible when conditions met',
      'Never bookmarked, never direct-linked',
      'Requires: device + operator + local verification',
    ],
  },

  'ceiling-hatch': {
    id: 'ceiling-hatch',
    name: 'Ceiling Hatch',
    description: 'Warp routing - emergency and context-aware navigation',
    visibility: 'hidden',
    accessMethod: 'system',
    persistence: 'invisible',
    capabilities: [
      'emergency-exit',
      'cross-room-warp',
      'context-preservation',
      'fallback-routing',
    ],
    rules: [
      'Invisible to users',
      'Activated by system conditions',
      'Preserves audit trail across warps',
      'Never interrupts critical operations',
    ],
  },

  'basement': {
    id: 'basement',
    name: 'Basement',
    description: 'BootForge USB layer - raw hardware interaction',
    visibility: 'code-only',
    accessMethod: 'code',
    persistence: 'invisible',
    capabilities: [
      'libbootforge',
      'usb-enumeration',
      'driver-management',
      'platform-bindings',
    ],
    rules: [
      'Never directly exposed to UI',
      'All access through Phoenix Core',
      'Rust-only implementation',
      'Security boundary maintained',
    ],
  },
};

/**
 * Get room by layer
 */
export function getRoom(layer: ApartmentLayer): ApartmentRoom {
  return APARTMENT_ROOMS[layer];
}

/**
 * Check if a room is accessible from current context
 */
export function isRoomAccessible(
  layer: ApartmentLayer,
  context: {
    hasPasscode: boolean;
    devicePresent: boolean;
    operatorVerified: boolean;
    localEnvironment: boolean;
  }
): boolean {
  const room = getRoom(layer);

  switch (room.accessMethod) {
    case 'direct':
      return true;
    
    case 'passcode':
      return context.hasPasscode;
    
    case 'confirmation':
      return context.hasPasscode;
    
    case 'context':
      return (
        context.hasPasscode &&
        context.devicePresent &&
        context.operatorVerified &&
        context.localEnvironment
      );
    
    case 'system':
      return false; // System-controlled, not user-accessible
    
    case 'code':
      return false; // Code-only, not UI-accessible
    
    default:
      return false;
  }
}
