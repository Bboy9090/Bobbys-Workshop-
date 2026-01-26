/**
 * Brand Configuration
 * 
 * Bobby's Workshop brand identity.
 * Static-first. Contextual animation only.
 * No gimmicks.
 */

// Brand colors
export const BRAND_COLORS = {
  // Primary
  cyan: '#2dd4ff',
  cyanDark: '#0891b2',
  
  // Secondary
  magenta: '#ff3dbb',
  magentaDark: '#be185d',
  
  // Accent
  yellow: '#ffd400',
  lime: '#35ff9a',
  orange: '#ff8a3d',
  violet: '#9d4edd',
  
  // Neutrals
  midnight: '#0a0a0c',
  concrete: '#12141a',
  steel: '#1a1d26',
  
  // Text
  textPrimary: '#ededed',
  textSecondary: '#b8b8b8',
  textMuted: '#6b7280',
} as const;

// Typography
export const TYPOGRAPHY = {
  display: "'Bebas Neue', 'Impact', sans-serif",
  body: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'Space Mono', 'Menlo', 'Monaco', monospace",
} as const;

// Logo paths
export const LOGOS = {
  primary: '/assets/logo-primary.svg',
  wordmark: '/assets/logo-wordmark.svg',
  iconApp: '/assets/icon-app.svg',
  iconDock: '/assets/icon-dock.svg',
} as const;

// App info
export const APP_INFO = {
  name: "Bobby's Workshop",
  tagline: 'Device Repair Toolkit',
  version: '3.0.0',
  copyright: `© ${new Date().getFullYear()} Bobby's Workshop`,
} as const;

// Splash screen messages
export const SPLASH_MESSAGES = [
  'Warming up the soldering iron...',
  'Checking tool inventory...',
  'Calibrating diagnostics...',
  'Connecting to the workshop...',
  'Loading device protocols...',
  'Preparing workbench...',
] as const;

// Workshop rules
export const WORKSHOP_RULES = [
  'No shortcuts on destructive operations',
  'Always backup before you flash',
  'Verify device identity before unlock',
  'Respect the audit trail',
  'Secret Rooms require earned access',
] as const;

// Legal disclaimer
export const LEGAL_DISCLAIMER = `
Bobby's Workshop is a device repair and management tool.
Use only on devices you own or have explicit authorization to modify.
Some operations may void warranties or violate terms of service.
Always comply with local laws and regulations.
`.trim();

// Feature flags
export const FEATURES = {
  secretRooms: true,
  batchOperations: true,
  firmwareLibrary: true,
  diagnostics: true,
  offlineMode: true,
  auditLogging: true,
  soundEffects: false, // Off by default
} as const;

// Audio configuration
export const AUDIO_CONFIG = {
  enabled: false, // Off by default
  volume: 0.3,
  sounds: {
    success: '/audio/success.mp3',
    error: '/audio/error.mp3',
    warning: '/audio/warning.mp3',
    deviceConnect: '/audio/device-connect.mp3',
    deviceDisconnect: '/audio/device-disconnect.mp3',
  },
} as const;

// Animation configuration
export const ANIMATION_CONFIG = {
  // Respect user preference
  reducedMotion: typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false,
  
  // Transition durations
  durations: {
    fast: 100,
    normal: 200,
    slow: 300,
  },
  
  // Easing functions
  easings: {
    default: [0.4, 0, 0.2, 1],
    bounce: [0.68, -0.55, 0.265, 1.55],
  },
} as const;
