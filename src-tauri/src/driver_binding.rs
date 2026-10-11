use serde::{Deserialize, Serialize};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverBindingRecord {
    pub instance_id: String,
    pub friendly_name: String,
    pub status: String,
    pub class_name: String,
    pub service: Option<String>,
    pub driver_inf: Option<String>,
    pub hardware_ids: Vec<String>,
    pub vendor_id: Option<u16>,
    pub product_id: Option<u16>,
    pub expected_family: String,
    pub binding_state: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverReleaseResult {
    pub instance_id: String,
    pub released: bool,
    pub rescanned: bool,
    pub detail: String,
    pub evidence: Vec<String>,
}

fn parse_vid_pid(values: &[String]) -> (Option<u16>, Option<u16>) {
    let joined = values.join(" ").to_ascii_uppercase();
    fn extract(joined: &str, marker: &str) -> Option<u16> {
        let pos = joined.find(marker)?;
        let start = pos + marker.len();
        let value = joined.get(start..start + 4)?;
        u16::from_str_radix(value, 16).ok()
    }
    (extract(&joined, "VID_"), extract(&joined, "PID_"))
}

fn expected_family(vendor_id: Option<u16>, product_id: Option<u16>, text: &str) -> &'static str {
    let lower = text.to_ascii_lowercase();
    match (vendor_id, product_id) {
        (Some(0x05c6), Some(0x9008)) => "qualcomm-qdloader-9008",
        (Some(0x0e8d), Some(0x0003 | 0x2000 | 0x2001)) => "mediatek-vcom-preloader",
        (Some(0x04e8), Some(0x6601 | 0x685d)) => "samsung-download",
        (Some(0x18d1), _) => "google-android",
        (Some(0x04e8), _) => "samsung-android",
        (Some(0x05c6), _) if lower.contains("qualcomm") => "qualcomm-usb",
        (Some(0x0e8d), _) => "mediatek-usb",
        _ => "generic-usb",
    }
}

fn binding_assessment(expected: &str, service: Option<&str>, inf: Option<&str>, name: &str) -> (String, String) {
    let evidence = format!(
        "{} {} {}",
        service.unwrap_or_default(),
        inf.unwrap_or_default(),
        name
    )
    .to_ascii_lowercase();

    let matched = match expected {
        "qualcomm-qdloader-9008" | "qualcomm-usb" => {
            ["qcusb", "qcser", "qdloader", "qualcomm"].iter().any(|v| evidence.contains(v))
        }
        "mediatek-vcom-preloader" | "mediatek-usb" => {
            ["mediatek", "mtk", "vcom", "usbser"].iter().any(|v| evidence.contains(v))
        }
        "samsung-download" | "samsung-android" => {
            ["samsung", "ssud", "ssudadb"].iter().any(|v| evidence.contains(v))
        }
        "google-android" => ["winusb", "android", "google"].iter().any(|v| evidence.contains(v)),
        _ => true,
    };

    if matched {
        (
            "matched".to_string(),
            format!("Current Windows claim appears compatible with expected family {expected}."),
        )
    } else {
        (
            "mismatch".to_string(),
            format!(
                "Windows currently claims this device with service/INF evidence that does not match expected family {expected}."
            ),
        )
    }
}

#[cfg(target_os = "windows")]
fn powershell_json(script: &str) -> Result<String, String> {
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script]);
    cmd.creation_flags(0x08000000);
    let output = cmd.output().map_err(|e| format!("Failed to launch PowerShell: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "PowerShell driver query failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(target_os = "windows")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct RawPnpRecord {
    instance_id: String,
    friendly_name: Option<String>,
    status: Option<String>,
    class_name: Option<String>,
    service: Option<String>,
    driver_inf: Option<String>,
    hardware_ids: Option<Vec<String>>,
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn driver_binding_scan() -> Result<Vec<DriverBindingRecord>, String> {
    let script = r#"
$ErrorActionPreference='Stop'
$items = Get-PnpDevice -PresentOnly | Where-Object {
  $_.InstanceId -like 'USB*' -or $_.InstanceId -like 'USBSTOR*'
} | ForEach-Object {
  $id=$_.InstanceId
  $service=(Get-PnpDeviceProperty -InstanceId $id -KeyName 'DEVPKEY_Device_Service' -ErrorAction SilentlyContinue).Data
  $inf=(Get-PnpDeviceProperty -InstanceId $id -KeyName 'DEVPKEY_Device_DriverInfPath' -ErrorAction SilentlyContinue).Data
  $hw=(Get-PnpDeviceProperty -InstanceId $id -KeyName 'DEVPKEY_Device_HardwareIds' -ErrorAction SilentlyContinue).Data
  [pscustomobject]@{
    InstanceId=$id
    FriendlyName=($_.FriendlyName ?? $_.Name ?? '')
    Status=$_.Status
    ClassName=$_.Class
    Service=$service
    DriverInf=$inf
    HardwareIds=@($hw)
  }
}
@($items) | ConvertTo-Json -Depth 5 -Compress
"#;
    let raw = powershell_json(script)?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    let rows: Vec<RawPnpRecord> = serde_json::from_str(trimmed)
        .map_err(|e| format!("Failed to parse Windows PnP driver evidence: {e}"))?;

    Ok(rows
        .into_iter()
        .filter_map(|row| {
            let hardware_ids = row.hardware_ids.unwrap_or_default();
            let (vendor_id, product_id) = parse_vid_pid(&hardware_ids);
            let friendly_name = row.friendly_name.unwrap_or_default();
            let expected = expected_family(vendor_id, product_id, &friendly_name).to_string();
            if expected == "generic-usb" {
                return None;
            }
            let (binding_state, detail) = binding_assessment(
                &expected,
                row.service.as_deref(),
                row.driver_inf.as_deref(),
                &friendly_name,
            );
            Some(DriverBindingRecord {
                instance_id: row.instance_id,
                friendly_name,
                status: row.status.unwrap_or_default(),
                class_name: row.class_name.unwrap_or_default(),
                service: row.service,
                driver_inf: row.driver_inf,
                hardware_ids,
                vendor_id,
                product_id,
                expected_family: expected,
                binding_state,
                detail,
            })
        })
        .collect())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn driver_binding_scan() -> Result<Vec<DriverBindingRecord>, String> {
    Ok(Vec::new())
}

#[cfg(target_os = "windows")]
fn pnputil(args: &[&str], action: &str) -> Result<String, String> {
    let mut cmd = Command::new("pnputil");
    cmd.args(args);
    cmd.creation_flags(0x08000000);
    let output = cmd.output().map_err(|e| format!("Failed to launch pnputil for {action}: {e}"))?;
    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    if !output.status.success() {
        return Err(format!("{action} failed: {}", combined.trim()));
    }
    Ok(combined.trim().to_string())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn driver_binding_release_and_rescan(instance_id: String) -> Result<DriverReleaseResult, String> {
    let instance_id = instance_id.trim().to_string();
    if instance_id.is_empty() || !instance_id.to_ascii_uppercase().starts_with("USB") {
        return Err("Driver release requires an exact present USB device instance ID.".to_string());
    }

    let current = driver_binding_scan()?;
    let record = current
        .iter()
        .find(|item| item.instance_id.eq_ignore_ascii_case(&instance_id))
        .ok_or_else(|| "Exact Windows USB instance is no longer present; refresh before releasing it.".to_string())?;

    let remove = pnputil(&["/remove-device", &record.instance_id], "pnputil /remove-device")?;
    let scan = pnputil(&["/scan-devices"], "pnputil /scan-devices")?;

    Ok(DriverReleaseResult {
        instance_id,
        released: true,
        rescanned: true,
        detail: "The exact Windows USB device node was released and Plug and Play was rescanned. No driver package was deleted. Windows will select the best matching installed driver on re-enumeration.".to_string(),
        evidence: vec![remove, scan],
    })
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn driver_binding_release_and_rescan(_instance_id: String) -> Result<DriverReleaseResult, String> {
    Err("Driver binding release is Windows-only; macOS/Linux use native USB/libusb access rather than Windows PnP driver claims.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_common_service_families() {
        assert_eq!(expected_family(Some(0x05c6), Some(0x9008), ""), "qualcomm-qdloader-9008");
        assert_eq!(expected_family(Some(0x0e8d), Some(0x2000), ""), "mediatek-vcom-preloader");
        assert_eq!(expected_family(Some(0x04e8), Some(0x685d), ""), "samsung-download");
    }

    #[test]
    fn parses_usb_hardware_ids() {
        let ids = vec!["USB\\VID_05C6&PID_9008".to_string()];
        assert_eq!(parse_vid_pid(&ids), (Some(0x05c6), Some(0x9008)));
    }
}
