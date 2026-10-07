use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationBackupResult {
    pub device_uid: String,
    pub adb_serial: String,
    pub partition: String,
    pub resolved_block_path: String,
    pub backup_path: String,
    pub manifest_path: String,
    pub expected_bytes: u64,
    pub actual_bytes: u64,
    pub sha256: String,
    pub verified: bool,
    pub access_mode: String,
}

fn run_adb(serial: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("adb")
        .arg("-s")
        .arg(serial)
        .args(args)
        .output()
        .map_err(|e| format!("failed to launch adb: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn shell_as_root(serial: &str, command: &str, use_su: bool) -> Result<String, String> {
    if use_su {
        run_adb(serial, &["shell", "su", "-c", command])
    } else {
        run_adb(serial, &["shell", command])
    }
}

fn detect_root_access(serial: &str) -> Result<bool, String> {
    if run_adb(serial, &["shell", "id", "-u"]).map(|v| v.trim() == "0").unwrap_or(false) {
        return Ok(false);
    }
    if run_adb(serial, &["shell", "su", "-c", "id -u"]).map(|v| v.trim() == "0").unwrap_or(false) {
        return Ok(true);
    }
    Err("device is authorized for ADB but does not expose existing root/service block-read access".to_string())
}

fn current_device_uid(serial: &str) -> String {
    bootforgeusb::scan()
        .ok()
        .and_then(|devices| {
            devices.into_iter().find(|d| d.serial_number.as_deref() == Some(serial))
        })
        .map(|d| d.device_uid)
        .unwrap_or_else(|| format!("adb:{serial}"))
}

fn sanitize_filename(value: &str) -> String {
    value
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.') { c } else { '_' })
        .collect()
}

fn resolve_block_path(serial: &str, partition: &str, use_su: bool) -> Result<String, String> {
    if !bootforgeusb::calibration::is_allowlisted_partition(partition) {
        return Err(format!("{partition} is not in the calibration backup allowlist"));
    }
    let candidates = [
        format!("/dev/block/by-name/{partition}"),
        format!("/dev/block/bootdevice/by-name/{partition}"),
    ];
    for candidate in candidates {
        let cmd = format!("readlink -f {candidate} 2>/dev/null || true");
        let resolved = shell_as_root(serial, &cmd, use_su)?;
        let resolved = resolved.lines().next().unwrap_or("").trim();
        if !resolved.is_empty() && bootforgeusb::calibration::validate_block_path(resolved) {
            return Ok(resolved.to_string());
        }
    }
    Err(format!("could not resolve an allowlisted block path for {partition}"))
}

fn block_size(serial: &str, block_path: &str, use_su: bool) -> Result<u64, String> {
    if !bootforgeusb::calibration::validate_block_path(block_path) {
        return Err("resolved block path failed safety validation".to_string());
    }
    let cmd = format!("blockdev --getsize64 {block_path}");
    let raw = shell_as_root(serial, &cmd, use_su)?;
    raw.trim()
        .parse::<u64>()
        .map_err(|e| format!("invalid block size response: {e}"))
}

#[tauri::command]
pub fn backup_calibration_partition(
    adb_serial: String,
    partition: String,
    destination_dir: String,
) -> Result<CalibrationBackupResult, String> {
    let devices = crate::adb_workflows::adb_scan()?;
    let device = devices
        .iter()
        .find(|d| d.serial == adb_serial)
        .ok_or_else(|| "selected ADB device is no longer connected".to_string())?;
    if !device.authorized {
        return Err("selected ADB device is not authorized".to_string());
    }
    if !bootforgeusb::calibration::is_allowlisted_partition(&partition) {
        return Err(format!("{partition} is not an allowlisted calibration partition"));
    }

    let use_su = detect_root_access(&adb_serial)?;
    let access_mode = if use_su { "existing-su" } else { "root-shell" }.to_string();
    let resolved = resolve_block_path(&adb_serial, &partition, use_su)?;
    let expected_bytes = block_size(&adb_serial, &resolved, use_su)?;
    if expected_bytes == 0 {
        return Err("resolved calibration partition has zero byte length".to_string());
    }

    let device_uid = current_device_uid(&adb_serial);
    let out_dir = PathBuf::from(destination_dir);
    fs::create_dir_all(&out_dir).map_err(|e| format!("failed to create backup directory: {e}"))?;

    let base = format!(
        "{}_{}_calibration",
        sanitize_filename(&adb_serial),
        sanitize_filename(&partition)
    );
    let backup_path = out_dir.join(format!("{base}.img"));
    let manifest_path = out_dir.join(format!("{base}.manifest.json"));

    let mut command = Command::new("adb");
    command
        .arg("-s")
        .arg(&adb_serial)
        .arg("exec-out");
    if use_su {
        command.args(["su", "-c", &format!("cat {resolved}")]);
    } else {
        command.args(["cat", &resolved]);
    }
    command.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|e| format!("failed to launch calibration dump: {e}"))?;
    let mut stdout = child.stdout.take().ok_or_else(|| "failed to capture calibration dump stream".to_string())?;
    let mut output = File::create(&backup_path).map_err(|e| format!("failed to create backup file: {e}"))?;

    let mut hasher = Sha256::new();
    let mut total = 0u64;
    let mut buffer = vec![0u8; 1024 * 1024];
    loop {
        let read = stdout.read(&mut buffer).map_err(|e| format!("failed while reading device block stream: {e}"))?;
        if read == 0 {
            break;
        }
        output.write_all(&buffer[..read]).map_err(|e| format!("failed while writing backup file: {e}"))?;
        hasher.update(&buffer[..read]);
        total = total.saturating_add(read as u64);
        if total > expected_bytes {
            let _ = child.kill();
            let _ = fs::remove_file(&backup_path);
            return Err("device returned more bytes than the verified partition size".to_string());
        }
    }

    let result = child.wait_with_output().map_err(|e| format!("failed waiting for calibration dump: {e}"))?;
    if !result.status.success() {
        let _ = fs::remove_file(&backup_path);
        return Err(format!(
            "calibration dump failed: {}",
            String::from_utf8_lossy(&result.stderr).trim()
        ));
    }

    output.sync_all().map_err(|e| format!("failed to sync backup to disk: {e}"))?;
    let digest = format!("{:x}", hasher.finalize());
    let verified = total == expected_bytes;
    if !verified {
        let _ = fs::remove_file(&backup_path);
        return Err(format!(
            "calibration backup size mismatch: expected {expected_bytes} bytes, received {total}"
        ));
    }

    let manifest = bootforgeusb::calibration::CalibrationBackupManifest {
        device_uid: device_uid.clone(),
        model: None,
        serial: Some(adb_serial.clone()),
        partition: partition.clone(),
        source_block_path: resolved.clone(),
        bytes: total,
        sha256: digest.clone(),
        created_at_unix_ms: crate::now_ms(),
    };
    let manifest_json = serde_json::to_vec_pretty(&manifest)
        .map_err(|e| format!("failed to serialize backup manifest: {e}"))?;
    fs::write(&manifest_path, manifest_json)
        .map_err(|e| format!("failed to write backup manifest: {e}"))?;

    Ok(CalibrationBackupResult {
        device_uid,
        adb_serial,
        partition,
        resolved_block_path: resolved,
        backup_path: backup_path.display().to_string(),
        manifest_path: manifest_path.display().to_string(),
        expected_bytes,
        actual_bytes: total,
        sha256: digest,
        verified,
        access_mode,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filename_sanitizer_blocks_path_material() {
        assert_eq!(sanitize_filename("../a/b"), ".._a_b");
    }
}


#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationBackupInspection {
    pub manifest: bootforgeusb::calibration::CalibrationBackupManifest,
    pub image_path: String,
    pub actual_bytes: u64,
    pub actual_sha256: String,
    pub same_device_verified: bool,
    pub ready_for_restore_preflight: bool,
}

#[tauri::command]
pub fn inspect_calibration_backup(
    manifest_path: String,
    image_path: String,
    current_device_uid: String,
) -> Result<CalibrationBackupInspection, String> {
    let manifest_bytes = fs::read(&manifest_path)
        .map_err(|e| format!("failed reading calibration manifest: {e}"))?;
    let manifest: bootforgeusb::calibration::CalibrationBackupManifest =
        serde_json::from_slice(&manifest_bytes)
            .map_err(|e| format!("failed parsing calibration manifest: {e}"))?;

    let image = PathBuf::from(&image_path);
    if !image.is_file() {
        return Err("calibration backup image does not exist".to_string());
    }

    let (actual_bytes, actual_sha256) = {
        let mut file = File::open(&image)
            .map_err(|e| format!("failed opening calibration image: {e}"))?;
        let bytes = file.metadata()
            .map_err(|e| format!("failed reading calibration image metadata: {e}"))?
            .len();
        let mut hasher = Sha256::new();
        let mut buffer = vec![0u8; 1024 * 1024];
        loop {
            let n = file.read(&mut buffer)
                .map_err(|e| format!("failed hashing calibration image: {e}"))?;
            if n == 0 { break; }
            hasher.update(&buffer[..n]);
        }
        (bytes, format!("{:x}", hasher.finalize()))
    };

    bootforgeusb::calibration::validate_restore_binding(
        &manifest,
        &current_device_uid,
        &manifest.partition,
        actual_bytes,
        &actual_sha256,
    )?;

    Ok(CalibrationBackupInspection {
        manifest,
        image_path,
        actual_bytes,
        actual_sha256,
        same_device_verified: true,
        ready_for_restore_preflight: true,
    })
}
