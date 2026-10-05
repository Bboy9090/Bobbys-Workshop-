# Workshop agent coordination

Read .github/copilot-instructions.md and the project-specific instructions before making changes. User-authorized task scope controls routine execution; stop for an actual destructive, credential, legal, or financial boundary.

## Authority
Code: current repository branch and exact commit, then tested implementation.
Runtime: provider deployment and observed behavior.
Narrative: current approved manuscript and canon files; never infer canon from a cover.
Portfolio: verified command-center records.
Drive: explicitly resolved specification documents, with their identifiers and versions.
Resolve contradictions explicitly. Never treat stale summaries as current release proof.

## Session workflow
1. Resolve project, deliverable, source revision, and applicable instructions.
2. Inspect dependency manifests and discover validation commands before editing.
3. Claim one task through the central queue; record owner, revision, dependencies, and acceptance criteria.
4. Implement a focused change on an isolated branch. Test doubles belong in tests only.
5. Run relevant deterministic checks. Independent review is required for high-risk work, but named roles do not automatically launch agents.
6. Record evidence and remaining uncertainty. Planned, implemented, tested, deployed, published, and physically proven are distinct.
7. Write a checkpoint using docs/agents/HANDOFF_TEMPLATE.md at each milestone.
8. Update the canonical task record with verified facts, preserving other workers' updates.

## Coordination boundaries
Use GitHub issues for the durable queue until a connected command center is selected and verified. Do not introduce a second writable TASKS.json ledger.
Use one issue per deliverable and link dependencies. Claim with an assignee and timestamp; inspect recent activity before taking over another worker's task.
Never silently overwrite another session's checkpoint or force-push.
Do not put credentials, private manuscripts, personal data, or device paths in this public repository.

## Integration truth
ChatGPT and Claude instruction adapters are guidance, not permissions.
Apple/Google developer portals are release destinations, not automatically attached agents.
Neither .agent files nor prompts grant account access or intercept commands.
Only report connected integrations after actual access and scoped permissions are verified.
Preserve existing release executor rules in each repository.
