import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const workflow = await readFile('.github/workflows/bobfwtools-microsoft-store-msix.yml', 'utf8')
const builder = await readFile('scripts/release/build-bobfwtools-msix.ps1', 'utf8')

for (const required of [
  'identity_name',
  'publisher',
  'package_version',
  'workflow_dispatch',
  'WINDOWS_SIGNING_PFX_BASE64',
  'sign-windows-authenticode.ps1',
  'MICROSOFT-STORE-RECEIPT.json',
  'storeUploaded=$false',
  'storeReviewApproved=$false',
]) assert.ok(workflow.includes(required), 'workflow missing: ' + required)

for (const required of [
  'com.bobbyblanco.bobfwtools.microsoft-store-msix.v1',
  'bobfwtools.exe',
  'packagedClassicApp',
  'runFullTrust',
  'makeappx.exe',
  'storeUploaded=$false',
  'storeReviewApproved=$false',
  'deviceWriteAuthorityGranted=$false',
]) assert.ok(builder.includes(required), 'builder missing: ' + required)

assert.equal(builder.includes('com.bobbysworld.workshop'), false)
assert.equal(workflow.includes('storeReviewApproved=$true'), false)
assert.equal(workflow.includes('deviceWriteAuthorityGranted=$true'), false)

console.log('BobFWTools Microsoft Store MSIX contract: PASS')
