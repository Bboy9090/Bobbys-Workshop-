# BobFWTools Workflow Control Plane

BobFWTools organizes repair workflows by platform and risk rather than by ad-hoc buttons.

## Categories

- Diagnostics
- Recovery
- Firmware/flash
- Android/ADB
- Samsung Download Mode
- Qualcomm EDL
- MediaTek BROM / Preloader
- Apple DFU — reserved for B.U.Tools
- BootForge
- Destructive/admin actions

## Required workflow contract

Every workflow must declare and enforce:

1. Authorization requirements.
2. Physical device identity verification.
3. Dry-run / plan-only capability where technically possible.
4. Backup or rollback handling before destructive work.
5. Structured audit logging.
6. Explicit confirmation for destructive operations.
7. Physical qualification state for executors that write to hardware.

A workflow must fail closed when identity changes, required backups are absent, firmware/layout metadata does not match, authorization is missing, or an executor has not completed physical qualification.

## Calibration data

BobFWTools may back up and restore legitimate device calibration partitions such as EFS, modemst1, modemst2, FSG/FSC, and persist when the operator has authorized access. Backups are bound to the exact device identity and include exact byte count plus SHA-256.

The calibration manager must not provide IMEI editing, serial rewriting, fabricated calibration data, or other identity/security manipulation.

## Qualcomm EDL

EDL support is limited to legitimate OEM/service-authorized recovery. 9008 detection and read-only Sahara parsing are allowed before an executor is qualified. A programmer must be hash-enrolled as authorized for the repair environment before BobFWTools may permit an upload path.

Authentication bypasses, arbitrary unsigned loaders, BootROM exploits, and equivalent security-circumvention paths are outside the BobFWTools execution model.

## Apple

Apple DFU/Recovery remains represented in the global taxonomy for architectural consistency, but active Apple restore work is reserved for the future B.U.Tools product.
