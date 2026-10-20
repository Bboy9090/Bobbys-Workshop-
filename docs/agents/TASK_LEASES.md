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

This primitive does not launch agents, update Airtable statuses or enforce a lease around existing workflows. The real GitHub adapter passed isolated qualification on macOS at source `665405ea5f06a3eb0e65439a00b977289e85fca1`. The qualification branch is `agent-lease-qualification-20261020-a`; its synthetic lease was released. Production task-state provisioning and worker credentials remain unconfigured.

An ownership check alone cannot stop an already-running or paused worker after lease expiry. External protected destinations must reject stale fencing generations transactionally. The receipt-only GitHub destination described below fences branch ownership changes, but external dispatch, release actions and hardware operations remain disabled. GitHub administrators and other branch writers can replace lease state; this is coordination among trusted workers, not an adversarial security boundary. Sustained high-throughput scheduling requires a purpose-built transactional store rather than GitHub commits per heartbeat.

## Validation

Run `node --test scripts/agents/task-lease.test.cjs`. Tests use isolated test-only stores and HTTP doubles. They cover a 20-contender race, takeover, expiry, stale tokens/generations/revisions, malformed data, provider clock, conditional SHA serialization, missing branches, access failure and conflicts. The unit tests do not qualify physical devices. An isolated live provider receipt is retained in `docs/agents/receipts/2026-10-20-github-lease-qualification.json`.

Source baseline: main-tool-kit at `2b612b909c7d8d5df164d9240a25796b438666e2`. Existing PR #193 is conflicting with current main; this isolated implementation does not overwrite its checkpoint work or alter hardware-release lanes. PR #195 is already merged.

## Repeating the isolated live probe

Run `node scripts/agents/task-lease-live.cjs Bboy9090/Bobbys-Workshop- <qualification-branch> <exact-source-revision> --use-gh-keyring` only on an authorized executor. The branch must already exist and start with `agent-lease-qualification-`. The harness refuses production branch names before credential access. It uses an injected environment token or, with the explicit flag, the authenticated GitHub CLI keyring inside the child process; credentials are not printed. It tests a synthetic task marker, not a canonical portfolio task, waits for a real 30-second lease expiry, and retains released state for fencing history. It never launches work or changes Airtable statuses.

The first probe at39a86f5 failed with generic diagnostics. A later probe at665405e completed all eight assertions and exited0; that successful receipt establishes provider behavior only at its stated source. Receipt publication fencing is implemented below; external-effect transactional fencing and automatic dispatch remain unimplemented.

## Fenced GitHub receipt destination

`GitHubReceiptDestination` in `scripts/agents/task-lease-destination.cjs` publishes only a small digest receipt under `.agent/results/<task>.json` in the **same branch** as the lease. `prepare(claim, {action, artifactSha256})` resolves the branch head, validates the lease against that immutable head and constructs a child commit. `commit(handle)` advances the branch with `force:false`. A takeover, release, renewal, other task write or other receipt publication after preparation makes the old child non-fast-forward and rejects it. Callers must prepare again, revalidating ownership, after any conflict. Handles are instance-bound and cannot be forged or reused after confirmed success.

This fences publication against intervening ownership mutations; it does not execute the artifact. No credentials, manuscript content or arbitrary output body are accepted. Airtable remains canonical task authority. The receipt is a digest pointer only.

GitHub does not atomically evaluate wall-clock expiry during a ref update. A prepared receipt can still be accepted after its lease deadline if no intervening branch mutation occurred. The protocol therefore does **not** establish strict expiry-at-write authorization or protect external systems, in-flight device commands, releases or billing. Those destinations require their own transactional enforcement. Automatic dispatch remains disconnected. Branch deletion/reset or administrator force-push also defeats monotonic history; trusted-worker coordination is the scope.

Tests cover immutable source reads, exact parent binding, non-forced ref update, stale publication rejection, stale owners, path validation and forged/reused handles. The explicit live qualifier now stages worker A's receipt, waits through expiry/takeover, publishes worker B's receipt, then attempts A's stale commit and verifies B's digest remains current.

Live destination qualification passed at `21ddbbaf3de277258fbd9c13247648862b50c095` on macOS/Node26.7.0. The staged former-owner commit was rejected after the replacement owner published, and independent connector readback preserved generation2 and the replacement digest. The synthetic lease was released. Receipt: `docs/agents/receipts/2026-10-20-fenced-publication.json`. Eighteen local Node tests, local lint/build and the dedicated lease CI passed at this implementation; broader fresh Node/macOS CI remains subject to its actual run status.
