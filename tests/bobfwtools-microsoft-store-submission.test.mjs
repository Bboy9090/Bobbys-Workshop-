import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const workflow = await readFile('.github/workflows/bobfwtools-microsoft-store-submission.yml', 'utf8')
const client = await readFile('scripts/release/submit-bobfwtools-microsoft-store.py', 'utf8')

for (const required of [
  'package_run_id',
  'application_id',
  'confirm_submit',
  'CONFIRM_SUBMIT',
  'SUBMIT',
  'BOBFW_MS_STORE_TENANT_ID',
  'BOBFW_MS_STORE_CLIENT_ID',
  'BOBFW_MS_STORE_CLIENT_SECRET',
  'BobFWTools Microsoft Store MSIX',
  'MICROSOFT-STORE-RECEIPT.json',
  'storeUploaded"] is False',
  'storeReviewApproved"] is False',
  'submit-bobfwtools-microsoft-store.py',
]) assert.ok(workflow.includes(required), 'workflow missing: ' + required)

for (const required of [
  'https://manage.devcenter.microsoft.com/v1.0/my/applications',
  'resource',
  'https://manage.devcenter.microsoft.com',
  'PendingUpload',
  'fileUploadUrl',
  'applicationPackages',
  'partner-center-upload.zip',
  '/commit',
  '/status',
  'partnerCenterUploadCompleted',
  'submissionCommitted',
  'microsoftCertificationPassed',
  'storePublished',
  'deviceWriteAuthorityGranted',
]) assert.ok(client.includes(required), 'submission client missing: ' + required)

assert.equal(client.includes('"microsoftCertificationPassed": True'), false)
assert.equal(client.includes('"storePublished": True'), false)
assert.ok(client.includes('if not committed:'))
assert.ok(client.includes('"DELETE"'))

console.log('BobFWTools Microsoft Store submission contract: PASS')
