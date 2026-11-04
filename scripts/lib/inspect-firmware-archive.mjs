import { open, lstat } from 'node:fs/promises';

/** Minimal ZIP signature inspection. Does not decompress or certify archive authenticity. */
export async function inspectFirmwareArchive(path) {
  if (typeof path !== 'string' || !path.trim()) throw Error('Archive path required');
  const stats = await lstat(path);
  if (!stats.isFile() || stats.isSymbolicLink()) throw Error('A non-symlink regular file is required');
  const handle = await open(path, 'r');
  try {
    const st = await handle.stat();
    if (st.size < 4) return {format:'unknown',sizeBytes:st.size,extractable:false,flashAuthorized:false};
    const prefix = Buffer.alloc(4);
    await handle.read(prefix,0,4,0);
    const signature = prefix.toString('hex');
    // Local file header, empty archive EOCD, and spanned archive descriptor.
    const format = signature === '504b0304' ? 'zip-local-header'
      : signature === '504b0506' ? 'zip-empty-marker'
      : signature === '504b0708' ? 'zip-spanned-marker' : 'unknown';
    return {format,sizeBytes:st.size,extractable:false,flashAuthorized:false,
      metadataOnly:true,structuralIntegrityVerified:false,oemSignatureVerified:false};
  } finally { await handle.close(); }
}
