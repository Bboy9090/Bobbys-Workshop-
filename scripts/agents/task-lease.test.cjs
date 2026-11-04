'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TaskLease, GitHubLeaseStore } = require('./task-lease.cjs');
const revision = 'a'.repeat(40);
function fixture() {
  let state = null, version = 0, now = 1000000;
  const store = { async read() { return { state: state && structuredClone(state), etag: version, now }; },
    async compareAndSwap(task, etag, next) { assert.equal(etag, version, 'conflict'); state = structuredClone(next); version++; } };
  return { leases: new TaskLease(store), advance(ms) { now += ms; }, corrupt(value) { state = value; } };
}
test('twenty concurrent contenders yield exactly one owner', async () => {
  const { leases } = fixture(); const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => leases.acquire('rec123', 'worker' + i, revision)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});
test('renewal preserves identity and advances sequence; release allows a new fenced generation', async () => {
  const { leases, advance } = fixture(); const first = await leases.acquire('rec123', 'worker1', revision, 30);
  advance(1000); const renewed = await leases.renew(first, 60); assert.equal(renewed.token, first.token); assert.equal(renewed.sequence, 2);
  await leases.release(renewed); const next = await leases.acquire('rec123', 'worker2', revision); assert.equal(next.generation, 2);
  await assert.rejects(leases.assertOwned(first), /lost/); await assert.rejects(leases.release(first), /lost/);
});
test('expired workers cannot renew or release; takeover advances generation', async () => {
  const { leases, advance } = fixture(); const first = await leases.acquire('rec123', 'worker', revision, 30);
  advance(30000); await assert.rejects(leases.renew(first), /expired/); await assert.rejects(leases.release(first), /expired/);
  assert.equal((await leases.acquire('rec123', 'worker2', revision)).generation, 2);
});
test('altered identity or revision fails ownership checks', async () => {
  const { leases } = fixture(); const claim = await leases.acquire('rec123', 'worker', revision);
  for (const change of [{ token: 'wrong' }, { owner: 'other' }, { revision: 'b'.repeat(40) }, { generation: 2 }]) await assert.rejects(leases.assertOwned({ ...claim, ...change }), /lost/);
});
test('invalid identifiers, source, TTL and corrupt stored data fail closed', async () => {
  const { leases, corrupt } = fixture();
  for (const task of ['../escape', '', 'x/y']) await assert.rejects(leases.acquire(task, 'worker', revision));
  await assert.rejects(leases.acquire('rec123', 'worker', 'invalid'));
  for (const ttl of [0, 29, 3601, NaN]) await assert.rejects(leases.acquire('rec123', 'worker', revision, ttl));
  corrupt({ version: 1 }); await assert.rejects(leases.acquire('rec123', 'worker', revision), /Invalid lease/);
});
test('network failure never grants ownership', async () => {
  const leases = new TaskLease({ read: async () => { throw Error('offline'); } }); await assert.rejects(leases.acquire('rec123', 'worker', revision), /offline/);
});
function provider(responses) {
  const calls = []; const store = new GitHubLeaseStore({ repository: 'owner/repo', branch: 'lease-state', token: 'runtime-test-only', fetchImpl: async (url, options) => { calls.push({ url, options }); const response = responses.shift(); if (!response) throw Error('unexpected request'); return new Response(response.body || '', { status: response.status || 200, headers: response.headers || { date: 'Tue, 20 Oct 2026 02:00:00 GMT' } }); } });
  return { store, calls };
}
test('GitHub adapter uses provider time and SHA precondition, with token only in header', async () => {
  const claim = await fixture().leases.acquire('rec123', 'worker', revision);
  const sha = 'b'.repeat(40); const { store, calls } = provider([{}, { body: JSON.stringify({ encoding: 'base64', sha, content: Buffer.from(JSON.stringify(claim)).toString('base64') }) }, {}]);
  const snapshot = await store.read('rec123'); assert.equal(snapshot.now, Date.parse('2026-10-20T02:00:00Z')); await store.compareAndSwap('rec123', snapshot.etag, claim);
  const put = calls[2]; assert.equal(JSON.parse(put.options.body).sha, sha); assert.equal(put.options.method, 'PUT'); assert.equal(put.options.redirect, 'error'); assert.ok(!put.url.includes('runtime-test-only')); assert.ok(!put.options.body.includes('runtime-test-only'));
});
test('missing branch is not treated as a free lease', async () => { const { store } = provider([{ status: 404 }]); await assert.rejects(store.read('rec123'), /branch unavailable/); });
test('missing file in existing branch permits conditional creation', async () => { const { store } = provider([{}, { status: 404 }]); assert.equal((await store.read('rec123')).etag, null); });
test('provider clock required, and access errors are not empty leases', async () => {
  for (const response of [{ headers: {} }, { status: 403 }, { status: 500 }]) { const { store } = provider([{}, response]); await assert.rejects(store.read('rec123')); }
});
test('GitHub conflict and access denial never become success', async () => {
  const claim = await fixture().leases.acquire('rec123', 'worker', revision);
  for (const status of [409, 422, 401, 403, 500]) { const { store } = provider([{ status }]); await assert.rejects(store.compareAndSwap('rec123', null, claim)); }
});

test('falsy malformed state and unexpected fields cannot reset fencing history', async () => {
  for (const value of [false, 0, '', undefined]) {
    const { leases, corrupt } = fixture(); corrupt(value); await assert.rejects(leases.acquire('rec123', 'worker', revision), /Invalid lease/);
  }
  const { leases, corrupt } = fixture(); const claim = await leases.acquire('rec123', 'worker', revision);
  corrupt({ ...claim, extra: 'not permitted' }); await assert.rejects(leases.assertOwned(claim), /Invalid lease/);
});

test('live qualifier refuses production branches and unknown credential modes before authentication', () => {
  const { spawnSync } = require('node:child_process');
  const { join } = require('node:path');
  for (const args of [
    ['Bboy9090/Bobbys-Workshop-', 'main-tool-kit', revision, '--use-gh-keyring'],
    ['Bboy9090/Bobbys-Workshop-', 'agent-lease-qualification-test', revision, '--unknown-mode'],
  ]) {
    const result = spawnSync(process.execPath, [join(__dirname, 'task-lease-live.cjs'), ...args], { encoding: 'utf8', timeout: 15000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1); assert.equal(result.stdout, '');
    assert.match(result.stderr, /Explicit isolated|Unknown credential mode/);
  }
});

const { GitHubReceiptDestination } = require('./task-lease-destination.cjs');
function destinationProvider(claim, status = 200) {
  const head = '1'.repeat(40), commit = '5'.repeat(40);
  return provider([
    { body: JSON.stringify({ object: { sha: head } }) },
    { body: JSON.stringify({ encoding: 'base64', sha: '2'.repeat(40), content: Buffer.from(JSON.stringify(claim)).toString('base64') }), headers: { date: new Date(1000000).toUTCString() } },
    { body: JSON.stringify({ tree: { sha: '3'.repeat(40) } }) },
    { body: JSON.stringify({ sha: '4'.repeat(40) }) },
    { body: JSON.stringify({ sha: '6'.repeat(40) }) },
    { body: JSON.stringify({ sha: commit }) },
    { status, body: JSON.stringify({ object: { sha: commit } }) },
  ]);
}
test('receipt destination reads an immutable lease and publishes without force', async () => {
  const claim = await fixture().leases.acquire('rec123', 'worker', revision);
  const { store, calls } = destinationProvider(claim); const destination = new GitHubReceiptDestination(store);
  const handle = await destination.prepare(claim, { action: 'validation', artifactSha256: 'a'.repeat(64) });
  assert.ok(calls[1].url.endsWith('?ref=' + '1'.repeat(40)));
  assert.deepEqual(JSON.parse(calls[5].options.body).parents, ['1'.repeat(40)]);
  await destination.commit(handle);
  assert.deepEqual(JSON.parse(calls[6].options.body), { sha: '5'.repeat(40), force: false });
  await assert.rejects(destination.commit(handle), /consumed/);
});
test('prepared receipt cannot publish after branch ownership advances', async () => {
  const claim = await fixture().leases.acquire('rec123', 'worker', revision);
  const { store } = destinationProvider(claim, 422); const destination = new GitHubReceiptDestination(store);
  const handle = await destination.prepare(claim, { action: 'validation', artifactSha256: 'a'.repeat(64) });
  await assert.rejects(destination.commit(handle), /Receipt conflict/);
});
test('receipt cannot be prepared by a stale owner or for arbitrary content', async () => {
  const claim = await fixture().leases.acquire('rec123', 'worker', revision);
  const { store, calls } = destinationProvider(claim); const destination = new GitHubReceiptDestination(store);
  await assert.rejects(destination.prepare(claim, { action: '../escape', artifactSha256: 'a'.repeat(64) }), /Invalid receipt/);
  assert.equal(calls.length, 0);
  await assert.rejects(destination.prepare({ ...claim, token: 'stale' }, { action: 'validation', artifactSha256: 'a'.repeat(64) }), /lost/);
  assert.equal(calls.length, 2);
  await assert.rejects(destination.commit({ commit: '5'.repeat(40) }), /Unknown/);
});

test('released or expired lease cannot prepare a receipt', async () => {
  const first = await fixture().leases.acquire('rec123', 'worker', revision);
  for (const change of [{ released: true }, { expiresAt: 1 }]) {
    const { store, calls } = destinationProvider({ ...first, ...change });
    await assert.rejects(new GitHubReceiptDestination(store).prepare(first, { action: 'validation', artifactSha256: 'a'.repeat(64) }), /lost|expired/);
    assert.equal(calls.length, 2);
  }
});
test('prepared receipt handle belongs to its destination instance', async () => {
  const claim = await fixture().leases.acquire('rec123', 'worker', revision);
  const { store } = destinationProvider(claim); const one = new GitHubReceiptDestination(store), two = new GitHubReceiptDestination(store);
  const handle = await one.prepare(claim, { action: 'validation', artifactSha256: 'a'.repeat(64) });
  await assert.rejects(two.commit(handle), /Unknown/);
});

test('staged receipt cannot be redirected to another branch or repository', async () => {
  for (const field of ['branch', 'base']) {
    const claim = await fixture().leases.acquire('rec123', 'worker', revision);
    const { store, calls } = destinationProvider(claim); const destination = new GitHubReceiptDestination(store);
    const handle = await destination.prepare(claim, { action: 'validation', artifactSha256: 'a'.repeat(64) });
    const before = calls.length; store[field] += '-changed';
    await assert.rejects(destination.commit(handle), /scope changed/);
    assert.equal(calls.length, before);
  }
});
test('destination scope drift during preparation stops before further writes', async () => {
  const claim = await fixture().leases.acquire('rec123', 'worker', revision);
  const { store, calls } = destinationProvider(claim); const request = store.request.bind(store);
  store.request = async (...args) => { const response = await request(...args); if (calls.length === 2) store.branch = 'different'; return response; };
  await assert.rejects(new GitHubReceiptDestination(store).prepare(claim, { action: 'validation', artifactSha256: 'a'.repeat(64) }), /scope changed/);
  assert.equal(calls.length, 2);
});
test('claim mutation after validation cannot alter the staged receipt identity', async () => {
  const claim = await fixture().leases.acquire('rec123', 'worker', revision);
  const { store, calls } = destinationProvider(claim); const request = store.request.bind(store);
  store.request = async (...args) => { const response = await request(...args); if (calls.length === 3) { claim.generation = 99; claim.owner = 'changed'; } return response; };
  const handle = await new GitHubReceiptDestination(store).prepare(claim, { action: 'validation', artifactSha256: 'a'.repeat(64) });
  const receipt = JSON.parse(JSON.parse(calls[3].options.body).content);
  assert.equal(handle.generation, 1); assert.equal(receipt.generation, 1); assert.equal(receipt.owner, 'worker');
});
