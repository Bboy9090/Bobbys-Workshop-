use serde::Serialize;
use std::collections::BTreeMap;
use std::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticEvidence {
    pub source: String,
    pub detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticFinding {
    pub id: String,
    pub severity: &'static str,
    pub title: String,
    pub detail: String,
    pub recommendation: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticDeviceSummary {
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub serial: Option<String>,
    pub android_version: Option<String>,
    pub sdk: Option<String>,
    pub security_patch: Option<String>,
    pub bootloader: Option<String>,
    pub verified_boot_state: Option<String>,
    pub battery_summary: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhoneDiagnosticReport {
    pub usb_devices_seen: usize,
    pub adb_devices_seen: usize,
    pub authorized_adb_devices: usize,
    pub mtp_connected: bool,
    pub fastboot_present: bool,
    pub selected_adb_serial: Option<String>,
    pub device: DiagnosticDeviceSummary,
    pub available_workflows: Vec<String>,
    pub blocked_workflows: Vec<String>,
    pub findings: Vec<DiagnosticFinding>,
    pub evidence: Vec<DiagnosticEvidence>,
}

fn fastboot_devices() -> Vec<String> {
    Command::new("fastboot")
        .arg("devices")
        .output()
        .ok()
        .filter(|out| out.status.success())
        .map(|out| {
            String::from_utf8_lossy(&out.stdout)
                .lines()
                .filter_map(|line| line.split_whitespace().next())
                .filter(|serial| !serial.is_empty())
                .map(|serial| serial.to_string())
                .collect()
        })
        .unwrap_or_default()
}

fn summarize_battery(text: &str) -> Option<String> {
    let mut values = BTreeMap::new();
    for line in text.lines() {
        if let Some((k, v)) = line.trim().split_once(':') {
            values.insert(k.trim().to_ascii_lowercase(), v.trim().to_string());
        }
    }

    let level = values.get("level").cloned();
    let status = values.get("status").cloned();
    let temp = values
        .get("temperature")
        .and_then(|raw| raw.parse::<i64>().ok())
        .map(|v| format!("{:.1}°C", v as f64 / 10.0));

    if level.is_none() && status.is_none() && temp.is_none() {
        return None;
    }

    let mut parts = Vec::new();
    if let Some(v) = level {
        parts.push(format!("{v}%"));
    }
    if let Some(v) = temp {
        parts.push(v);
    }
    if let Some(v) = status {
        parts.push(format!("status {v}"));
    }
    Some(parts.join(" · "))
}

#[tauri::command]
pub async fn diagnose_phone() -> Result<PhoneDiagnosticReport, String> {
    let usb = bootforgeusb::scan().map_err(|e| format!("USB scan failed: {e}"))?;
    let adb = crate::adb_workflows::adb_scan().unwrap_or_default();
    let mtp = crate::mtp_backend::mtp_status().await.ok();
    let fastboot = fastboot_devices();

    let authorized: Vec<_> = adb.iter().filter(|d| d.authorized).collect();
    let selected = authorized.first().map(|d| d.serial.clone());

    let mut evidence = Vec::new();
    for d in &usb {
        evidence.push(DiagnosticEvidence {
            source: "usb".to_string(),
            detail: format!(
                "{:04X}:{:04X} {} {} via {}",
                d.vendor_id, d.product_id, d.platform_hint, d.mode, d.evidence_source
            ),
        });
    }

    for d in &adb {
        evidence.push(DiagnosticEvidence {
            source: "adb".to_string(),
            detail: format!("{} state={} via {}", d.serial, d.state, d.evidence_source),
        });
    }

    if let Some(mtp_status) = &mtp {
        evidence.push(DiagnosticEvidence {
            source: "mtp".to_string(),
            detail: format!(
                "{} {} serial={} via {}",
                mtp_status.manufacturer,
                mtp_status.model,
                mtp_status.serial_number,
                mtp_status.evidence_source
            ),
        });
    }

    for serial in &fastboot {
        evidence.push(DiagnosticEvidence {
            source: "fastboot".to_string(),
            detail: format!("{serial} via fastboot:devices"),
        });
    }

    let mut manufacturer = mtp.as_ref().map(|m| m.manufacturer.clone()).filter(|v| !v.is_empty());
    let mut model = mtp.as_ref().map(|m| m.model.clone()).filter(|v| !v.is_empty());
    let mut serial = selected.clone().or_else(|| {
        mtp.as_ref()
            .map(|m| m.serial_number.clone())
            .filter(|v| !v.is_empty())
    });
    let mut android_version = None;
    let mut sdk = None;
    let mut security_patch = None;
    let mut bootloader = None;
    let mut verified_boot_state = None;
    let mut battery_summary = None;

    if let Some(selected_serial) = &selected {
        if let Ok(info) = crate::adb_workflows::adb_device_info(selected_serial.clone()) {
            let p = info.properties;
            manufacturer = p.get("ro.product.manufacturer").cloned().or(manufacturer);
            model = p.get("ro.product.model").cloned().or(model);
            serial = Some(selected_serial.clone());
            android_version = p.get("ro.build.version.release").cloned();
            sdk = p.get("ro.build.version.sdk").cloned();
            security_patch = p.get("ro.build.version.security_patch").cloned();
            bootloader = p.get("ro.bootloader").cloned();
            verified_boot_state = p.get("ro.boot.verifiedbootstate").cloned();
            evidence.push(DiagnosticEvidence {
                source: "adb".to_string(),
                detail: format!("{selected_serial} verified properties via {}", info.evidence_source),
            });
        }

        if let Ok(battery) = crate::adb_workflows::adb_battery_info(selected_serial.clone()) {
            battery_summary = summarize_battery(&battery.output);
            evidence.push(DiagnosticEvidence {
                source: "adb".to_string(),
                detail: format!("{selected_serial} battery via {}", battery.evidence_source),
            });
        }
    }

    let mut findings = Vec::new();

    if usb.is_empty() && adb.is_empty() && mtp.is_none() && fastboot.is_empty() {
        findings.push(DiagnosticFinding {
            id: "no-device".to_string(),
            severity: "error",
            title: "No phone detected".to_string(),
            detail: "BobFWTools could not see an Android device over USB, MTP, ADB, or Fastboot.".to_string(),
            recommendation: Some("Connect the phone directly with a known data-capable USB cable and unlock the screen.".to_string()),
        });
    }

    if !usb.is_empty() && mtp.is_none() && adb.is_empty() && fastboot.is_empty() {
        findings.push(DiagnosticFinding {
            id: "usb-only".to_string(),
            severity: "warning",
            title: "USB present, no Android transport available".to_string(),
            detail: "The Mac sees USB hardware, but BobFWTools cannot establish MTP, ADB, or Fastboot.".to_string(),
            recommendation: Some("On Android, choose File Transfer for MTP or authorize USB debugging for ADB.".to_string()),
        });
    }

    if adb.iter().any(|d| d.state == "unauthorized") {
        findings.push(DiagnosticFinding {
            id: "adb-unauthorized".to_string(),
            severity: "warning",
            title: "ADB authorization required".to_string(),
            detail: "The device is visible to ADB but has not authorized this Mac.".to_string(),
            recommendation: Some("Unlock the phone and approve the USB debugging authorization prompt.".to_string()),
        });
    }

    if adb.iter().any(|d| d.state == "offline") {
        findings.push(DiagnosticFinding {
            id: "adb-offline".to_string(),
            severity: "warning",
            title: "ADB device offline".to_string(),
            detail: "ADB can see the device record, but the transport is not currently usable.".to_string(),
            recommendation: Some("Reconnect USB, unlock the phone, and re-authorize debugging if prompted.".to_string()),
        });
    }

    if mtp.is_some() {
        findings.push(DiagnosticFinding {
            id: "mtp-ready".to_string(),
            severity: "ok",
            title: "MTP file transfer ready".to_string(),
            detail: "BobFWTools established a real MTP session and can use file-transfer workflows.".to_string(),
            recommendation: None,
        });
    }

    if !authorized.is_empty() {
        findings.push(DiagnosticFinding {
            id: "adb-ready".to_string(),
            severity: "ok",
            title: "ADB workflows ready".to_string(),
            detail: format!("{} authorized ADB device(s) are available.", authorized.len()),
            recommendation: None,
        });
    }

    if !fastboot.is_empty() {
        findings.push(DiagnosticFinding {
            id: "fastboot-ready".to_string(),
            severity: "ok",
            title: "Fastboot mode detected".to_string(),
            detail: "At least one device is available through Fastboot.".to_string(),
            recommendation: None,
        });
    }

    let matrix = crate::workflow_capabilities::workflow_capabilities().await?;
    let available_workflows = matrix
        .workflows
        .iter()
        .filter(|w| w.enabled)
        .map(|w| w.id.to_string())
        .collect();
    let blocked_workflows = matrix
        .workflows
        .iter()
        .filter(|w| !w.enabled)
        .map(|w| format!("{}: {}", w.id, w.reason))
        .collect();

    Ok(PhoneDiagnosticReport {
        usb_devices_seen: usb.len(),
        adb_devices_seen: adb.len(),
        authorized_adb_devices: authorized.len(),
        mtp_connected: mtp.is_some(),
        fastboot_present: !fastboot.is_empty(),
        selected_adb_serial: selected,
        device: DiagnosticDeviceSummary {
            manufacturer,
            model,
            serial,
            android_version,
            sdk,
            security_patch,
            bootloader,
            verified_boot_state,
            battery_summary,
        },
        available_workflows,
        blocked_workflows,
        findings,
        evidence,
    })
}
