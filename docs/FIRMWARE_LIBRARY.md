# BobFWTools Firmware Library

BobFWTools uses a managed local firmware library instead of checking OEM firmware binaries into Git.

Default workspace:

```text
~/.bobfwtools/firmware/
  inbox/
  qualcomm/
  mediatek/
  quarantine/
```

## What ships with BobFWTools

The application ships firmware **intelligence**, not proprietary firmware images:

- Qualcomm MSM / SDM / SM family aliases
- MediaTek MT65xx / MT67xx / MT68xx / MT69xx aliases
- Snapdragon, Helio, Dimensity, and Kompanio marketing-name lookup
- expected service modes and storage generations
- package-marker recognition
- SHA-256 local artifact inventory
- Qualcomm Firehose / rawprogram / patch classification
- MediaTek scatter / preloader / Download Agent / auth classification
- explicit quarantine markers for bypass/exploit/patched service artifacts

The catalog is intentionally extensible. It is broad coverage, not a claim that one generic package exists for every SoC.

## Why firmware binaries are not bundled in Git

A firmware package must match more than the chipset. Exact compatibility can depend on:

- OEM and exact commercial model
- hardware revision / board ID
- region / carrier / SKU
- bootloader revision and rollback state
- secure-boot configuration
- UFS/eMMC geometry
- partition layout
- DRAM initialization
- OEM signing and authentication
- authorized Qualcomm Firehose programmer or MediaTek DA/auth pair

A shared SoC therefore never establishes flash authority.

## Qualcomm library examples

Recommended layout:

```text
qualcomm/
  SM8550/
    OEM/
      MODEL_VARIANT/
        rawprogram0.xml
        patch0.xml
        prog_ufs_firehose_*.elf
        boot.img
        vendor_boot.img
        super.img
```

Recognized metadata includes:

- `prog_*_firehose*.elf`
- `prog_*_firehose*.mbn`
- `rawprogram*.xml`
- `patch*.xml`
- GPT binaries
- partition images

Firehose files are never authorized merely because they match a chipset name. Enrollment into the EDL programmer vault still requires separate OEM/service authorization evidence.

## MediaTek library examples

Recommended layout:

```text
mediatek/
  MT6989/
    OEM/
      MODEL_VARIANT/
        MT6989_Android_scatter.txt
        preloader_*.bin
        MTK_AllInOne_DA*.bin
        *.auth
        boot.img
        vendor_boot.img
        super.img
```

Recognized metadata includes:

- `*_Android_scatter.txt`
- `preloader*.bin`
- Download Agent binaries
- authentication files
- partition images

BobFWTools does not treat SLA/DAA/BootROM bypasses as valid service artifacts.

## Quarantine policy

Files or paths containing known bypass/exploit markers are indexed as blocked and excluded from firmware planning.

Examples include:

- `auth-bypass`
- `sla-bypass`
- `daa-bypass`
- `brom-bypass`
- `edl-bypass`
- `sahara-bypass`
- `firehose-patched`
- `exploit`

The library scanner does not delete these files. It marks them as ineligible so an operator can remove or isolate them deliberately.

## Release boundary

Firmware indexing, chipset lookup, hashing, package classification, and dry-run planning are safe software capabilities.

Actual destructive writes remain independently locked behind:

1. exact device identity
2. package/model compatibility
3. loader/DA authorization
4. backup/recovery readiness
5. physical bench qualification
6. explicit approval
7. post-write verification

No catalog entry bypasses those gates.
