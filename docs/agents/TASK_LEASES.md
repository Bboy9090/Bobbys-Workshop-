# Exclusive task execution leases

Airtable remains the canonical task queue. This module stores only execution ownership metadata, never task descriptions, manuscripts, credentials, machine paths, or a second task list.

`TaskLease` in `scripts/agents/task-lease.cjs` implements acquire, renew, release and ownership validation. `GitHubLeaseStore` implements the remote store using GitHub Contents API conditional writes against the last-read content SHA. Existing active owners block acquisition, including repeated acquisition by the same owner. Expired owners cannot renew or release. Each takeover increases the fencing generation; every mutation advances a sequence so release/reacquisition cannot reuse an old content SHA.

## Configuration and use

Provision a dedicated **existing** lease-state branch in the authorized repository. The adapter does not create repositories, branches, permissions or credentials. Restrict writes to the intended worker identities. GitHub credentials must be injected at runtime, never copied into a checkpoint or logged.

```js
const { TaskLease, GitHubLeaseStore } = require('./scripts/agents/task-lease.cjs');
const leases = new TaskLease(new GitHubLeaseStore({
  repository: 'Bboy9090/Bobbys-Workshop-',
  branch: 'agent-lease-state',
  token: process.env.GITHUB_TOKEN
}));
// task must be the canonical Airtable record ID; owner is a non-personal executor slug.
const claim = await leases.acquire(taskRecordId, executorSlug, exactSourceRevision, 300);
await leases.assertOwned(claim);
// Renew before expiry and validate again immediately before a protected action.
```

The HTTP response Date supplies lease time; a missing clock, missing branch, malformed state, network failure or write conflict fails closed. No automatic retry can silently steal ownership. After a conflict, read the latest state before another explicit acquisition attempt. State files persist after release, preserving monotonically increasing generations. Do not delete or recreate lease state, which would reset fencing history. Public-repository UUIDs are identity markers, not secret authorization credentials.

## Limits that matter

This primitive does not launch agents, update Airtable statuses or enforce a lease around existing workflows. Live runtime adapter qualification has **not** been performed. The dedicated lease branch and worker credentials are not provisioned by this change.

An ownership check alone cannot stop an already-running or paused worker after lease expiry. The protected destination must reject stale fencing generations transactionally. Until the executor/destination implements that check, automatic dispatch, release actions and hardware operations must remain disabled. GitHub administrators and other branch writers can replace lease state; this is coordination among trusted workers, not an adversarial security boundary. Sustained high-throughput scheduling requires a purpose-built transactional store rather than GitHub commits per heartbeat.

## Validation

Run `node --test scripts/agents/task-lease.test.cjs`. Tests use isolated test-only stores and HTTP doubles. They cover a 20-contender race, takeover, expiry, stale tokens/generations/revisions, malformed data, provider clock, conditional SHA serialization, missing branches, access failure and conflicts. These results do not qualify GitHub's live behavior or physical devices.

Source baseline: main-tool-kit at `2b612b909c7d8d5df164d9240a25796b438666e2`. Existing PR #193 is conflicting with current main; this isolated implementation does not overwrite its checkpoint work or alter hardware-release lanes. PR #195 is already merged.
