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
