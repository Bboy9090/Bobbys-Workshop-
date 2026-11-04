# Firmware provenance worker

Firmware packages enter only through the private `firmware-intake/` prefix. Each object must carry exact vendor/model/build/bootloader metadata and an approved HTTPS vendor-source URL.

The worker computes SHA-256 from the stored bytes, records the source URL hash, checks prior source state in DynamoDB, and marks a source replacement when the same source URL produces different bytes. It writes a normalized provenance manifest under `firmware-provenance/` in the KMS-encrypted evidence vault.

Every output is evidence-only: `executionAuthorized:false` and `deviceWriteAuthorityGranted:false`. The worker cannot flash a device, select firmware for execution, downgrade a bootloader, or bypass any local authorization/physical-qualification gate.
