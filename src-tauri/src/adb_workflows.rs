use serde::Serialize;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::process::{Command, Output};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbDeviceRecord {
    pub serial: String,
    pub state: String,
    pub details: Vec<String>,
    pub authorized: bool,
    pub evidence_source: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbDeviceInfo {
    pub serial: String,
    pub properties: BTreeMap<String, String>,
    pub verified: bool,
    pub evidence_source: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbTextResult {
    pub serial: String,
    pub workflow: &'static str,
    pub output: String,
    pub verified: bool,
    pub evidence_source: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbActionResult {
    pub serial: String,
    pub workflow: &'static str,
    pub accepted: bool,
    pub verified: bool,
    pub message: String,
    pub evidence_source: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbFileResult {
    pub serial: String,
    pub workflow: &'static str,
    pub destination: String,
    pub bytes: u64,
    pub verified: bool,
    pub evidence_source: &'static str,
}

fn run_adb(args: &[&str]) -> Result<Output, String> {
    Command::new("adb")
        .args(args)
        .output()
        .map_err(|e| format!("Failed to launch adb: {e}"))
}

fn require_success(output: Output, action: &str) -> Result<Output, String> {
    if output.status.success() {
        Ok(output)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Err(format!(
            "{action} failed: {}",
            if !stderr.is_empty() { stderr } else { stdout }
        ))
    }
}

fn device_state(serial: &str) -> Result<String, String> {
    let output = require_success(run_adb(&["devices", "-l"])?, "adb devices")?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    for line in stdout.lines().skip(1) {
        let mut parts = line.split_whitespace();
        let Some(found_serial) = parts.next() else { continue };
        let Some(state) = parts.next() else { continue };
        if found_serial == serial {
            return Ok(state.to_string());
        }
    }

    Err(format!("ADB device {serial} is not currently connected"))
}

fn require_authorized(serial: &str) -> Result<(), String> {
    let state = device_state(serial)?;
    if state != "device" {
        return Err(format!(
            "ADB device {serial} is not authorized for workflows (state: {state})"
        ));
    }
    Ok(())
}

fn get_property(serial: &str, key: &str) -> Result<String, String> {
    let output = require_success(
        run_adb(&["-s", serial, "shell", "getprop", key])?,
        &format!("getprop {key}"),
    )?;
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
pub fn adb_scan() -> Result<Vec<AdbDeviceRecord>, String> {
    let output = require_success(run_adb(&["devices", "-l"])?, "adb devices")?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    for line in stdout.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }
        let serial = parts[0].to_string();
        let state = parts[1].to_string();
        devices.push(AdbDeviceRecord {
            serial,
            authorized: state == "device",
            state,
            details: parts.iter().skip(2).map(|s| (*s).to_string()).collect(),
            evidence_source: "adb:devices-l",
        });
    }

    Ok(devices)
}

#[tauri::command]
pub fn adb_device_info(serial: String) -> Result<AdbDeviceInfo, String> {
    require_authorized(&serial)?;

    let keys = [
        "ro.product.manufacturer",
        "ro.product.brand",
        "ro.product.model",
        "ro.product.device",
        "ro.build.version.release",
        "ro.build.version.sdk",
        "ro.build.id",
        "ro.build.version.security_patch",
        "ro.bootloader",
        "ro.boot.verifiedbootstate",
    ];

    let mut properties = BTreeMap::new();
    for key in keys {
        let value = get_property(&serial, key)?;
        if !value.is_empty() {
            properties.insert(key.to_string(), value);
        }
    }

    if properties.is_empty() {
        return Err("ADB device info returned no verified properties".to_string());
    }

    Ok(AdbDeviceInfo {
        serial,
        properties,
        verified: true,
        evidence_source: "adb:shell-getprop",
    })
}

#[tauri::command]
pub fn adb_logcat_snapshot(serial: String, lines: Option<u32>) -> Result<AdbTextResult, String> {
    require_authorized(&serial)?;
    let limit = lines.unwrap_or(250).clamp(25, 2000).to_string();
    let output = require_success(
        run_adb(&["-s", &serial, "logcat", "-d", "-t", &limit])?,
        "adb logcat snapshot",
    )?;

    let text = String::from_utf8_lossy(&output.stdout).to_string();
    if text.trim().is_empty() {
        return Err("ADB logcat completed but returned no log lines".to_string());
    }

    Ok(AdbTextResult {
        serial,
        workflow: "logcat-snapshot",
        output: text,
        verified: true,
        evidence_source: "adb:logcat-dump",
    })
}

#[tauri::command]
pub fn adb_screenshot(serial: String, destination_path: String) -> Result<AdbFileResult, String> {
    require_authorized(&serial)?;
    let output = require_success(
        run_adb(&["-s", &serial, "exec-out", "screencap", "-p"])?,
        "adb screenshot",
    )?;

    const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
    if output.stdout.len() < PNG_SIGNATURE.len() || &output.stdout[..8] != PNG_SIGNATURE {
        return Err("ADB screenshot did not return a valid PNG payload".to_string());
    }

    let destination = PathBuf::from(&destination_path);
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create screenshot destination directory: {e}"))?;
    }
    std::fs::write(&destination, &output.stdout)
        .map_err(|e| format!("Failed to write screenshot: {e}"))?;

    let written = std::fs::metadata(&destination)
        .map_err(|e| format!("Failed to verify screenshot: {e}"))?
        .len();

    if written != output.stdout.len() as u64 {
        return Err(format!(
            "Screenshot verification failed: expected {} bytes, found {}",
            output.stdout.len(),
            written
        ));
    }

    Ok(AdbFileResult {
        serial,
        workflow: "screenshot",
        destination: destination.to_string_lossy().to_string(),
        bytes: written,
        verified: true,
        evidence_source: "adb:exec-out-screencap+png-signature+local-size",
    })
}


#[tauri::command]
pub fn adb_prepare() -> Result<Vec<AdbDeviceRecord>, String> {
    require_success(run_adb(&["start-server"])?, "adb start-server")?;
    adb_scan()
}

#[tauri::command]
pub fn adb_battery_info(serial: String) -> Result<AdbTextResult, String> {
    require_authorized(&serial)?;
    let output = require_success(
        run_adb(&["-s", &serial, "shell", "dumpsys", "battery"])?,
        "adb battery info",
    )?;
    let text = String::from_utf8_lossy(&output.stdout).to_string();
    if text.trim().is_empty() {
        return Err("ADB battery info returned no data".to_string());
    }
    Ok(AdbTextResult {
        serial,
        workflow: "battery-info",
        output: text,
        verified: true,
        evidence_source: "adb:dumpsys-battery",
    })
}

#[tauri::command]
pub fn adb_reboot_mode(serial: String, mode: String) -> Result<AdbActionResult, String> {
    require_authorized(&serial)?;
    let (workflow, args): (&'static str, Vec<&str>) = match mode.as_str() {
        "normal" => ("reboot-normal", vec!["-s", &serial, "reboot"]),
        "recovery" => ("reboot-recovery", vec!["-s", &serial, "reboot", "recovery"]),
        "bootloader" => ("reboot-bootloader", vec!["-s", &serial, "reboot", "bootloader"]),
        "download" => ("reboot-download", vec!["-s", &serial, "reboot", "download"]),
        _ => return Err("Unsupported reboot mode".to_string()),
    };

    require_success(run_adb(&args)?, workflow)?;

    Ok(AdbActionResult {
        serial,
        workflow,
        accepted: true,
        verified: false,
        message: "ADB accepted the reboot command. The device will temporarily disconnect while changing modes.".to_string(),
        evidence_source: "adb:reboot-command-accepted",
    })
}

#[tauri::command]
pub fn adb_open_network_settings(serial: String) -> Result<AdbActionResult, String> {
    require_authorized(&serial)?;
    require_success(
        run_adb(&[
            "-s",
            &serial,
            "shell",
            "am",
            "start",
            "-a",
            "android.settings.NETWORK_SETTINGS",
        ])?,
        "open network settings",
    )?;

    Ok(AdbActionResult {
        serial,
        workflow: "open-network-settings",
        accepted: true,
        verified: true,
        message: "Android network settings opened on the connected device.".to_string(),
        evidence_source: "adb:am-start-network-settings",
    })
}

#[tauri::command]
pub fn adb_open_factory_reset_settings(serial: String) -> Result<AdbActionResult, String> {
    require_authorized(&serial)?;
    require_success(
        run_adb(&[
            "-s",
            &serial,
            "shell",
            "am",
            "start",
            "-a",
            "android.settings.FACTORY_RESET",
        ])?,
        "open factory reset settings",
    )?;

    Ok(AdbActionResult {
        serial,
        workflow: "open-factory-reset-settings",
        accepted: true,
        verified: true,
        message: "Android factory-reset settings opened. Final wipe confirmation remains on the device.".to_string(),
        evidence_source: "adb:am-start-factory-reset-settings",
    })
}

#[tauri::command]
pub fn adb_install_apk(serial: String, apk_path: String) -> Result<AdbActionResult, String> {
    require_authorized(&serial)?;
    let path = PathBuf::from(&apk_path);
    if !path.is_file() {
        return Err("APK path must point to a readable file".to_string());
    }
    if path.extension().and_then(|ext| ext.to_str()).map(|ext| ext.eq_ignore_ascii_case("apk")) != Some(true) {
        return Err("Only .apk files are accepted by this workflow".to_string());
    }

    let path_string = path.to_string_lossy().to_string();
    let output = require_success(
        run_adb(&["-s", &serial, "install", "-r", &path_string])?,
        "adb install apk",
    )?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let verified = stdout.lines().any(|line| line.trim() == "Success");
    if !verified {
        return Err(format!("ADB install returned success exit status but did not report Success: {}", stdout.trim()));
    }

    Ok(AdbActionResult {
        serial,
        workflow: "install-apk",
        accepted: true,
        verified: true,
        message: format!("APK installed from {}", path.display()),
        evidence_source: "adb:install-r+success-token",
    })
}
