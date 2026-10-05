# Platform adapters

These are instructions for configured tools, not claims of connectivity.

## ChatGPT / Claude
Resolve the named project and read its AGENTS.md, capability manifest if present, and current task issue. Confirm actual tool access before proposing execution. Cite the current source revision in handoffs. Do not claim access to Drive, developer accounts, cloud services, or local files merely because instructions mention them.

## Xcode / Android Studio / terminal agents
Read the repository instructions using the agent's documented instruction-file mechanism. Do not assume .agent/execution-rules.json is automatically consumed. Discover build and test commands from checked-in manifests and keep signing credentials outside the repository.

## Cloud execution
Select the executor required by the target project's release policy. Preserve provider-specific qualifications. Store exact source revision, artifact hashes, executor identity, and retained logs. Configuration alone is not a completed build.

## Installation checklist
- Resolve actual account/project and approved scope.
- Verify the integration is available using a read-only operation.
- Configure the tool's supported instruction mechanism.
- Run a reversible, project-specific validation task.
- Record evidence and unresolved permissions.
- Enable write or release actions only within the authorized task.

Current status: adapters drafted. No account settings changed by these files.
