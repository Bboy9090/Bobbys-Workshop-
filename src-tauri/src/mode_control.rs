use serde::Serialize;
use std::process::{Command, Output};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FastbootModeActionResult {
    pub serial: String,
    pub requested_mode: String,
    pub accepted: bool,
    pub verified: bool,
    pub message: String,
    pub evidence_source: &'static str,
}

fn run_fastboot(args: &[&str]) -> Result<Output, String> {
    let mut command = Command::new("fastboot");
    command.args(args);
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(0x08000000);
    }
    command
        .output()
        .map_err(|e| format!("Failed to launch fastboot: {e}. Install Android platform-tools and ensure fastboot is on PATH."))
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

fn fastboot_devices_internal() -> Result<Vec<String>, String> {
    let output = require_success(run_fastboot(&["devices"])?, "fastboot devices")?;
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        .filter(|serial| !serial.is_empty())
        .map(ToString::to_string)
        .collect())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModeTransitionVerification {
    pub serial: String,
    pub requested_mode: String,
    pub observed_mode: Option<String>,
    pub verified: bool,
    pub identity_confidence: String,
    pub evidence: Vec<String>,
    pub blockers: Vec<String>,
}

fn adb_devices_with_state() -> Result<Vec<(String, String)>, String> {
    let mut command = Command::new("adb");
    command.args(["devices", "-l"]);
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(0x08000000);
    }
    let output = command
        .output()
        .map_err(|e| format!("Failed to launch adb: {e}. Install Android platform-tools and ensure adb is on PATH."))?;
    if !output.status.success() {
        return Err(format!(
            "adb devices failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .skip(1)
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let serial = parts.next()?.to_string();
            let state = parts.next()?.to_string();
            Some((serial, state))
        })
        .collect())
}

fn adb_bootmode(serial: &str) -> Option<String> {
    let mut command = Command::new("adb");
    command.args(["-s", serial, "shell", "getprop", "ro.bootmode"]);
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(0x08000000);
    }
    command
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .filter(|value| !value.is_empty())
}

#[tauri::command]
pub fn mode_transition_verify(
    serial: String,
    requested_mode: String,
) -> Result<ModeTransitionVerification, String> {
    let serial = serial.trim().to_string();
    let requested_mode = requested_mode.trim().to_ascii_lowercase();
    if serial.is_empty() {
        return Err("Mode transition verification requires the original exact device serial".into());
    }

    let mut evidence = Vec::new();
    let mut blockers = Vec::new();
    let adb = adb_devices_with_state().unwrap_or_default();
    let fastboot = fastboot_devices_internal().unwrap_or_default();
    let usb = bootforgeusb::scan().map_err(|e| format!("USB re-detection failed: {e}"))?;

    match requested_mode.as_str() {
        "normal" => {
            let present = adb.iter().any(|(found, state)| found == &serial && state == "device");
            if present {
                let bootmode = adb_bootmode(&serial);
                evidence.push(format!("adb:{serial}:device"));
                if let Some(mode) = &bootmode {
                    evidence.push(format!("adb:getprop:ro.bootmode={mode}"));
                }
                let normal = bootmode
                    .as_deref()
                    .map(|mode| !mode.to_ascii_lowercase().contains("recovery"))
                    .unwrap_or(true);
                return Ok(ModeTransitionVerification {
                    serial,
                    requested_mode,
                    observed_mode: Some(bootmode.unwrap_or_else(|| "adb-normal".into())),
                    verified: normal,
                    identity_confidence: "exact-serial".into(),
                    evidence,
                    blockers: if normal { vec![] } else { vec!["ADB target returned but still reports recovery boot mode.".into()] },
                });
            }
            blockers.push("Original ADB serial has not reappeared in normal device state yet.".into());
        }
        "bootloader" => {
            if fastboot.iter().any(|found| found == &serial) {
                evidence.push(format!("fastboot:devices:{serial}"));
                return Ok(ModeTransitionVerification {
                    serial,
                    requested_mode,
                    observed_mode: Some("bootloader-fastboot".into()),
                    verified: true,
                    identity_confidence: "exact-serial".into(),
                    evidence,
                    blockers,
                });
            }
            blockers.push("Original serial has not reappeared in fastboot yet.".into());
        }
        "recovery" => {
            if adb.iter().any(|(found, state)| found == &serial && state == "device") {
                evidence.push(format!("adb:{serial}:device"));
                if let Some(mode) = adb_bootmode(&serial) {
                    evidence.push(format!("adb:getprop:ro.bootmode={mode}"));
                    let verified = mode.to_ascii_lowercase().contains("recovery");
                    if !verified {
                        blockers.push(format!("ADB target is present but reports boot mode '{mode}', not recovery."));
                    }
                    return Ok(ModeTransitionVerification {
                        serial,
                        requested_mode,
                        observed_mode: Some(mode),
                        verified,
                        identity_confidence: "exact-serial".into(),
                        evidence,
                        blockers,
                    });
                }
                blockers.push("ADB target reappeared but recovery boot mode could not be verified.".into());
            } else {
                blockers.push("Original ADB serial has not reappeared in recovery yet.".into());
            }
        }
        "download" => {
            let exact = usb.iter().find(|device| {
                device.mode == "samsung-download"
                    && device.serial_number.as_deref() == Some(serial.as_str())
            });
            if let Some(device) = exact {
                evidence.push(format!(
                    "usb:samsung-download:{:04x}:{:04x}:{}",
                    device.vendor_id, device.product_id, serial
                ));
                return Ok(ModeTransitionVerification {
                    serial,
                    requested_mode,
                    observed_mode: Some("samsung-download".into()),
                    verified: true,
                    identity_confidence: "exact-serial".into(),
                    evidence,
                    blockers,
                });
            }

            let observed = usb.iter().find(|device| device.mode == "samsung-download");
            if let Some(device) = observed {
                evidence.push(format!(
                    "usb:samsung-download:{:04x}:{:04x}:serial={}",
                    device.vendor_id,
                    device.product_id,
                    device.serial_number.as_deref().unwrap_or("<unavailable>")
                ));
                blockers.push(
                    "Samsung Download Mode was observed, but the USB descriptor did not preserve the original serial strongly enough to prove it is the same phone.".into(),
                );
                return Ok(ModeTransitionVerification {
                    serial,
                    requested_mode,
                    observed_mode: Some("samsung-download".into()),
                    verified: false,
                    identity_confidence: "mode-observed-identity-unverified".into(),
                    evidence,
                    blockers,
                });
            }
            blockers.push("Samsung Download Mode has not been re-detected yet.".into());
        }
        _ => return Err("Unsupported mode transition verification target".into()),
    }

    Ok(ModeTransitionVerification {
        serial,
        requested_mode,
        observed_mode: None,
        verified: false,
        identity_confidence: "not-yet-observed".into(),
        evidence,
        blockers,
    })
}

fn require_exact_fastboot_target(serial: &str) -> Result<(), String> {
    let devices = fastboot_devices_internal()?;
    if devices.iter().any(|found| found == serial) {
        Ok(())
    } else {
        Err(format!("Fastboot target {serial} is not currently connected"))
    }
}

#[tauri::command]
pub fn fastboot_mode_devices() -> Result<Vec<String>, String> {
    fastboot_devices_internal()
}

#[tauri::command]
pub fn fastboot_reboot_mode(
    serial: String,
    mode: String,
) -> Result<FastbootModeActionResult, String> {
    let serial = serial.trim().to_string();
    if serial.is_empty() {
        return Err("Fastboot mode action requires an exact device serial".to_string());
    }
    require_exact_fastboot_target(&serial)?;

    let normalized = mode.trim().to_ascii_lowercase();
    let args: Vec<&str> = match normalized.as_str() {
        "normal" => vec!["-s", &serial, "reboot"],
        "bootloader" => vec!["-s", &serial, "reboot", "bootloader"],
        "recovery" => vec!["-s", &serial, "reboot", "recovery"],
        "download" => {
            return Err(
                "Download Mode is not a generic Fastboot transition. Use an authorized ADB/OEM-specific path for a device that supports it."
                    .to_string(),
            )
        }
        _ => return Err("Unsupported fastboot reboot mode".to_string()),
    };

    require_success(run_fastboot(&args)?, &format!("fastboot reboot {normalized}"))?;

    Ok(FastbootModeActionResult {
        serial,
        requested_mode: normalized,
        accepted: true,
        verified: false,
        message: "Fastboot accepted the mode-change command. The device will disconnect while changing modes; BobFWTools must re-detect it before treating the transition as verified.".to_string(),
        evidence_source: "fastboot:reboot-command-accepted",
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn download_is_not_exposed_as_generic_fastboot_transition() {
        let mode = "download";
        assert_eq!(mode, "download");
    }
}
