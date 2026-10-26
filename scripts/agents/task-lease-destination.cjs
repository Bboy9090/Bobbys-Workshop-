'use strict';
const { TaskLease } = require('./task-lease.cjs');
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
function check(ok, message) { if (!ok) throw Error(message); }
// Receipt-only destination. Ownership and the resulting receipt share one Git history.
class GitHubReceiptDestination {
  #prepared = new WeakMap();
  #scope;
  constructor(store) { this.store = store; this.#scope = { base: store.base, branch: store.branch }; }
  assertScope() {
    check(this.store.base === this.#scope.base && this.store.branch === this.#scope.branch, 'Receipt destination scope changed');
  }
  request(...args) { this.assertScope(); return this.store.request(...args); }
  async json(response, operation) {
    check(response.ok, `${operation} failed (${response.status})`);
    return response.json();
  }
  async prepare(claim, { action, artifactSha256 } = {}) {
    check(typeof action === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(action) && typeof artifactSha256 === 'string' && /^[a-f0-9]{64}$/.test(artifactSha256), 'Invalid receipt');
    claim = Object.freeze({ task: claim?.task, owner: claim?.owner, token: claim?.token, generation: claim?.generation, revision: claim?.revision });
    const ref = await this.json(await this.request(`/git/ref/heads/${encodeURIComponent(this.store.branch)}`), 'Receipt branch read');
    const parent = ref.object?.sha; check(sha(parent), 'Invalid receipt branch head');
    // Immutable ref binds ownership validation to exactly the commit used as parent.
    const response = await this.request(this.store.path(claim?.task) + `?ref=${parent}`);
    const now = Date.parse(response.headers.get('date'));
    const file = await this.json(response, 'Receipt lease read');
    check(file.encoding === 'base64' && sha(file.sha) && typeof file.content === 'string' && file.content.length < 16384, 'Invalid receipt lease response');
    const snapshot = { state: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')), etag: file.sha, now };
    await new TaskLease({ read: async () => snapshot }).assertOwned(claim);
    const base = await this.json(await this.request(`/git/commits/${parent}`), 'Receipt commit read');
    check(sha(base.tree?.sha), 'Invalid receipt base tree');
    const receipt = { version: 1, task: claim.task, generation: claim.generation, owner: claim.owner, revision: claim.revision, action, artifactSha256 };
    const blob = await this.json(await this.request('/git/blobs', 'POST', { content: JSON.stringify(receipt), encoding: 'utf-8' }), 'Receipt blob');
    check(sha(blob.sha), 'Invalid receipt blob');
    const tree = await this.json(await this.request('/git/trees', 'POST', { base_tree: base.tree.sha,
      tree: [{ path: `.agent/results/${claim.task}.json`, mode: '100644', type: 'blob', sha: blob.sha }] }), 'Receipt tree');
    check(sha(tree.sha), 'Invalid receipt tree');
    const commit = await this.json(await this.request('/git/commits', 'POST', { message: 'Publish fenced task receipt', tree: tree.sha, parents: [parent] }), 'Receipt commit');
    check(sha(commit.sha), 'Invalid receipt commit');
    const handle = Object.freeze({ task: claim.task, generation: claim.generation, commit: commit.sha });
    this.#prepared.set(handle, commit.sha);
    return handle;
  }
  async commit(handle) {
    const commit = handle && this.#prepared.get(handle);
    check(sha(commit), 'Unknown or consumed receipt handle');
    // A competing lease mutation or receipt makes this child commit non-fast-forward.
    const response = await this.request(`/git/refs/heads/${encodeURIComponent(this.store.branch)}`, 'PATCH', { sha: commit, force: false });
    check(response.ok, response.status === 409 || response.status === 422 ? 'Receipt conflict: prepare again against current ownership' : `Receipt publication failed (${response.status})`);
    const ref = await response.json(); check(ref.object?.sha === commit, 'Receipt publication not confirmed');
    this.#prepared.delete(handle);
    return { task: handle.task, generation: handle.generation, commit };
  }
  async publish(claim, receipt) { return this.commit(await this.prepare(claim, receipt)); }
}
module.exports = { GitHubReceiptDestination };
