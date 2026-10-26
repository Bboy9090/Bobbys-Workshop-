import {createHash} from 'node:crypto';

export const packageKinds = {
  windows: ['msi', 'nsis'],
  linux: ['appimage', 'deb'],
};

// Binary fixtures belong in tests only. Release callers must supply the actual
// built or installer-copied executable bytes and a full, immutable revision.
export function inspectStandardExecutable(bytes, revision, platform) {
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('Full lowercase source SHA required');
  if (!Buffer.isBuffer(bytes) || !bytes.includes(Buffer.from(revision))) throw new Error('Executable source revision mismatch');
  for (const marker of ['bootforge_qualified_fastboot_devices', 'issue-qualified-flash-grant']) {
    if (bytes.includes(Buffer.from(marker))) throw new Error('Qualified destructive writer is not a public release artifact');
  }
  if (platform === 'windows') {
    if (bytes.length < 64 || bytes.toString('ascii', 0, 2) !== 'MZ') throw new Error('Expected Windows PE executable');
    const offset = bytes.readUInt32LE(60);
    if (offset + 6 > bytes.length || bytes.readUInt32LE(offset) !== 0x00004550 || bytes.readUInt16LE(offset + 4) !== 0x8664) {
      throw new Error('Expected x86_64 PE architecture');
    }
  } else if (platform === 'linux') {
    if (bytes.length < 20 || bytes.toString('hex', 0, 4) !== '7f454c46' || bytes[4] !== 2 || bytes[5] !== 1 || bytes.readUInt16LE(18) !== 62) {
      throw new Error('Expected x86_64 ELF architecture');
    }
  } else throw new Error('Unsupported package platform');
  return {architecture: 'x86_64', sha256: createHash('sha256').update(bytes).digest('hex'), qualifiedDestructiveWriterIncluded: false};
}

export function requirePackageSet(platform, artifacts) {
  const kinds = packageKinds[platform];
  if (!kinds || kinds.some(kind => artifacts.filter(item => item.kind === kind).length !== 1) || artifacts.length !== kinds.length) {
    throw new Error('Exactly one of each required platform installer is required');
  }
  if (new Set(artifacts.map(item => item.path)).size !== artifacts.length || artifacts.some(item => !/^[a-f0-9]{64}$/.test(item.sha256 ?? '') || !(item.bytes > 0))) {
    throw new Error('Distinct nonempty installers with SHA-256 evidence required');
  }
}
