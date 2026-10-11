import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';

const HEX = /^[a-f0-9]{64}$/i;

/**
 * Stream-hash a local firmware artifact without loading it into memory.
 * Never executes, unpacks, changes, or flashes the file.
 */
export async function verifyFirmwareFile(path, expectedSha256) {
  if (typeof path !== 'string' || !path.trim()) throw Error('Local file path required');
  if (typeof expectedSha256 !== 'string' || !HEX.test(expectedSha256))
    throw Error('A complete 64-character SHA-256 reference is required');
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink()) throw Error('Only a regular, non-symlink file can be verified');
  const resolved = await realpath(path);
  const hash = createHash('sha256');
  let bytesRead = 0;
  for await (const chunk of createReadStream(resolved)) {
    bytesRead += chunk.length;
    hash.update(chunk);
  }
  const after = await lstat(path);
  if (!after.isFile() || after.isSymbolicLink() || before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs || before.ino !== after.ino || bytesRead !== before.size)
    throw Error('File changed during hashing; evidence rejected');
  const actualSha256 = hash.digest('hex');
  return {
    file: resolved,
    sizeBytes: bytesRead,
    expectedSha256: expectedSha256.toLowerCase(),
    actualSha256,
    checksumMatched: actualSha256 === expectedSha256.toLowerCase(),
    oemSignatureVerified: false,
    deviceCompatible: false,
    flashAuthorized: false,
  };
}
