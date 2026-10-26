'use strict';
// Explicit, isolated provider qualification. Never called by normal CI or a dispatcher.
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { TaskLease, GitHubLeaseStore } = require('./task-lease.cjs');
const { GitHubReceiptDestination } = require('./task-lease-destination.cjs');
async function qualify() {
  const [repository, branch, revision, credentialMode] = process.argv.slice(2);
  if (repository !== 'Bboy9090/Bobbys-Workshop-' || !/^agent-lease-qualification-[a-z0-9-]+$/.test(branch || '') || !/^[a-f0-9]{40}$/.test(revision || '')) throw Error('Explicit isolated qualification branch and full source revision required');
  if (credentialMode && credentialMode !== '--use-gh-keyring') throw Error('Unknown credential mode');
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || (credentialMode === '--use-gh-keyring' ? execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() : '');
  const store = new GitHubLeaseStore({ repository, branch, token });
  const leases = new TaskLease(store);
  const destination = new GitHubReceiptDestination(store);
  const task = 'qualification_' + randomUUID().replaceAll('-', '');
  const results = {};
  let latest;
  try {
    latest = await leases.acquire(task, 'qualification-worker-a', revision, 30);
    results.acquire = true;
    try { await leases.acquire(task, 'qualification-worker-b', revision, 30); throw Error('Unexpected competing owner'); }
    catch (error) { if (error.message !== 'Task already leased') throw error; results.competingOwnerRejected = true; }
    const stale = await store.read(task);
    latest = await leases.renew(latest, 30);
    results.renew = true;
    try { await store.compareAndSwap(task, stale.etag, { ...stale.state, sequence: stale.state.sequence + 2 }); throw Error('Unexpected stale write success'); }
    catch (error) { if (!error.message.startsWith('Lease conflict:')) throw error; results.staleProviderWriteRejected = true; }
    await leases.assertOwned(latest);
    const staleReceipt = await destination.prepare(latest, { action: 'qualification', artifactSha256: 'a'.repeat(64) });
    await delay(32000);
    try { await leases.renew(latest, 30); throw Error('Unexpected expired renewal'); }
    catch (error) { if (error.message !== 'Lease lost or expired') throw error; results.expiredRenewRejected = true; }
    const old = latest;
    latest = await leases.acquire(task, 'qualification-worker-b', revision, 30);
    if (latest.generation !== old.generation + 1) throw Error('Fencing generation did not advance');
    results.takeover = true;
    const published = await destination.publish(latest, { action: 'qualification', artifactSha256: 'b'.repeat(64) });
    results.currentReceiptPublished = true;
    try { await destination.commit(staleReceipt); throw Error('Unexpected stale receipt publication'); }
    catch (error) { if (!error.message.startsWith('Receipt conflict:')) throw error; results.staleReceiptRejected = true; }
    const receiptResponse = await store.request(`/contents/.agent/results/${task}.json?ref=${encodeURIComponent(branch)}`);
    if (!receiptResponse.ok) throw Error('Receipt verification failed');
    const receiptFile = await receiptResponse.json();
    const receipt = JSON.parse(Buffer.from(receiptFile.content, 'base64').toString('utf8'));
    if (receipt.generation !== latest.generation || receipt.artifactSha256 !== 'b'.repeat(64)) throw Error('Receipt verification failed');
    results.newOwnerReceiptPreserved = true;
    results.receiptCommit = published.commit;
    try { await leases.assertOwned(old); throw Error('Unexpected stale ownership'); }
    catch (error) { if (error.message !== 'Lease lost or expired') throw error; results.staleOwnerRejected = true; }
    await leases.release(latest);
    latest = null;
    results.release = true;
    console.log(JSON.stringify({ version: 1, repository, branch, revision, executor: process.platform + '/' + process.version, task, results, result: 'pass' }));
  } finally {
    if (latest) { try { await leases.release(latest); } catch { /* Failed/expired leases are bounded by their 30-second TTL. */ } }
  }
}
qualify().catch(error => {
  const safe = /^(Receipt |Lease |Task already leased|Provider clock unavailable|Invalid |Explicit |Unknown |Repository,)/.test(error.message) ? error.message : error.name;
  console.error('Live lease qualification failed; dispatch remains disabled. ' + safe);
  process.exitCode = 1;
});
