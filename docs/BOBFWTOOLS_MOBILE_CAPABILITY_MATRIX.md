# BobFWTools Mobile Capability Matrix

Status: authoritative mobile-device capability boundary
Product: **BobFWTools**
Parent: **Bobby's Workshop**

## Product boundary

BobFWTools owns phone and tablet workflows. Boot It Back owns computer boot media, operating-system installation/recovery, disks, BIOS/UEFI and computer-side rescue.

## Supported capability classes

### Detection and diagnostics
- USB device identification and exact model/family detection.
- ADB, Fastboot/Fastbootd, Recovery, DFU and Samsung/Odin-mode detection.
- battery/health, storage and connectivity diagnostics where platform APIs permit.
- firmware/build/revision collection and exact compatibility planning.
- read-only partition/layout inspection where supported.
- immutable audit and operation receipts.

### Android repair/recovery
- ADB diagnostics and authorized maintenance.
- Fastboot/Fastbootd workflows.
- OEM/vendor-documented bootloader unlock when the device owner explicitly opts in and accepts destructive-data warnings.
- stock firmware flashing using official or otherwise verifiable packages and exact model/region/bootloader-revision compatibility checks.
- vendor-supported recovery/OTA sideload.
- backup/restore where the platform permits it.
- root only after a legitimate vendor-supported or already-unlocked bootloader path, with explicit owner choice.
- compatibility database for model, region, carrier variant, bootloader revision, anti-rollback status, partition layout and image provenance.

### Samsung
- exact SM model and regional variant detection.
- bootloader revision matching.
- Odin-mode detection and stock package planning.
- BL/AP/CP/CSC/HOME_CSC package validation.
- fail-closed behavior on revision mismatch or unverifiable firmware.

### Apple mobile devices
- normal/recovery/DFU detection.
- Apple-supported update/restore.
- IPSW provenance and compatibility verification.
- backup/restore and recovery guidance.
- signed/authorized developer-device operations.

## Explicit exclusions

BobFWTools does not provide:
- FRP bypass.
- Activation Lock bypass.
- passcode bypass.
- SEP/security circumvention.
- exploit-based bootloader unlocking.
- leaked service credentials or authorization circumvention.
- carrier/network lock circumvention.
- workflows for stolen or unauthorized devices.

## Release rule

A workflow may be presented as supported only after:
- exact-device fixture coverage.
- model/revision compatibility tests.
- destructive-operation confirmation tests.
- wrong-target protection.
- interrupted-operation recovery testing.
- provenance/checksum verification.
- real-device certification.
- audit receipt verification.

Otherwise it remains Planned, Experimental, or Diagnostic-only.
