## Local-only third party tools (your own devices)

This repo supports **local-only** third party binaries without committing them.

### Why
- Keeps the repo clean and reproducible.
- Avoids shipping random binaries by accident.
- Still lets you use proven tooling locally.

### Where to put binaries
On Windows:
- `%LOCALAPPDATA%\\Bobbys-Workshop\\tools\\third_party\\bin`

Fallback:
- `%APPDATA%\\Bobbys-Workshop\\tools\\third_party\\bin`
- `~/.bobbys-workshop/tools/third_party/bin`

### How the app finds them
The backend/tooling resolution checks (in order):
1. Local-only third party bin dir above
2. App-managed Android platform-tools dir
3. Bundled tools (if present)
4. System PATH

### Safety defaults
- High-risk operations should remain **user-initiated** and pass through Trapdoor/RBAC + audit logs.
- No automatic “silent execution” of third party binaries.

### What I won’t do
I can’t help reverse engineer or recreate bypass/exploit internals (e.g. jailbreak/FRP bypass logic). I can help integrate legitimate open-source tooling and safe wrappers for device management.

