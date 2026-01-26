## Third-party materials (local workshop use)

This folder is for **upstream source drops, installers, and reference assets** that may be useful during development of Bobby's Workshop.

### Policy / safety

- **Do not wire** bypass/exploit functionality into the product UI/API.
- Prefer **official vendor tools** and **documented protocols**.
- Keep **binary blobs** out of git when possible (use the local tools bin described below).

### Local-only tool bin (not committed)

The backend prefers a local-only tools directory (searched before system `PATH`):

- Windows: `%LOCALAPPDATA%\Bobbys-Workshop\tools\third_party\bin`
- Fallback: `~/.bobbys-workshop/tools/third_party/bin`

Populate it by running:

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ingest-third-party-tools.ps1`

