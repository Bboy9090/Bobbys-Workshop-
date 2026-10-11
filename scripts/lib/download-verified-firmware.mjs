import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, lstat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { basename, dirname, join } from 'node:path';

const HEX = /^[a-f0-9]{64}$/i;
const ALLOWED_HOSTS = new Set(['dl.google.com', 'developers.google.com']);
const MAX_BYTES = 12 * 1024 ** 3;

/** Download bytes from a tightly restricted OEM host, verify them, then atomically publish. */
export async function downloadVerifiedFirmware({url, destination, expectedSha256, fetcher = fetch, onProgress}) {
  const address = new URL(url);
  if (address.protocol !== 'https:' || !ALLOWED_HOSTS.has(address.hostname) ||
      address.username || address.password || address.port || !HEX.test(expectedSha256 ?? ''))
    throw Error('Official allowlisted HTTPS URL and trusted SHA-256 are required');
  if (!destination || basename(destination) !== destination.split('/').at(-1) ||
      !basename(destination) || basename(destination) === '.' || basename(destination) === '..')
    throw Error('A destination file path is required');
  const targetDir = dirname(destination);
  await mkdir(targetDir, {recursive: true});
  try { await lstat(destination); throw Error('Destination already exists; refusing overwrite'); }
  catch (e) { if (e?.code !== 'ENOENT') throw e; }
  const temporary = join(targetDir, '.bobfwtools-' + randomUUID() + '.partial');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 10 * 60 * 1000);
  let received = 0;
  const hash = createHash('sha256');
  try {
    const response = await fetcher(address.href, {method:'GET',redirect:'manual',signal:abort.signal});
    if (response.status !== 200 || !response.body) throw Error('OEM download response must be HTTP 200 with a body');
    const length = response.headers?.get?.('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES))
      throw Error('Firmware package exceeds size limit');
    const tracker = new Transform({
      transform(chunk, encoding, callback) {
        received += chunk.length;
        if (received > MAX_BYTES) return callback(Error('Firmware package exceeds size limit'));
        hash.update(chunk);
        onProgress?.(received);
        callback(null, chunk);
      }
    });
    await pipeline(Readable.fromWeb(response.body), tracker,
      createWriteStream(temporary, {flags:'wx',mode:0o600}));
    if (length && received !== Number(length)) throw Error('Incomplete download');
    const actualSha256 = hash.digest('hex');
    if (actualSha256 !== expectedSha256.toLowerCase()) throw Error('SHA-256 mismatch; downloaded bytes discarded');
    // No overwrite. Publishing after verification does not establish OEM signing or hardware fitness.
    try { await lstat(destination); throw Error('Destination appeared during download'); }
    catch (e) { if (e?.code !== 'ENOENT') throw e; }
    await rename(temporary, destination);
    return {destination, bytes:received, sha256:actualSha256, checksumMatched:true,
      oemSignatureVerified:false, deviceCompatible:false, flashAuthorized:false};
  } finally {
    clearTimeout(timer);
    await rm(temporary,{force:true}).catch(()=>{});
  }
}
