use serde::Serialize;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const PROBE_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SamsungDownloadProbeReport {
    pub device_uid: String,
    pub tool_available: bool,
    pub samsung_usb_present: bool,
    pub protocol_qualified: bool,
    pub pit_read: bool,
    pub timed_out: bool,
    pub detail: String,
    pub evidence: Vec<String>,
}

fn probe_args() -> [&'static str; 2] {
    ["print-pit", "--no-reboot"]
}

fn read_pipe<R: Read>(mut pipe: Option<R>) -> Vec<u8> {
    let mut bytes = Vec::new();
    if let Some(ref mut reader) = pipe {
        let _ = reader.read_to_end(&mut bytes);
    }
    bytes
}

fn run_bounded_probe(program: &Path) -> Result<(bool, bool, Vec<u8>, Vec<u8>), String> {
    let mut child = Command::new(program)
        .args(probe_args())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not start Heimdall read-only probe: {e}"))?;

    let started = Instant::now();
    let (success, timed_out) = loop {
        match child.try_wait() {
            Ok(Some(status)) => break (status.success(), false),
            Ok(None) if started.elapsed() < PROBE_TIMEOUT => {
                thread::sleep(Duration::from_millis(100));
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                break (false, true);
            }
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("Could not monitor Heimdall read-only probe: {e}"));
            }
        }
    };

    let stdout = read_pipe(child.stdout.take());
    let stderr = read_pipe(child.stderr.take());
    Ok((success, timed_out, stdout, stderr))
}

#[tauri::command]
pub fn samsung_download_probe(device_uid: String) -> Result<SamsungDownloadProbeReport, String> {
    let device_uid = device_uid.trim().to_string();
    if device_uid.is_empty() {
        return Err("Samsung Download Mode probe requires an exact selected USB device UID".to_string());
    }

    let devices = bootforgeusb::transport::scan_transports()
        .map_err(|e| format!("USB transport scan failed before Samsung probe: {e}"))?;
    let samsung = devices
        .iter()
        .filter(|device| device.vendor_id == 0x04e8)
        .collect::<Vec<_>>();

    let mut evidence = vec![format!("selected-device-uid:{device_uid}")];

    if samsung.len() != 1 {
        return Ok(SamsungDownloadProbeReport {
            device_uid,
            tool_available: crate::workstation::resolve_command("heimdall", &["version"]).is_some(),
            samsung_usb_present: !samsung.is_empty(),
            protocol_qualified: false,
            pit_read: false,
            timed_out: false,
            detail: if samsung.is_empty() {
                "No Samsung USB target is currently attached.".to_string()
            } else {
                format!(
                    "{} Samsung USB targets are attached; select/expose exactly one before protocol qualification.",
                    samsung.len()
                )
            },
            evidence,
        });
    }

    let target = samsung[0];
    if target.device_uid != device_uid {
        evidence.push(format!("observed-device-uid:{}", target.device_uid));
        return Ok(SamsungDownloadProbeReport {
            device_uid,
            tool_available: crate::workstation::resolve_command("heimdall", &["version"]).is_some(),
            samsung_usb_present: true,
            protocol_qualified: false,
            pit_read: false,
            timed_out: false,
            detail: "The selected Samsung USB identity no longer matches the currently attached target.".to_string(),
            evidence,
        });
    }

    evidence.push(format!(
        "usb:{:04X}:{:04X}:mode={}",
        target.vendor_id, target.product_id, target.mode
    ));
    evidence.push(format!(
        "serial:{}",
        target.serial_number.as_deref().unwrap_or("<unavailable>")
    ));

    let Some(heimdall) = crate::workstation::resolve_command("heimdall", &["version"]) else {
        return Ok(SamsungDownloadProbeReport {
            device_uid,
            tool_available: false,
            samsung_usb_present: true,
            protocol_qualified: false,
            pit_read: false,
            timed_out: false,
            detail: "Samsung USB is present, but managed Heimdall is unavailable for the read-only Odin/PIT handshake.".to_string(),
            evidence,
        });
    };
    evidence.push(format!("heimdall:{}", heimdall.display()));
    evidence.push("command:heimdall print-pit --no-reboot".to_string());

    let (success, timed_out, stdout, stderr) = run_bounded_probe(&heimdall)?;
    let stdout_text = String::from_utf8_lossy(&stdout);
    let stderr_text = String::from_utf8_lossy(&stderr);
    let output_text = format!("{stdout_text}\n{stderr_text}");
    let pit_signal = output_text.contains("PIT Entry Count")
        || output_text.contains("PIT Magic")
        || output_text.contains("Entry Count")
        || success;
    let protocol_qualified = success && pit_signal;

    evidence.push(format!("probe-exit-success:{success}"));
    evidence.push(format!("probe-timed-out:{timed_out}"));
    evidence.push(format!("probe-output-bytes:{}", stdout.len() + stderr.len()));
    evidence.push(format!("pit-signal:{pit_signal}"));

    let detail = if protocol_qualified {
        "Read-only Heimdall PIT exchange completed successfully; Samsung Odin/Download Mode is protocol-qualified for planning evidence only.".to_string()
    } else if timed_out {
        "Samsung USB is attached, but the bounded Odin/PIT handshake timed out. Download Mode is not qualified.".to_string()
    } else {
        "Samsung USB is attached, but the read-only Odin/PIT exchange did not complete successfully. Download Mode is not qualified.".to_string()
    };

    let _ = crate::audit::record(
        "Samsung",
        "download-mode-readonly-probe",
        "read-only",
        if protocol_qualified { "qualified" } else { "blocked" },
        Some(target.device_uid.clone()),
        detail.clone(),
        evidence.clone(),
    );

    Ok(SamsungDownloadProbeReport {
        device_uid: target.device_uid.clone(),
        tool_available: true,
        samsung_usb_present: true,
        protocol_qualified,
        pit_read: protocol_qualified,
        timed_out,
        detail,
        evidence,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_is_read_only_and_no_reboot() {
        let args = probe_args();
        assert_eq!(args, ["print-pit", "--no-reboot"]);
        assert!(!args.iter().any(|arg| arg.contains("flash")));
        assert!(!args.iter().any(|arg| arg.contains("repartition")));
    }

    #[test]
    fn probe_timeout_is_bounded() {
        assert!(PROBE_TIMEOUT <= Duration::from_secs(10));
    }
}
