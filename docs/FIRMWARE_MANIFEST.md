# Exact Firmware Package Manifests

BobFWTools uses `bobfwtools-firmware.json` to bind a firmware directory to an exact OEM/model/build identity.

A chipset match is not enough. The manifest adds the missing device-specific evidence layer.

## Schema

```json
{
  "schema": "bobfwtools-firmware-v1",
  "vendor": "qualcomm",
  "chipset": "SM8550",
  "oem": "ExampleOEM",
  "models": ["EX-100"],
  "variants": ["global"],
  "regions": ["US"],
  "buildId": "EX100_14.0.1",
  "bootloaderRevision": "5",
  "sourceKind": "official-oem",
  "sourceReference": "OEM support package EX100_14.0.1",
  "artifacts": [
    {
      "path": "rawprogram0.xml",
      "sha256": "<64 hex characters>",
      "role": "rawprogram",
      "bytes": 12345
    }
  ]
}
```

## Required identity fields

- `schema` must be `bobfwtools-firmware-v1`
- `vendor`: `qualcomm` or `mediatek`
- `chipset`: a catalog-resolvable SoC alias
- `oem`: exact manufacturer/service identity
- `models`: one or more exact commercial model identifiers
- `buildId`: firmware build/version identity
- `sourceKind`
- `sourceReference`
- at least one artifact with a SHA-256 digest

Optional-but-important constraints:

- variant / SKU
- region / carrier
- bootloader revision
- declared byte size for each artifact

## Allowed source kinds

- `official-oem`
- `authorized-service`
- `operator-import`
- `user-archive`

Source metadata establishes provenance only. It does not authorize destructive service.

## Verification

BobFWTools verifies:

1. manifest schema
2. vendor/chipset consistency
3. exact model identity metadata
4. safe relative artifact paths
5. artifact existence inside the package directory
6. optional declared byte size
7. SHA-256 of every artifact

The verifier refuses parent-directory traversal and cannot resolve a manifest artifact outside the package directory.

## Exact device comparison

After package verification, an operator can compare it to an observed target identity:

- vendor
- OEM
- exact model
- chipset
- variant/SKU
- region/carrier
- bootloader revision

A mismatch blocks candidate compatibility.

Missing optional constraints produce warnings instead of silently becoming matches.

## Execution boundary

Even a perfect exact-device/package match returns:

```text
executionAuthorized = false
```

That is intentional.

Before any destructive write, separate gates still require:

- OEM/service-authorized Firehose or MediaTek DA/auth
- backup/recovery readiness
- exact connected-device revalidation
- physical executor qualification
- explicit operator approval
- post-write verification
