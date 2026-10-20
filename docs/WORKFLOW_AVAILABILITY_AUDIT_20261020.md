# Workflow and interface audit — 2026-10-20

Scope: PR #240 on the hardware readiness integration lane, following merged PRs #236, #237 and #238. This is a source/behavior audit; physical device results are recorded separately in the evidence ledger.

## What belongs in the normal interface

The default view shows phone connection state and three task entries: diagnostics, files/apps, and firmware package inspection. Six navigation destinations replace the long combined page. Raw USB, execution policy, driver repair, calibration tools, loaders, qualification consoles, and logs remain behind their own Advanced or History disclosures. Unopened advanced tools do not initialize.

A task entry may explain a missing connection. It must not look physically qualified merely because a catalog includes a brand, chipset, USB vendor, or workflow. A probe failure is unverified state. Independently successful MTP observations remain usable when an ADB/Fastboot probe fails.

| Observed connection | Applicable normal work | Qualification limit |
| --- | --- | --- |
| Built-in Apple USB components, generic peripheral, vendor name alone | Raw connection evidence in Advanced | Never classified as an Android phone merely from its manufacturer |
| Android USB descriptor without an authorized transport | Read connection diagnostics and setup guidance | Does not grant file access, app actions, exact model identity, or firmware eligibility |
| Authorized ADB for a selected serial | Device information, battery/log/screenshot reads, app inventory; existing guided mode/app actions | Access and serial are rechecked by the backend; this is not a blanket physical or write qualification |
| Unauthorized/offline ADB | Authorization/setup information | Device actions remain disabled |
| MTP connected | File browsing/downloads; separately guided uploads | Uploads change storage. MTP does not establish ADB authorization or firmware identity |
| Fastboot serial present | Read checks and existing guided mode controls | No file-transfer capability implied; flash/unlock/wipe require separate qualification |
| Samsung USB in Download Mode | Samsung package inspection and guarded planning | A USB descriptor does not establish an exact model, functioning protocol session, or compatible firmware |
| Qualcomm 9008 | Package/loader inspection and recovery planning | Legitimate matching programmer/authentication, exact identity and all write gates remain required |
| MediaTek BROM/Preloader | Package/DA/auth inspection and recovery planning | Required OEM authentication is a blocker; no bypass lane |
| No current target or denied probe | Setup help and exact failure details | No ready-to-execute device workflow |

## Every policy catalog entry

The native policy catalog has 11 entries; the separate JSON workflow-definition validation covers 21 definitions. These counts describe code/catalog coverage, not qualified devices.

| Policy ID | Implemented user control in this workspace | Presentation and boundary |
| --- | --- | --- |
| diagnostics.usb-scan | Native read-only enumeration and diagnostics | Read checks; no physical qualification inherited from the catalog |
| android.adb-authorized | Native ADB checks and existing guided service actions | Requires the selected authorized serial; changes retain existing confirmations and backend checks |
| samsung.odin-plan | Stock package inspection / planning controls | Planning only; no ready-to-flash badge |
| qualcomm.edl-plan | Recovery artifacts, programmer authorization, dry-run plan and evidence | Planning only; no unqualified writer |
| mediatek.brom-plan | Recovery artifacts, legitimate DA/auth plan and evidence | Planning only; vendor authentication remains mandatory |
| calibration.backup | Allowlisted partition backup control | Advanced read-backup preparation; authorized ADB alone does not prove block-read permission |
| calibration.restore | No active restore executor in the primary workspace | Unavailable reference; omitted from executable workflows and implemented qualification queue |
| hardware.storage-identify | Specialist bench reference / packet template | Advanced planning reference; no automatic ISP/JTAG/eMMC/UFS executor claimed |
| hardware.chip-off-plan | Specialist bench reference / packet template | Advanced planning reference; no physical chip-off/reball execution claimed |
| apple.dfu | Reserved catalog entry | Unavailable; no Apple restore workflow |
| bootforge.media | Removable-media reference / packet template | Advanced planning reference; no active media writer claimed here |

Saved diagnostic cards additionally require a fresh matching USB UID, vendor/product IDs, mode and serial. Disconnects, changed modes, failed USB probes, rescans and browser previews cannot reuse an earlier diagnosis to route a workflow.

The explicit implementation registry in `src/lib/workspace-availability.ts` is an allowlist. Unknown IDs default to unavailable. Catalog activation must be the boolean `true`. Catalog physical flags cannot set current-device qualification or remove a bench task.

## Brands and firmware compatibility

Normal task availability uses observed transport and authorization. Samsung-specific presentation additionally requires Samsung vendor ID and Download Mode evidence. Qualcomm and MediaTek service sections follow detected protocol modes. Manufacturer strings, chipset-search matches and marketing names remain advisory.

Exact model, board and SKU/device-code matching, provenance, required artifacts, fingerprints, and hashes are separate from brand/chipset lookup. Manual identity entry remains planning-only. An authorized ADB identity capture does not attest arbitrary USB recovery hardware or authorize a write. Existing backend target/job/dossier/authority controls remain authoritative.

Historical SM-A176U, SM-T580 and Samsung 04e8:685d / SM6150 observations are preserved. None is treated as the device attached today. The last host USB inventory in this session saw eight built-in Apple components and no external Android target; its raw logs remain on the Mac and have not been copied into this ledger.

## Verification and unresolved checks

Browser CI records actual layout metrics, screenshots and uncaught errors in the `BobFWTools-workspace-ui-evidence` artifact. It verifies one visible view, a desktop home that fits without scrolling, closed/deferred advanced tools, retained firmware inputs, and no horizontal overflow in the tested narrow-screen views. It runs with no native bridge and grants no hardware authority.

The evidence ledger separates source-bound simulated checks, physical reads, physical writes and release checks. Earlier failures remain separate historical records. Every result keeps execution authorization false. Refresh evidence when source, target, firmware, operation or freshness changes.

CI additionally prepares an unsigned DMG with an Applications link, verifies a read-only mount and isolated byte-matching app copy, and uploads a revision-bound installer receipt. That packaging check does not qualify the connected Mac or a signed release.

Current native UI/installer and new signing/notarization/Gatekeeper checks are blocked by the Desktop Commander monthly limit. Older signed artifacts do not qualify the changed workspace. GitHub secret configuration is unverified through the current connector.

The default branch and this integration lane have diverged. The default branch has a separately evolved app + DMG release workflow and different certificate secret names. Promotion must preserve its DMG notarization, installer and provenance stages and resolve the release-script interface differences before release. PRs #239, #193, #192 and dependency work remain separate and untouched.

No flash, wipe, unlock, repartition, restore, or raw-media write was performed or approved in this session.

The final React review adds a repeated-request disclosure regression using a read-only simulated bridge. No simulated device becomes physical evidence. CI also seals its own generated app bundles ad-hoc before strict installer verification; Developer ID signing remains a separate release gate.
