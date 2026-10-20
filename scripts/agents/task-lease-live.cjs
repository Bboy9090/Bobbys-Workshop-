'use strict';
// Explicit, isolated provider qualification. Never called by normal CI or a dispatcher.
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { TaskLease, GitHubLeaseStore } = require('./task-lease.cjs');
async function qualify() {
  const [repository, branch, revision, credentialMode] = process.argv.slice(2);
  if (repository !== 'Bboy9090/Bobbys-Workshop-' || !/^agent-lease-qualification-[a-z0-9-]+$/.test(branch || '') || !/^[a-f0-9]{40}$/.test(revision || '')) throw Error('Explicit isolated qualification branch and full source revision required');
  if (credentialMode && credentialMode !== '--use-gh-keyring') throw Error('Unknown credential mode');
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || (credentialMode === '--use-gh-keyring' ? execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() : '');
  const store = new GitHubLeaseStore({ repository, branch, token });
  const leases = new TaskLease(store);
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
    await delay(32000);
    try { await leases.renew(latest, 30); throw Error('Unexpected expired renewal'); }
    catch (error) { if (error.message !== 'Lease lost or expired') throw error; results.expiredRenewRejected = true; }
    const old = latest;
    latest = await leases.acquire(task, 'qualification-worker-b', revision, 30);
    if (latest.generation !== old.generation + 1) throw Error('Fencing generation did not advance');
    results.takeover = true;
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
qualify().catch(() => { console.error('Live lease qualification failed; dispatch remains disabled.'); process.exitCode = 1; });
