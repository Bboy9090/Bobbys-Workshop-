'use strict';
const { randomUUID } = require('node:crypto');
const slug = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
function requireValue(ok, message) { if (!ok) throw new Error(message); }
function validateState(state, task) {
  requireValue(state && Object.keys(state).sort().join(',') === 'expiresAt,generation,owner,released,revision,sequence,task,token,version' && state.version === 1 && state.task === task && slug(state.owner) &&
    typeof state.token === 'string' && /^[a-f0-9-]{36}$/.test(state.token) &&
    /^[a-f0-9]{40}$/.test(state.revision) && Number.isSafeInteger(state.generation) && state.generation > 0 &&
    Number.isSafeInteger(state.sequence) && state.sequence > 0 &&
    Number.isSafeInteger(state.expiresAt) && state.expiresAt > 0 && typeof state.released === 'boolean', 'Invalid lease state');
}
class TaskLease {
  constructor(store) { this.store = store; }
  async snapshot(task) {
    requireValue(slug(task), 'Invalid task identifier');
    const current = await this.store.read(task);
    requireValue(Number.isSafeInteger(current.now) && current.now > 0, 'Provider clock unavailable');
    if (current.state !== null) validateState(current.state, task);
    return current;
  }
  async acquire(task, owner, revision, ttlSeconds = 300) {
    requireValue(slug(owner) && /^[a-f0-9]{40}$/.test(revision), 'Invalid owner or source revision');
    this.ttl(ttlSeconds);
    const current = await this.snapshot(task), previous = current.state;
    requireValue(!previous || previous.released || previous.expiresAt <= current.now, 'Task already leased');
    const state = { version: 1, task, owner, revision, token: randomUUID(), generation: (previous?.generation || 0) + 1,
      sequence: (previous?.sequence || 0) + 1, expiresAt: current.now + ttlSeconds * 1000, released: false };
    validateState(state, task);
    await this.store.compareAndSwap(task, current.etag, state);
    return state;
  }
  ttl(seconds) { requireValue(Number.isInteger(seconds) && seconds >= 30 && seconds <= 3600, 'TTL must be 30–3600 seconds'); }
  owns(current, claim) {
    requireValue(claim && current.state && !current.state.released && current.state.expiresAt > current.now &&
      current.state.token === claim.token && current.state.owner === claim.owner &&
      current.state.generation === claim.generation && current.state.revision === claim.revision, 'Lease lost or expired');
  }
  async assertOwned(claim) { const current = await this.snapshot(claim?.task); this.owns(current, claim); return current.state; }
  async renew(claim, ttlSeconds = 300) {
    this.ttl(ttlSeconds);
    const current = await this.snapshot(claim?.task); this.owns(current, claim);
    const state = { ...current.state, sequence: current.state.sequence + 1, expiresAt: current.now + ttlSeconds * 1000 };
    validateState(state, claim.task);
    await this.store.compareAndSwap(claim.task, current.etag, state); return state;
  }
  async release(claim) {
    const current = await this.snapshot(claim?.task); this.owns(current, claim);
    const state = { ...current.state, sequence: current.state.sequence + 1, released: true };
    validateState(state, claim.task);
    await this.store.compareAndSwap(claim.task, current.etag, state);
  }
}
class GitHubLeaseStore {
  constructor({ repository, branch, token, fetchImpl = fetch }) {
    requireValue(typeof repository === 'string' && /^[\w.-]+\/[\w.-]+$/.test(repository) && typeof branch === 'string' && branch.length > 0 &&
      typeof token === 'string' && token.length > 0, 'Repository, existing lease branch, and runtime token required');
    this.base = `https://api.github.com/repos/${repository}`; this.branch = branch; this.token = token; this.fetch = fetchImpl;
  }
  async request(path, method = 'GET', body) {
    const response = await this.fetch(this.base + path, { method, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'Cache-Control': 'no-cache', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return response;
  }
  path(task) { requireValue(slug(task), 'Invalid task identifier'); return `/contents/.agent/leases/${task}.json`; }
  async read(task) {
    // Distinguish a missing lease file from an unavailable repository/branch.
    const ref = await this.request(`/git/ref/heads/${encodeURIComponent(this.branch)}`);
    requireValue(ref.ok, `Lease branch unavailable (${ref.status})`);
    const response = await this.request(this.path(task) + `?ref=${encodeURIComponent(this.branch)}`);
    const now = Date.parse(response.headers.get('date'));
    requireValue(Number.isSafeInteger(now), 'Provider clock unavailable');
    if (response.status === 404) return { state: null, etag: null, now };
    requireValue(response.ok, `Lease read failed (${response.status})`);
    const file = await response.json();
    requireValue(file.encoding === 'base64' && /^[a-f0-9]{40}$/.test(file.sha) && typeof file.content === 'string' && file.content.length < 16384, 'Invalid provider lease response');
    return { state: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')), etag: file.sha, now };
  }
  async compareAndSwap(task, etag, state) {
    validateState(state, task);
    requireValue(etag === null || /^[a-f0-9]{40}$/.test(etag), 'Invalid lease version');
    const response = await this.request(this.path(task), 'PUT', { branch: this.branch, message: 'Update task execution lease',
      content: Buffer.from(JSON.stringify(state)).toString('base64'), ...(etag ? { sha: etag } : {}) });
    requireValue(response.ok, response.status === 409 || response.status === 422 ? 'Lease conflict: re-read before retrying' : `Lease write failed (${response.status})`);
  }
}
module.exports = { TaskLease, GitHubLeaseStore };
