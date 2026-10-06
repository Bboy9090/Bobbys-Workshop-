use serde::Serialize;
use std::collections::BTreeSet;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowCapability {
    pub id: &'static str,
    pub transport: &'static str,
    pub enabled: bool,
    pub reason: String,
    pub evidence: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCapabilityMatrix {
    pub usb_devices_seen: usize,
    pub adb_devices_seen: usize,
    pub mtp_connected: bool,
    pub workflows: Vec<WorkflowCapability>,
}

#[tauri::command]
pub async fn workflow_capabilities() -> Result<DeviceCapabilityMatrix, String> {
    let usb = bootforgeusb::scan().map_err(|e| format!("USB scan failed: {e}"))?;
    let adb = crate::adb_workflows::adb_scan().unwrap_or_default();

    let mtp_status = crate::mtp_backend::mtp_status().await.ok();
    let mtp_connected = mtp_status.as_ref().map(|s| s.connected).unwrap_or(false);

    let authorized_adb: Vec<_> = adb.iter().filter(|d| d.authorized).collect();
    let fastboot_present = std::process::Command::new("fastboot")
        .arg("devices")
        .output()
        .ok()
        .map(|out| {
            out.status.success() && !String::from_utf8_lossy(&out.stdout).trim().is_empty()
        })
        .unwrap_or(false);

    let mut usb_evidence = BTreeSet::new();
    for d in &usb {
        usb_evidence.insert(format!(
            "{:04X}:{:04X} {} {}",
            d.vendor_id, d.product_id, d.platform_hint, d.mode
        ));
    }

    let mtp_reason = if mtp_connected {
        "Real MTP session established".to_string()
    } else {
        "No usable MTP session is currently open".to_string()
    };
    let adb_reason = if authorized_adb.is_empty() {
        "No authorized ADB device is connected".to_string()
    } else {
        format!("{} authorized ADB device(s) connected", authorized_adb.len())
    };
    let fastboot_reason = if fastboot_present {
        "At least one fastboot device is present".to_string()
    } else {
        "No fastboot device is currently present".to_string()
    };

    Ok(DeviceCapabilityMatrix {
        usb_devices_seen: usb.len(),
        adb_devices_seen: adb.len(),
        mtp_connected,
        workflows: vec![
            WorkflowCapability {
                id: "mtp-browse",
                transport: "mtp",
                enabled: mtp_connected,
                reason: mtp_reason.clone(),
                evidence: mtp_status
                    .as_ref()
                    .map(|s| vec![s.evidence_source.to_string()])
                    .unwrap_or_default(),
            },
            WorkflowCapability {
                id: "mtp-upload",
                transport: "mtp",
                enabled: mtp_connected,
                reason: mtp_reason.clone(),
                evidence: mtp_status
                    .as_ref()
                    .map(|s| vec![s.evidence_source.to_string()])
                    .unwrap_or_default(),
            },
            WorkflowCapability {
                id: "mtp-download",
                transport: "mtp",
                enabled: mtp_connected,
                reason: mtp_reason,
                evidence: mtp_status
                    .as_ref()
                    .map(|s| vec![s.evidence_source.to_string()])
                    .unwrap_or_default(),
            },
            WorkflowCapability {
                id: "adb-device-info",
                transport: "adb",
                enabled: !authorized_adb.is_empty(),
                reason: adb_reason.clone(),
                evidence: authorized_adb
                    .iter()
                    .map(|d| format!("{}:{}", d.serial, d.evidence_source))
                    .collect(),
            },
            WorkflowCapability {
                id: "adb-logcat",
                transport: "adb",
                enabled: !authorized_adb.is_empty(),
                reason: adb_reason.clone(),
                evidence: authorized_adb
                    .iter()
                    .map(|d| format!("{}:{}", d.serial, d.evidence_source))
                    .collect(),
            },
            WorkflowCapability {
                id: "adb-screenshot",
                transport: "adb",
                enabled: !authorized_adb.is_empty(),
                reason: adb_reason,
                evidence: authorized_adb
                    .iter()
                    .map(|d| format!("{}:{}", d.serial, d.evidence_source))
                    .collect(),
            },
            WorkflowCapability {
                id: "adb-battery-info",
                transport: "adb",
                enabled: !authorized_adb.is_empty(),
                reason: adb_reason.clone(),
                evidence: authorized_adb.iter().map(|d| format!("{}:{}", d.serial, d.evidence_source)).collect(),
            },
            WorkflowCapability {
                id: "adb-reboot",
                transport: "adb",
                enabled: !authorized_adb.is_empty(),
                reason: adb_reason.clone(),
                evidence: authorized_adb.iter().map(|d| format!("{}:{}", d.serial, d.evidence_source)).collect(),
            },
            WorkflowCapability {
                id: "adb-network-settings",
                transport: "adb",
                enabled: !authorized_adb.is_empty(),
                reason: adb_reason.clone(),
                evidence: authorized_adb.iter().map(|d| format!("{}:{}", d.serial, d.evidence_source)).collect(),
            },
            WorkflowCapability {
                id: "adb-factory-reset-settings",
                transport: "adb",
                enabled: !authorized_adb.is_empty(),
                reason: adb_reason.clone(),
                evidence: authorized_adb.iter().map(|d| format!("{}:{}", d.serial, d.evidence_source)).collect(),
            },
            WorkflowCapability {
                id: "adb-install-apk",
                transport: "adb",
                enabled: !authorized_adb.is_empty(),
                reason: adb_reason.clone(),
                evidence: authorized_adb.iter().map(|d| format!("{}:{}", d.serial, d.evidence_source)).collect(),
            },
            WorkflowCapability {
                id: "fastboot-present",
                transport: "fastboot",
                enabled: fastboot_present,
                reason: fastboot_reason,
                evidence: if fastboot_present {
                    vec!["fastboot:devices".to_string()]
                } else {
                    Vec::new()
                },
            },
            WorkflowCapability {
                id: "usb-observation",
                transport: "usb",
                enabled: !usb.is_empty(),
                reason: if usb.is_empty() {
                    "No physical USB devices observed".to_string()
                } else {
                    format!("{} physical USB device(s) observed", usb.len())
                },
                evidence: usb_evidence.into_iter().collect(),
            },
        ],
    })
}
