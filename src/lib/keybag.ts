export interface KeyContext {
  iv: string;
  key: string;
}

export interface ParsedKeybag {
  primary: KeyContext;
  secondary?: KeyContext;
  isDual: boolean;
}

function normalizeHex(hex: string): string {
  return hex
    .trim()
    .replace(/^0x/i, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = normalizeHex(hex);
  if (clean.length === 0) return new Uint8Array();
  if (clean.length % 2 !== 0) {
    throw new Error(`Invalid hex string length: ${clean.length}`);
  }

  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = clean.slice(i * 2, i * 2 + 2);
    const value = Number.parseInt(byte, 16);
    if (Number.isNaN(value)) throw new Error(`Invalid hex byte: "${byte}"`);
    out[i] = value;
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function parseHardwareKeybag(raw: Uint8Array | ArrayBuffer): KeyContext {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);

  if (bytes.length < 48) {
    throw new Error(`Incomplete keybag: expected 48 bytes, got ${bytes.length}`);
  }
  const ivPart = bytes.slice(0, 16);
  const keyPart = bytes.slice(16, 48);
  return { iv: bytesToHex(ivPart), key: bytesToHex(keyPart) };
}

export function parseExtendedKeybag(raw: Uint8Array): ParsedKeybag {
  if (raw.length === 48) {
    return { primary: parseHardwareKeybag(raw), isDual: false };
  }
  if (raw.length === 96) {
    return {
      primary: parseHardwareKeybag(raw.slice(0, 48)),
      secondary: parseHardwareKeybag(raw.slice(48, 96)),
      isDual: true,
    };
  }

  throw new Error(`Unexpected keybag size: ${raw.length} bytes (expected 48 or 96)`);
}

export function parseKeybagHex(hex: string): ParsedKeybag {
  return parseExtendedKeybag(hexToBytes(hex));
}

