# macOS application qualification — 2026-10-07

Owner: Codex. Project: Bobby’s Workshop. Repair PR #195 revision `44a84dd08f3dc8e559ac42e7c16df45ae10c2a56`.

A separate fresh macOS clone executed root and packaged-server npm ci with lifecycle scripts disabled, then `npm test`, `npm run lint`, and `npm run build`. All completed successfully: 12 test files, 98 tests, zero skips. Node v26.7.0; Git2.50.1. Existing build uses TypeScript noCheck, so this is not full type-check certification.

The first run at400c1117e869840dc723d688e9a236ee4a098cfb failed3 tests because Fastboot was available on the Mac. The tests assumed the tool was absent. Revised tests at44a84dd verify exact status/code pairs for tool absence, input validation, policy blocks, and missing confirmation. No operation authorization or device mutation implementation was expanded.

Linux full tests also passed98/98 at44a84dd. GitHub Node CI run37660717734 completed successfully at the same revision.

Mac retained log SHA256:
- tests:39ab5d0de1fb19aef2ec5f457f35b6fa3d39f0ef87372df473810ba26f1a23db
- lint:2bf5cf432467a6d335e90dc74f3aef4d6a1129099d900256a15b748c16100a56
- build:107cfb63876f5a5cc4a31b3148a6e8b3aba9f79208cb28fd851790ad6244a40f

Windows Git2.55.0.windows.5 has now been installed successfully for the user. A separate verified Windows clone at44a84dd is installing dependencies. Windows full application qualification is not yet claimed. PR #195 and coordination PR #193 remain unmerged; publishing PR #192 is separate. No desktop installer or device hardware proof is established by these checks.
