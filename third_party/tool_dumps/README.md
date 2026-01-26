## Tool dumps (upstream drops / installers)

This directory is the **canonical in-repo location** for upstream tool dumps you want to keep around for local development.

`scripts/ingest-third-party-tools.ps1` will scan:

- `third_party/tool_dumps/*` (preferred)
- legacy copies in repo root (if present)
- `files/` (bundled helper binaries)

and copy relevant files (`.exe/.dll/.bat/.cmd/.ps1/.py/.sh`) into the **local-only** bin:

`%LOCALAPPDATA%\Bobbys-Workshop\tools\third_party\bin`

