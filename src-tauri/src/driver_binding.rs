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
pub struct DriverInfInspection {
    pub instance_id: String,
    pub inf_path: String,
    pub device_hardware_ids: Vec<String>,
    pub inf_hardware_ids: Vec<String>,
    pub matched_hardware_ids: Vec<String>,
    pub compatible: bool,
    pub expected_family: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverRelatchResult {
    pub instance_id: String,
    pub inf_path: String,
    pub staged: bool,
    pub released: bool,
    pub rescanned: bool,
    pub verified_claim: bool,
    pub observed_service: Option<String>,
    pub observed_inf: Option<String>,
    pub detail: String,
    pub evidence: Vec<String>,
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

fn normalize_hardware_id(value: &str) -> String {
    value.trim().trim_matches('"').to_ascii_uppercase()
}

fn extract_inf_hardware_ids(text: &str) -> Vec<String> {
    let mut ids = Vec::new();

    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with(';') {
            continue;
        }

        let upper = line.to_ascii_uppercase();
        let mut search_from = 0usize;

        while let Some(relative) = upper[search_from..].find("USB\\") {
            let start = search_from + relative;
            let remainder = &line[start..];
            let end = remainder
                .find(|ch: char| {
                    ch == ',' || ch == ';' || ch.is_whitespace() || ch == '"' || ch == ']'
                })
                .unwrap_or(remainder.len());

            let candidate = remainder[..end].trim();
            let normalized = normalize_hardware_id(candidate);
            if normalized.starts_with("USB\\VID_") || normalized.starts_with("USB\\CLASS_") {
                ids.push(normalized);
            }

            search_from = start + end.max(4);
            if search_from >= line.len() {
                break;
            }
        }
    }

    ids.sort();
    ids.dedup();
    ids
}

fn hardware_id_matches(device_id: &str, inf_id: &str) -> bool {
    let device = normalize_hardware_id(device_id);
    let inf = normalize_hardware_id(inf_id);
    device == inf || device.starts_with(&(inf.clone() + "&"))
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
    FriendlyName=$(if ($_.FriendlyName) { $_.FriendlyName } elseif ($_.Name) { $_.Name } else { '' })
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
pub fn driver_binding_inspect_inf(instance_id: String, inf_path: String) -> Result<DriverInfInspection, String> {
    let instance_id = instance_id.trim().to_string();
    let inf_path = inf_path.trim().to_string();
    if instance_id.is_empty() || !instance_id.to_ascii_uppercase().starts_with("USB") {
        return Err("INF inspection requires an exact present USB device instance ID.".to_string());
    }
    let path = std::path::PathBuf::from(&inf_path);
    if !path.is_file() || path.extension().and_then(|v| v.to_str()).map(|v| !v.eq_ignore_ascii_case("inf")).unwrap_or(true) {
        return Err("Select a readable Windows .inf driver package file.".to_string());
    }

    let current = driver_binding_scan()?;
    let record = current
        .iter()
        .find(|item| item.instance_id.eq_ignore_ascii_case(&instance_id))
        .ok_or_else(|| "Exact Windows USB instance is no longer present; refresh before inspecting a driver.".to_string())?;

    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read selected INF {}: {e}", path.display()))?;
    let inf_hardware_ids = extract_inf_hardware_ids(&text);
    if inf_hardware_ids.is_empty() {
        return Err("Selected INF does not expose USB hardware IDs that BobFWTools can verify.".to_string());
    }

    let mut matched = Vec::new();
    for device_id in &record.hardware_ids {
        for inf_id in &inf_hardware_ids {
            if hardware_id_matches(device_id, inf_id) {
                matched.push(format!("{} <= {}", normalize_hardware_id(device_id), normalize_hardware_id(inf_id)));
            }
        }
    }
    matched.sort();
    matched.dedup();
    let compatible = !matched.is_empty();
    let _ = crate::audit::record(
        "driver-binding",
        "inspect-inf",
        "read-only",
        if compatible { "compatible" } else { "blocked" },
        Some(instance_id.clone()),
        if compatible {
            "Selected INF advertised a hardware ID compatible with the exact present USB device."
        } else {
            "Selected INF did not advertise a hardware ID compatible with the exact present USB device."
        },
        matched.clone(),
    );

    Ok(DriverInfInspection {
        instance_id,
        inf_path: path.display().to_string(),
        device_hardware_ids: record.hardware_ids.clone(),
        inf_hardware_ids,
        matched_hardware_ids: matched.clone(),
        compatible,
        expected_family: record.expected_family.clone(),
        detail: if compatible {
            format!(
                "The selected INF advertises at least one hardware ID compatible with this exact present device. {} verified match(es).",
                matched.len()
            )
        } else {
            "The selected INF does not advertise a compatible hardware ID for this exact device. Relatch is blocked.".to_string()
        },
    })
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn driver_binding_inspect_inf(_instance_id: String, _inf_path: String) -> Result<DriverInfInspection, String> {
    Err("INF inspection is Windows-only.".to_string())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn driver_binding_stage_and_relatch(
    instance_id: String,
    inf_path: String,
) -> Result<DriverRelatchResult, String> {
    let inspection = driver_binding_inspect_inf(instance_id.clone(), inf_path.clone())?;
    if !inspection.compatible {
        return Err("Driver relatch blocked: selected INF hardware IDs do not match the exact device.".to_string());
    }

    let before = driver_binding_scan()?;
    let original = before
        .iter()
        .find(|item| item.instance_id.eq_ignore_ascii_case(&instance_id))
        .cloned()
        .ok_or_else(|| "Exact Windows USB instance disappeared before relatch.".to_string())?;

    let _ = crate::audit::record(
        "driver-binding",
        "stage-relatch",
        "elevated",
        "started",
        Some(instance_id.clone()),
        "Beginning hardware-ID-verified driver staging and exact-device relatch.",
        inspection.matched_hardware_ids.clone(),
    );

    let staged = pnputil(&["/add-driver", &inspection.inf_path], "pnputil /add-driver")?;
    let remove = pnputil(&["/remove-device", &original.instance_id], "pnputil /remove-device")?;
    let scan = pnputil(&["/scan-devices"], "pnputil /scan-devices")?;

    std::thread::sleep(std::time::Duration::from_millis(1200));
    let after = driver_binding_scan().unwrap_or_default();
    let rebound = after.iter().find(|candidate| {
        candidate.hardware_ids.iter().any(|candidate_id| {
            original.hardware_ids.iter().any(|original_id| {
                let a = normalize_hardware_id(candidate_id);
                let b = normalize_hardware_id(original_id);
                a == b
            })
        })
    });

    let verified_claim = rebound
        .map(|record| record.binding_state == "matched")
        .unwrap_or(false);

    let observed_service = rebound.and_then(|record| record.service.clone());
    let observed_inf = rebound.and_then(|record| record.driver_inf.clone());
    let mut evidence = vec![staged, remove, scan];
    evidence.push(format!("verified-claim:{verified_claim}"));
    evidence.push(format!("observed-service:{}", observed_service.as_deref().unwrap_or("<unavailable>")));
    evidence.push(format!("observed-inf:{}", observed_inf.as_deref().unwrap_or("<unavailable>")));

    if let Err(error) = crate::audit::record(
        "driver-binding",
        "stage-relatch",
        "elevated",
        if verified_claim { "verified" } else { "completed-unverified" },
        Some(instance_id.clone()),
        if verified_claim {
            "Compatible INF staged and exact device re-enumerated with a verified compatible driver-family claim."
        } else {
            "Compatible INF staged and exact device re-enumerated, but the resulting driver-family claim is not yet verified."
        },
        evidence.clone(),
    ) {
        evidence.push(format!("audit-write-failed:{error}"));
    }

    Ok(DriverRelatchResult {
        instance_id,
        inf_path: inspection.inf_path,
        staged: true,
        released: true,
        rescanned: true,
        verified_claim,
        observed_service,
        observed_inf,
        detail: if verified_claim {
            "Compatible INF was staged, the exact device node was released, Windows re-enumerated it, and BobFWTools observed a compatible driver-family claim afterward.".to_string()
        } else {
            "Compatible INF was staged and the exact device node was re-enumerated, but BobFWTools has not yet verified that the expected driver family claimed it. Refresh driver claims before continuing.".to_string()
        },
        evidence,
    })
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn driver_binding_stage_and_relatch(
    _instance_id: String,
    _inf_path: String,
) -> Result<DriverRelatchResult, String> {
    Err("Driver staging and relatch is Windows-only.".to_string())
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

    let _ = crate::audit::record(
        "driver-binding",
        "release-rescan",
        "elevated",
        "started",
        Some(instance_id.clone()),
        "Releasing the exact Windows USB device node without deleting its driver package.",
        vec![
            format!("expected-family:{}", record.expected_family),
            format!("current-inf:{}", record.driver_inf.as_deref().unwrap_or("<unavailable>")),
            format!("current-service:{}", record.service.as_deref().unwrap_or("<unavailable>")),
        ],
    );
    let remove = pnputil(&["/remove-device", &record.instance_id], "pnputil /remove-device")?;
    let scan = pnputil(&["/scan-devices"], "pnputil /scan-devices")?;
    let mut evidence = vec![remove, scan];
    if let Err(error) = crate::audit::record(
        "driver-binding",
        "release-rescan",
        "elevated",
        "completed",
        Some(instance_id.clone()),
        "Exact Windows USB device node released and Plug and Play rescan requested.",
        evidence.clone(),
    ) {
        evidence.push(format!("audit-write-failed:{error}"));
    }

    Ok(DriverReleaseResult {
        instance_id,
        released: true,
        rescanned: true,
        detail: "The exact Windows USB device node was released and Plug and Play was rescanned. No driver package was deleted. Windows will select the best matching installed driver on re-enumeration.".to_string(),
        evidence,
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

    #[test]
    fn inf_matching_accepts_more_specific_device_id() {
        assert!(hardware_id_matches(
            "USB\\VID_0E8D&PID_2000&REV_0100",
            "USB\\VID_0E8D&PID_2000"
        ));
        assert!(!hardware_id_matches(
            "USB\\VID_05C6&PID_9008",
            "USB\\VID_0E8D&PID_2000"
        ));
    }

    #[test]
    fn inf_parser_extracts_usb_ids() {
        let sample = r#"Device=Install,USB\\VID_05C6&PID_9008
; ignored
Other=Install,USB\\VID_0E8D&PID_2000"#;
        let ids = extract_inf_hardware_ids(sample);
        assert!(ids.contains(&"USB\\VID_05C6&PID_9008".to_string()));
        assert!(ids.contains(&"USB\\VID_0E8D&PID_2000".to_string()));
    }
}
