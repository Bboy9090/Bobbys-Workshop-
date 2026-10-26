import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const windows = await readFile('scripts/release/sign-windows-authenticode.ps1', 'utf8');
for (const required of ['WINDOWS_SIGNING_PFX_BASE64','WINDOWS_SIGNING_PFX_PASSWORD','WINDOWS_SIGNING_CERT_THUMBPRINT','signtool verify','Get-AuthenticodeSignature','deviceWriteAuthorityGranted']) {
  assert.match(windows, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
const linux = await readFile('.github/workflows/linux-keyless-signing.yml', 'utf8');
assert.match(linux, /sigstore\/cosign-installer@6f9f17788090df1f26f669e9d70d6ae9567deba6/);
assert.match(linux, /cosign-release: 'v3\.1\.4'/);
assert.match(linux, /id-token: write/);
assert.match(linux, /cosign sign-blob --yes --bundle/);
assert.match(linux, /cosign verify-blob/);
assert.match(linux, /refs\/heads\/feat\/bobfwtools-macos-foundation/);
console.log('platform signing contract passed');
