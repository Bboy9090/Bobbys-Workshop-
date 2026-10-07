# Desktop application qualification complete — 2026-10-07

Project: Bobby’s Workshop. Owner: Codex. Repair source224f20fffc1da6abccfd223d0a11cd85af3f6bfb, PR #195. Coordination source53a146d8c8066150684cc8d0441d8c9ac83b96eb, PR #193.

## Actual execution

Windows Node24.21.0/Git2.55.0.windows.5: separate verified repository checkout, root npm ci and packaged-server npm ci with lifecycle scripts disabled; npm test98/98 in12 files, zero skips; npm run lint passed; npm run build passed. The sequential qualification terminal exited0 and printed QUALIFICATION_PASS. Build finished in12.66seconds.

Mac Node26.7.0/Git2.50.1: separate verified checkout, dependency installation,98/98 application tests, lint/build passed at44a84dd; final startup allowance revision224f20f retested98/98 successfully. Linux also passed98/98 at224f20f.

GitHub CI passed repair224f20f (run37662835928) and coordination53a146d (run37662840789). The coordination workflow includes the31 checkpoint tests and the full application suite. Actual checkpoint acceptance/rejection logic was separately executed on both desktop Node environments earlier.

## Corrections found by platform testing

Installed Fastboot returns policy/confirmation validation errors rather than TOOL_NOT_AVAILABLE. Tests now assert exact status/error pairs. Windows API startup exceeded the original ten-second runner allowance; direct observation confirmed a200 health response. The runner now permits a bounded sixty-second startup and still fails on an unhealthy server. PowerShell stderr warning handling was corrected at invocation level. No device authorization or operation implementation was expanded.

## Retained hashes

Windows logs: tests5152f842cc4aba6eaffb4e094a62031b3ed3dc55968c312f9baafdee2264ced3; lint49397db41bf869e5994c0921d01a8dfd21ec0669371af7bcbad0044e0eff98da; build45057a1e77548c327c50b61908eba8ee92a6f5f69bf287e43087f10aab228677.
Mac final tests13d368f68fcdc0e81c768f75da3793b33b5caac23dd904d2629c54d20974dbcf. Earlier Mac lint/build hashes are in2026-10-07-macos-full-suite.md.

## Handoff

Desktop source/test execution is qualified at the stated revisions. This does not establish installer signing, store release, physical device operations, or a fully type-checked TypeScript build (current build uses noCheck). PR #193 and #195 remain unmerged. Publishing PR #192 remains separate.

Next implementation: enforce exclusive task ownership and expiry before automated dispatch. Current Airtable claims remain advisory; atomic leases and automated dispatch are not implemented. Canonical queue must remain the Tasks and Blockers table; no second writable task ledger should be introduced.
