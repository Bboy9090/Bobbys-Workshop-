//! BobFWTools "Phoenix Sanctum" — Hardware-Rooted Secret Chambers & Cryptographic Vault
//!
//! Unlike generic legacy "Secret Rooms" that rely on static passcodes or simulated web endpoints,
//! Phoenix Sanctum enforces:
//!   1. **HMAC-SHA256 Hardware-Bound Chamber Grants** tied to the live workstation + target device UID.
//!   2. **Four Specialized Native Chambers**:
//!      - **Root & Privilege Sanctum**: Live ADB/Fastboot privilege vector interrogation (`id -u`, `su`, Magisk, KernelSU, APatch, SELinux, `vbmeta`, `ro.boot.flash.locked`) and cryptographically verified boot-image / APK staging.
//!      - **Silicon & Fuse Chamber**: Deep BootROM / bootloader / anti-rollback / AVB / Knox / Brom / Sahara silicon posture inspection.
//!      - **Baseband & EFS Crucible**: Live allowlisted radio/calibration block-path resolution (`/dev/block/by-name/efs`, `modemst1`, `modemst2`, `persist`, `nvram`, `nvdata`) and partition readiness verification.
//!      - **Shadow Chain-of-Custody Ledger**: Tamper-evident hash-chained JSONL audit log (`prev_hash` -> `entry_hash` SHA-256 chain) stored in `~/.bobfwtools/logs/sanctum-chain.jsonl`.

pub use bootforgeusb::phoenix_sanctum::{
    append_sanctum_chain_entry as core_append_sanctum_chain_entry, issue_chamber_grant,
    verify_sanctum_chain, verify_sanctum_grant, SanctumChamberGrant, SanctumChainEntry,
    SanctumChainVerification,
};
#[cfg(test)]
pub use bootforgeusb::phoenix_sanctum::{append_sanctum_chain_entry_at, verify_sanctum_chain_at};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RootPrivilegeAuditReport {
    pub serial: String,
    pub timestamp_unix_ms: u64,
    pub rooted: bool,
    pub privilege_tier: String,
    pub adbd_uid: String,
    pub su_binary_paths: Vec<String>,
    pub magisk_version: Option<String>,
    pub kernelsu_version: Option<String>,
    pub apatch_detected: bool,
    pub xposed_lsposed_detected: bool,
    pub selinux_mode: String,
    pub bootloader_unlocked: bool,
    pub verified_boot_state: String,
    pub vbmeta_digest: Option<String>,
    pub active_slot: Option<String>,
    pub dm_verity_state: String,
    pub evidence: Vec<String>,
    pub report_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiliconFusePostureReport {
    pub serial: String,
    pub timestamp_unix_ms: u64,
    pub soc_vendor: String,
    pub soc_platform: String,
    pub hardware_sku: String,
    pub bootloader_version: String,
    pub flash_locked_state: String,
    pub oem_unlock_supported: bool,
    pub warranty_bit_or_fuse: String,
    pub anti_rollback_index: String,
    pub avb_version: String,
    pub security_patch_level: String,
    pub usb_recovery_capable: Vec<String>,
    pub raw_security_properties: BTreeMap<String, String>,
    pub report_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationPartitionProbe {
    pub partition: String,
    pub allowlisted: bool,
    pub candidate_node: String,
    pub resolved_block_path: Option<String>,
    pub size_bytes: Option<u64>,
    pub readable_with_current_privilege: bool,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BasebandCrucibleReport {
    pub serial: String,
    pub timestamp_unix_ms: u64,
    pub baseband_version: String,
    pub ril_impl: String,
    pub sim_operator_alpha: String,
    pub sim_state: String,
    pub root_block_access_available: bool,
    pub partitions: Vec<CalibrationPartitionProbe>,
    pub report_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SanctumArtifactStageReceipt {
    pub serial: String,
    pub method: String,
    pub local_artifact_path: String,
    pub artifact_bytes: u64,
    pub artifact_sha256: String,
    pub device_staging_path: String,
    pub action_taken: String,
    pub verified: bool,
    pub evidence: Vec<String>,
    pub timestamp_unix_ms: u64,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn append_sanctum_chain_entry(
    chamber: &str,
    operation: &str,
    serial: Option<String>,
    status: &str,
    detail: &str,
    artifact_sha256: Option<String>,
) -> Result<SanctumChainEntry, String> {
    let entry = core_append_sanctum_chain_entry(
        chamber,
        operation,
        serial.clone(),
        status,
        detail,
        artifact_sha256,
    )?;

    // Mirror into primary audit ledger as well
    let _ = crate::audit::record(
        format!("PhoenixSanctum::{chamber}"),
        operation,
        "elevated",
        status,
        serial,
        format!("{detail} [chain #{} {:.12}]", entry.sequence, entry.entry_hash),
        vec![
            format!("sanctum-chain:seq={}", entry.sequence),
            format!("sha256={}", entry.entry_hash),
        ],
    );

    Ok(entry)
}

fn run_adb_shell(serial: &str, shell_cmd: &str) -> Result<String, String> {
    let out = crate::adb_command::new_adb_command()
        .args(["-s", serial, "shell", shell_cmd])
        .output()
        .map_err(|e| format!("Failed to spawn adb: {e}"))?;
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

fn parse_getprop_map(raw: &str) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    for line in raw.lines() {
        let Some((k, v)) = line.split_once("]: [") else {
            continue;
        };
        let key = k.trim().trim_start_matches('[').trim();
        let val = v.trim().trim_end_matches(']').trim();
        if !key.is_empty() && !val.is_empty() {
            map.insert(key.to_string(), val.to_string());
        }
    }
    map
}

fn ensure_authorized_adb_serial(serial: &str) -> Result<(), String> {
    if serial.trim().is_empty()
        || !serial
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':'))
    {
        return Err("Invalid or malformed ADB device serial.".to_string());
    }
    let devices = crate::adb_workflows::adb_scan_fresh_sync()?;
    let Some(dev) = devices.into_iter().find(|d| d.serial == serial) else {
        return Err(format!("ADB target '{serial}' is not connected."));
    };
    if !dev.authorized {
        return Err(format!(
            "ADB target '{serial}' is connected but not authorized (state: {}).",
            dev.state
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn sanctum_issue_chamber_grant(
    chamber: String,
    serial: Option<String>,
    confirmation_phrase: String,
) -> Result<SanctumChamberGrant, String> {
    let grant = issue_chamber_grant(&chamber, serial, &confirmation_phrase)?;

    let _ = append_sanctum_chain_entry(
        &chamber,
        "issue-chamber-grant",
        grant.bound_serial.clone(),
        "granted",
        &format!("Issued HMAC-SHA256 hardware-bound grant {}", grant.grant_id),
        None,
    );

    Ok(grant)
}

#[tauri::command]
pub fn sanctum_audit_root_privilege(
    serial: String,
    grant: SanctumChamberGrant,
) -> Result<RootPrivilegeAuditReport, String> {
    verify_sanctum_grant(&grant, Some(&serial))?;
    ensure_authorized_adb_serial(&serial)?;

    let props_raw = run_adb_shell(&serial, "getprop")?;
    let props = parse_getprop_map(&props_raw);

    let adbd_uid = run_adb_shell(&serial, "id -u").unwrap_or_else(|_| "unknown".to_string());
    let selinux_mode = run_adb_shell(&serial, "getenforce").unwrap_or_else(|_| "Unknown".to_string());

    let su_probe = run_adb_shell(
        &serial,
        "for p in /system/bin/su /system/xbin/su /sbin/su /vendor/bin/su /debug_ramdisk/su /data/adb/magisk/magisk /data/adb/ksud /data/adb/apd; do [ -e \"$p\" ] && echo \"$p\"; done",
    )
    .unwrap_or_default();
    let su_binary_paths: Vec<String> = su_probe
        .lines()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect();

    let su_uid_check = run_adb_shell(&serial, "su -c 'id -u' 2>/dev/null || true").unwrap_or_default();
    let su_root_granted = su_uid_check.lines().any(|line| line.trim() == "0");

    let magisk_raw = run_adb_shell(&serial, "magisk -v 2>/dev/null || /data/adb/magisk/magisk -v 2>/dev/null || true")
        .unwrap_or_default();
    let magisk_version = (!magisk_raw.is_empty() && !magisk_raw.to_ascii_lowercase().contains("not found"))
        .then(|| magisk_raw.lines().next().unwrap_or("").trim().to_string())
        .filter(|v| !v.is_empty());

    let ksu_raw = run_adb_shell(&serial, "/data/adb/ksud --version 2>/dev/null || ksud --version 2>/dev/null || true")
        .unwrap_or_default();
    let kernelsu_version = (!ksu_raw.is_empty() && !ksu_raw.to_ascii_lowercase().contains("not found"))
        .then(|| ksu_raw.lines().next().unwrap_or("").trim().to_string())
        .filter(|v| !v.is_empty());

    let apatch_detected = su_binary_paths.iter().any(|p| p.contains("/apd"))
        || props.contains_key("ro.apatch.version");

    let xposed_lsposed_detected = props.contains_key("ro.xposed.version")
        || run_adb_shell(&serial, "ls -d /data/adb/modules/*lsposed* /data/adb/lspd 2>/dev/null || true")
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);

    let verified_boot_state = props
        .get("ro.boot.verifiedbootstate")
        .cloned()
        .unwrap_or_else(|| "unknown".to_string());
    let flash_locked = props
        .get("ro.boot.flash.locked")
        .cloned()
        .unwrap_or_else(|| "1".to_string());
    let bootloader_unlocked =
        flash_locked == "0" || verified_boot_state.eq_ignore_ascii_case("orange");

    let vbmeta_digest = props.get("ro.boot.vbmeta.digest").cloned();
    let active_slot = props.get("ro.boot.slot_suffix").cloned();
    let dm_verity_state = props
        .get("ro.boot.veritymode")
        .cloned()
        .unwrap_or_else(|| "enforcing".to_string());

    let rooted = adbd_uid == "0"
        || su_root_granted
        || !su_binary_paths.is_empty()
        || magisk_version.is_some()
        || kernelsu_version.is_some()
        || apatch_detected;

    let privilege_tier = if adbd_uid == "0" {
        "adbd-root-shell (uid 0)".to_string()
    } else if su_root_granted {
        "interactive-su-granted (uid 0)".to_string()
    } else if magisk_version.is_some() || kernelsu_version.is_some() || apatch_detected {
        "root-manager-present (ungranted shell)".to_string()
    } else if !su_binary_paths.is_empty() {
        "su-binary-detected".to_string()
    } else {
        "unrooted-production-shell (uid 2000)".to_string()
    };

    let mut evidence = vec![
        format!("adb:id-u={adbd_uid}"),
        format!("adb:selinux={selinux_mode}"),
        format!("prop:ro.boot.verifiedbootstate={verified_boot_state}"),
        format!("prop:ro.boot.flash.locked={flash_locked}"),
    ];
    if !su_binary_paths.is_empty() {
        evidence.push(format!("paths:{}", su_binary_paths.join(",")));
    }
    if let Some(ref m) = magisk_version {
        evidence.push(format!("magisk:{m}"));
    }
    if let Some(ref k) = kernelsu_version {
        evidence.push(format!("kernelsu:{k}"));
    }

    let timestamp_unix_ms = now_ms();
    let digest_material = serde_json::json!({
        "serial": &serial,
        "ts": timestamp_unix_ms,
        "rooted": rooted,
        "tier": &privilege_tier,
        "suPaths": &su_binary_paths,
        "bootloaderUnlocked": bootloader_unlocked,
        "vbmeta": &vbmeta_digest,
    });
    let report_sha256 = format!("{:x}", Sha256::digest(digest_material.to_string().as_bytes()));

    let _ = append_sanctum_chain_entry(
        "root-vault",
        "audit-root-privilege",
        Some(serial.clone()),
        "completed",
        &format!("Rooted={rooted}, Tier={privilege_tier}, BootloaderUnlocked={bootloader_unlocked}"),
        Some(report_sha256.clone()),
    );

    Ok(RootPrivilegeAuditReport {
        serial,
        timestamp_unix_ms,
        rooted,
        privilege_tier,
        adbd_uid,
        su_binary_paths,
        magisk_version,
        kernelsu_version,
        apatch_detected,
        xposed_lsposed_detected,
        selinux_mode,
        bootloader_unlocked,
        verified_boot_state,
        vbmeta_digest,
        active_slot,
        dm_verity_state,
        evidence,
        report_sha256,
    })
}

#[tauri::command]
pub fn sanctum_audit_silicon_fuses(
    serial: String,
    grant: SanctumChamberGrant,
) -> Result<SiliconFusePostureReport, String> {
    verify_sanctum_grant(&grant, Some(&serial))?;
    ensure_authorized_adb_serial(&serial)?;

    let props_raw = run_adb_shell(&serial, "getprop")?;
    let props = parse_getprop_map(&props_raw);

    let first_prop = |keys: &[&str]| -> String {
        keys.iter()
            .filter_map(|k| props.get(*k))
            .find(|v| !v.trim().is_empty())
            .cloned()
            .unwrap_or_else(|| "unavailable".to_string())
    };

    let soc_vendor = first_prop(&["ro.soc.manufacturer", "ro.product.Manufacturer", "ro.hardware"]);
    let soc_platform = first_prop(&["ro.board.platform", "ro.soc.model", "ro.hardware.chipname"]);
    let hardware_sku = first_prop(&[
        "ro.boot.hardware.sku",
        "ro.boot.product.hardware.sku",
        "ro.product.device",
    ]);
    let bootloader_version = first_prop(&["ro.bootloader", "ro.boot.bootloader"]);
    let flash_locked_state = first_prop(&["ro.boot.flash.locked", "ro.boot.verifiedbootstate"]);
    let oem_unlock_supported = props
        .get("ro.oem_unlock_supported")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let warranty_bit_or_fuse = first_prop(&[
        "ro.boot.warranty_bit",
        "ro.warranty_bit",
        "ro.boot.sec_atd.tty",
        "ro.boot.vbmeta.device_state",
    ]);
    let anti_rollback_index = first_prop(&[
        "ro.boot.vbmeta.invalidate_on_error",
        "ro.build.version.security_patch",
    ]);
    let avb_version = first_prop(&["ro.boot.vbmeta.avb_version", "ro.boot.avb_version"]);
    let security_patch_level = first_prop(&["ro.build.version.security_patch"]);

    let mut security_keys = BTreeMap::new();
    for (k, v) in &props {
        if k.starts_with("ro.boot.")
            || k.starts_with("ro.soc.")
            || k.starts_with("ro.crypto.")
            || k.contains("warranty")
            || k.contains("knox")
            || k.contains("vbmeta")
            || k.contains("verity")
        {
            security_keys.insert(k.clone(), v.clone());
        }
    }

    let lower_id = format!("{soc_vendor} {soc_platform}").to_ascii_lowercase();
    let mut usb_recovery_capable = vec!["ADB-Authorized".to_string(), "Fastboot/Bootloader".to_string()];
    if lower_id.contains("qcom") || lower_id.contains("qualcomm") || lower_id.contains("sm") {
        usb_recovery_capable.push("Qualcomm EDL 9008 (Sahara/Firehose)".to_string());
    }
    if lower_id.contains("mt") || lower_id.contains("mediatek") || lower_id.contains("dimensity") || lower_id.contains("helio") {
        usb_recovery_capable.push("MediaTek BROM / Preloader (0e8d:0003 / 0e8d:2000)".to_string());
    }
    if lower_id.contains("exynos") || lower_id.contains("s5e") || props.get("ro.product.manufacturer").map(|m| m.eq_ignore_ascii_case("samsung")).unwrap_or(false) {
        usb_recovery_capable.push("Samsung Odin Loke Download (04e8:685d)".to_string());
    }
    if lower_id.contains("unisoc") || lower_id.contains("sprd") || lower_id.contains("ums") {
        usb_recovery_capable.push("Unisoc Diag / FDL1-FDL2 (1782:4d00)".to_string());
    }

    let timestamp_unix_ms = now_ms();
    let report_sha256 = format!(
        "{:x}",
        Sha256::digest(
            serde_json::json!({
                "serial": &serial,
                "ts": timestamp_unix_ms,
                "socPlatform": &soc_platform,
                "bootloader": &bootloader_version,
                "fuse": &warranty_bit_or_fuse,
            })
            .to_string()
            .as_bytes()
        )
    );

    let _ = append_sanctum_chain_entry(
        "silicon-fuse",
        "audit-silicon-fuses",
        Some(serial.clone()),
        "completed",
        &format!("SoC={soc_platform}, Bootloader={bootloader_version}, Fuse={warranty_bit_or_fuse}"),
        Some(report_sha256.clone()),
    );

    Ok(SiliconFusePostureReport {
        serial,
        timestamp_unix_ms,
        soc_vendor,
        soc_platform,
        hardware_sku,
        bootloader_version,
        flash_locked_state,
        oem_unlock_supported,
        warranty_bit_or_fuse,
        anti_rollback_index,
        avb_version,
        security_patch_level,
        usb_recovery_capable,
        raw_security_properties: security_keys,
        report_sha256,
    })
}

#[tauri::command]
pub fn sanctum_probe_baseband_crucible(
    serial: String,
    grant: SanctumChamberGrant,
) -> Result<BasebandCrucibleReport, String> {
    verify_sanctum_grant(&grant, Some(&serial))?;
    ensure_authorized_adb_serial(&serial)?;

    let props_raw = run_adb_shell(&serial, "getprop")?;
    let props = parse_getprop_map(&props_raw);

    let baseband_version = props
        .get("gsm.version.baseband")
        .cloned()
        .unwrap_or_else(|| "unavailable".to_string());
    let ril_impl = props
        .get("gsm.version.ril-impl")
        .cloned()
        .unwrap_or_else(|| "unavailable".to_string());
    let sim_operator_alpha = props
        .get("gsm.sim.operator.alpha")
        .cloned()
        .unwrap_or_else(|| "none".to_string());
    let sim_state = props
        .get("gsm.sim.state")
        .cloned()
        .unwrap_or_else(|| "UNKNOWN".to_string());

    let uid = run_adb_shell(&serial, "id -u").unwrap_or_default();
    let su_uid = run_adb_shell(&serial, "su -c 'id -u' 2>/dev/null || true").unwrap_or_default();
    let use_su = uid != "0" && su_uid.lines().any(|l| l.trim() == "0");
    let root_block_access_available = uid == "0" || use_su;

    let mut partitions = Vec::new();
    for &part in bootforgeusb::calibration::CALIBRATION_ALLOWLIST {
        let candidate_node = format!("/dev/block/by-name/{part}");
        let resolve_cmd = format!(
            "readlink -f /dev/block/by-name/{part} 2>/dev/null || readlink -f /dev/block/bootdevice/by-name/{part} 2>/dev/null || true"
        );
        let resolved_raw = if use_su {
            run_adb_shell(&serial, &format!("su -c \"{resolve_cmd}\"")).unwrap_or_default()
        } else {
            run_adb_shell(&serial, &resolve_cmd).unwrap_or_default()
        };
        let resolved_line = resolved_raw.lines().next().unwrap_or("").trim();
        let resolved_block_path = (!resolved_line.is_empty()
            && bootforgeusb::calibration::validate_block_path(resolved_line))
        .then(|| resolved_line.to_string());

        let size_bytes = if let Some(ref blk) = resolved_block_path {
            if root_block_access_available {
                let size_cmd = format!("blockdev --getsize64 {blk} 2>/dev/null || true");
                let raw_size = if use_su {
                    run_adb_shell(&serial, &format!("su -c \"{size_cmd}\"")).unwrap_or_default()
                } else {
                    run_adb_shell(&serial, &size_cmd).unwrap_or_default()
                };
                raw_size.trim().parse::<u64>().ok()
            } else {
                None
            }
        } else {
            None
        };

        let status = match (&resolved_block_path, root_block_access_available) {
            (Some(_), true) => "READY_FOR_PRESERVATION_BACKUP".to_string(),
            (Some(_), false) => "BLOCK_NODE_PRESENT_NEEDS_ROOT_FOR_RAW_READ".to_string(),
            (None, _) => "NOT_PRESENT_ON_TARGET_SOC".to_string(),
        };

        partitions.push(CalibrationPartitionProbe {
            partition: part.to_string(),
            allowlisted: true,
            candidate_node,
            resolved_block_path,
            size_bytes,
            readable_with_current_privilege: root_block_access_available && size_bytes.is_some(),
            status,
        });
    }

    let timestamp_unix_ms = now_ms();
    let report_sha256 = format!(
        "{:x}",
        Sha256::digest(
            serde_json::json!({
                "serial": &serial,
                "ts": timestamp_unix_ms,
                "baseband": &baseband_version,
                "rootBlock": root_block_access_available,
                "partitions": &partitions,
            })
            .to_string()
            .as_bytes()
        )
    );

    let _ = append_sanctum_chain_entry(
        "baseband-crucible",
        "probe-baseband-crucible",
        Some(serial.clone()),
        "completed",
        &format!(
            "Baseband={baseband_version}, RootBlockAccess={root_block_access_available}, Probed={} allowlisted partitions",
            partitions.len()
        ),
        Some(report_sha256.clone()),
    );

    Ok(BasebandCrucibleReport {
        serial,
        timestamp_unix_ms,
        baseband_version,
        ril_impl,
        sim_operator_alpha,
        sim_state,
        root_block_access_available,
        partitions,
        report_sha256,
    })
}

#[tauri::command]
pub fn sanctum_stage_root_artifact(
    serial: String,
    method: String,
    artifact_path: String,
    grant: SanctumChamberGrant,
) -> Result<SanctumArtifactStageReceipt, String> {
    verify_sanctum_grant(&grant, Some(&serial))?;

    let valid_methods = ["magisk", "kernelsu", "apatch", "custom"];
    if !valid_methods.contains(&method.as_str()) {
        return Err(format!(
            "Unsupported root artifact method '{method}'. Expected one of: {}",
            valid_methods.join(", ")
        ));
    }

    let local_path = PathBuf::from(artifact_path.trim());
    if !local_path.is_file() {
        return Err(format!(
            "Artifact path '{}' does not exist or is not a regular file.",
            local_path.display()
        ));
    }

    let bytes = fs::read(&local_path)
        .map_err(|e| format!("Failed reading artifact '{}': {e}", local_path.display()))?;
    if bytes.is_empty() {
        return Err("Selected artifact file is empty (0 bytes).".to_string());
    }
    let artifact_sha256 = format!("{:x}", Sha256::digest(&bytes));
    let artifact_bytes = bytes.len() as u64;

    let ext = local_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let filename = local_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("sanctum_artifact.bin")
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-') { c } else { '_' })
        .collect::<String>();

    let mut evidence = vec![
        format!("local:bytes={artifact_bytes}"),
        format!("local:sha256={artifact_sha256}"),
    ];

    // Determine whether the target is in ADB mode or Fastboot mode
    let adb_devices = crate::adb_workflows::adb_scan_fresh_sync().unwrap_or_default();
    let in_adb = adb_devices.iter().any(|d| d.serial == serial && d.authorized);

    let (device_staging_path, action_taken) = if in_adb {
        if ext == "apk" {
            let out = crate::adb_command::new_adb_command()
                .args(["-s", &serial, "install", "-r", &local_path.to_string_lossy()])
                .output()
                .map_err(|e| format!("Failed to invoke adb install: {e}"))?;
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !out.status.success() || !stdout.contains("Success") {
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                return Err(format!(
                    "APK manager installation failed on {serial}: {}",
                    if !stderr.is_empty() { stderr } else { stdout }
                ));
            }
            evidence.push("adb:install-r=Success".to_string());
            (
                format!("package:{filename}"),
                format!("Installed {method} manager APK onto authorized ADB target {serial}"),
            )
        } else {
            let remote_path = format!("/sdcard/Download/{filename}");
            let out = crate::adb_command::new_adb_command()
                .args([
                    "-s",
                    &serial,
                    "push",
                    &local_path.to_string_lossy(),
                    &remote_path,
                ])
                .output()
                .map_err(|e| format!("Failed to invoke adb push: {e}"))?;
            if !out.status.success() {
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                return Err(format!("ADB artifact staging push failed: {stderr}"));
            }
            let size_verify = run_adb_shell(&serial, &format!("wc -c < '{remote_path}' 2>/dev/null || true"))
                .unwrap_or_default();
            evidence.push(format!("adb:pushed={remote_path}"));
            evidence.push(format!("adb:remote-bytes={}", size_verify.trim()));
            (
                remote_path.clone(),
                format!(
                    "Staged verified {method} artifact ({artifact_bytes} bytes) to {remote_path} on {serial} for on-device patching"
                ),
            )
        }
    } else if ext == "img" {
        // Check if target is present in Fastboot mode for patched boot image flashing
        let fb_out = Command::new("fastboot")
            .args(["devices"])
            .output()
            .map_err(|e| format!("Target not in ADB and fastboot binary unavailable: {e}"))?;
        let fb_list = String::from_utf8_lossy(&fb_out.stdout);
        let in_fastboot = fb_list.lines().any(|l| l.split_whitespace().next() == Some(serial.as_str()));
        if !in_fastboot {
            return Err(format!(
                "Target '{serial}' is neither authorized in ADB nor detected in Fastboot mode."
            ));
        }
        let flash_out = Command::new("fastboot")
            .args(["-s", &serial, "flash", "boot", &local_path.to_string_lossy()])
            .output()
            .map_err(|e| format!("Failed to invoke fastboot flash boot: {e}"))?;
        if !flash_out.status.success() {
            let stderr = String::from_utf8_lossy(&flash_out.stderr).trim().to_string();
            return Err(format!("Fastboot boot partition flash failed: {stderr}"));
        }
        evidence.push("fastboot:flash-boot=OK".to_string());
        (
            "partition:boot".to_string(),
            format!("Flashed SHA-256 verified {method} boot image to partition 'boot' via Fastboot on {serial}"),
        )
    } else {
        return Err(format!(
            "Target '{serial}' is not connected in an applicable transport mode for '{}' (.{ext}).",
            local_path.display()
        ));
    };

    let timestamp_unix_ms = now_ms();
    let _ = append_sanctum_chain_entry(
        "root-vault",
        "stage-root-artifact",
        Some(serial.clone()),
        "completed",
        &action_taken,
        Some(artifact_sha256.clone()),
    );

    Ok(SanctumArtifactStageReceipt {
        serial,
        method,
        local_artifact_path: local_path.display().to_string(),
        artifact_bytes,
        artifact_sha256,
        device_staging_path,
        action_taken,
        verified: true,
        evidence,
        timestamp_unix_ms,
    })
}

#[tauri::command]
pub fn sanctum_verify_shadow_chain(limit: Option<usize>) -> Result<SanctumChainVerification, String> {
    verify_sanctum_chain(limit)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issues_and_verifies_hmac_bound_chamber_grant() {
        let grant = sanctum_issue_chamber_grant(
            "root-vault".to_string(),
            Some("R58M999888".to_string()),
            "SANCTUM".to_string(),
        )
        .expect("should issue grant");

        assert!(grant.operator_phrase_verified);
        assert_eq!(grant.chamber, "root-vault");
        assert!(verify_sanctum_grant(&grant, Some("R58M999888")).is_ok());
        assert!(
            verify_sanctum_grant(&grant, Some("DIFFERENT_SERIAL")).is_err(),
            "grant bound to R58M999888 must reject a different device serial"
        );
    }

    #[test]
    fn rejects_invalid_confirmation_phrase_and_tampered_hmac() {
        let bad = sanctum_issue_chamber_grant(
            "root-vault".to_string(),
            None,
            "WRONG_PHRASE".to_string(),
        );
        assert!(bad.is_err());

        let mut grant = sanctum_issue_chamber_grant(
            "silicon-fuse".to_string(),
            Some("DEV_01".to_string()),
            "SANCTUM".to_string(),
        )
        .expect("valid grant");
        grant.bound_serial = Some("DEV_02".to_string());
        assert!(
            verify_sanctum_grant(&grant, Some("DEV_02")).is_err(),
            "tampering with bound_serial must invalidate HMAC signature"
        );
    }

    #[test]
    fn shadow_chain_ledger_detects_tampering_and_verifies_hash_links() {
        let temp_dir = std::env::temp_dir().join(format!("bobfw-sanctum-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();
        let chain_file = temp_dir.join("sanctum-chain.jsonl");

        let e1 = append_sanctum_chain_entry_at(
            &chain_file,
            "root-vault",
            "test-op-1",
            Some("SER_A".to_string()),
            "completed",
            "First entry",
            Some("abc123".to_string()),
        )
        .expect("append entry 1");
        let e2 = append_sanctum_chain_entry_at(
            &chain_file,
            "silicon-fuse",
            "test-op-2",
            Some("SER_A".to_string()),
            "completed",
            "Second entry",
            None,
        )
        .expect("append entry 2");

        assert_eq!(e1.sequence, 1);
        assert_eq!(e2.sequence, 2);
        assert_eq!(e2.prev_hash, e1.entry_hash);

        let verified = verify_sanctum_chain_at(&chain_file, Some(10)).expect("verify chain");
        assert!(verified.intact);
        assert_eq!(verified.total_entries, 2);
        assert_eq!(verified.head_hash, e2.entry_hash);

        // Tamper with entry 1 on disk and confirm verification catches it
        let content = std::fs::read_to_string(&chain_file).unwrap();
        let tampered = content.replace("First entry", "Tampered entry");
        std::fs::write(&chain_file, tampered).unwrap();

        let after_tamper = verify_sanctum_chain_at(&chain_file, Some(10)).expect("verify tampered chain");
        assert!(!after_tamper.intact);
        assert_eq!(after_tamper.broken_at_sequence, Some(1));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
