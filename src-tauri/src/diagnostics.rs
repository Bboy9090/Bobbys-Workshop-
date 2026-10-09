use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
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
pub struct UsbConnectionSummary {
    pub vendor_id: u16,
    pub product_id: u16,
    pub manufacturer: Option<String>,
    pub product_name: Option<String>,
    pub serial_number: Option<String>,
    pub platform_hint: String,
    pub mode: String,
    pub bus_number: u8,
    pub device_address: u8,
    pub speed: String,
    pub evidence_source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CableDoctorReport {
    pub grade: &'static str,
    pub summary: String,
    pub samples: usize,
    pub android_present_samples: usize,
    pub reconnect_events: usize,
    pub observed_speeds: Vec<String>,
    pub observed_modes: Vec<String>,
    pub adb_state: String,
    pub mtp_connected: bool,
    pub fastboot_present: bool,
    pub recommendations: Vec<String>,
    pub evidence: Vec<DiagnosticEvidence>,
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
    pub android_usb_devices_seen: usize,
    pub usb_connections: Vec<UsbConnectionSummary>,
    pub connection_grade: &'static str,
    pub connection_summary: String,
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
    let android_usb: Vec<_> = usb
        .iter()
        .filter(|d| d.platform_hint.starts_with("android-"))
        .collect();
    let usb_connections = android_usb
        .iter()
        .map(|d| UsbConnectionSummary {
            vendor_id: d.vendor_id,
            product_id: d.product_id,
            manufacturer: d.manufacturer.clone(),
            product_name: d.product_name.clone(),
            serial_number: d.serial_number.clone(),
            platform_hint: d.platform_hint.clone(),
            mode: d.mode.clone(),
            bus_number: d.bus_number,
            device_address: d.device_address,
            speed: d.speed.clone(),
            evidence_source: d.evidence_source.clone(),
        })
        .collect::<Vec<_>>();

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

    if android_usb.is_empty() && adb.is_empty() && mtp.is_none() && fastboot.is_empty() {
        findings.push(DiagnosticFinding {
            id: "no-device".to_string(),
            severity: "error",
            title: "No phone detected".to_string(),
            detail: "BobFWTools could not see an Android device over USB, MTP, ADB, or Fastboot.".to_string(),
            recommendation: Some("Connect the phone directly with a known data-capable USB cable and unlock the screen.".to_string()),
        });
    }

    if !android_usb.is_empty() && mtp.is_none() && adb.is_empty() && fastboot.is_empty() {
        findings.push(DiagnosticFinding {
            id: "usb-only".to_string(),
            severity: "warning",
            title: "USB present, no Android transport available".to_string(),
            detail: "The Mac sees USB hardware, but BobFWTools cannot establish MTP, ADB, or Fastboot.".to_string(),
            recommendation: Some("On Android, choose File Transfer for MTP or authorize USB debugging for ADB.".to_string()),
        });
    }

    if android_usb.len() > 1 {
        findings.push(DiagnosticFinding {
            id: "multiple-android-usb".to_string(),
            severity: "warning",
            title: "Multiple Android USB devices detected".to_string(),
            detail: format!("{} Android-class USB devices are visible. Workflow selection may be ambiguous.", android_usb.len()),
            recommendation: Some("For destructive or recovery work, connect only the phone you intend to service.".to_string()),
        });
    }

    if mtp.is_some() && authorized.is_empty() && fastboot.is_empty() {
        findings.push(DiagnosticFinding {
            id: "mtp-only".to_string(),
            severity: "ok",
            title: "File transfer works; ADB is not authorized".to_string(),
            detail: "MTP is healthy, so the USB data path is working. Developer-mode workflows are unavailable until ADB is enabled and authorized.".to_string(),
            recommendation: Some("No change is needed for file transfer. Enable USB debugging only if you need ADB workflows.".to_string()),
        });
    }

    if !authorized.is_empty() && mtp.is_none() {
        findings.push(DiagnosticFinding {
            id: "adb-only".to_string(),
            severity: "warning",
            title: "ADB works but MTP is unavailable".to_string(),
            detail: "The USB data path and debugging authorization are working, but Android is not exposing a usable MTP session.".to_string(),
            recommendation: Some("Unlock the phone and change USB preferences to File Transfer if you need file browsing.".to_string()),
        });
    }

    if android_usb.iter().any(|d| d.mode == "samsung-download") {
        findings.push(DiagnosticFinding {
            id: "samsung-download-mode".to_string(),
            severity: "ok",
            title: "Samsung Download Mode detected".to_string(),
            detail: "The USB descriptor matches BobFWTools' Samsung Download Mode evidence rule.".to_string(),
            recommendation: Some("Use only Samsung recovery/firmware workflows qualified for this exact model and firmware package.".to_string()),
        });
    }

    if android_usb.iter().any(|d| d.mode == "mediatek-preloader") {
        findings.push(DiagnosticFinding {
            id: "mediatek-preloader".to_string(),
            severity: "ok",
            title: "MediaTek preloader mode detected".to_string(),
            detail: "The USB descriptor matches BobFWTools' MediaTek preloader evidence rule.".to_string(),
            recommendation: Some("Use only authorized MediaTek recovery workflows compatible with this device.".to_string()),
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

    let (connection_grade, connection_summary) = if !authorized.is_empty() && mtp.is_some() {
        ("excellent", "USB data, MTP, and authorized ADB are all available.".to_string())
    } else if mtp.is_some() || !authorized.is_empty() || !fastboot.is_empty() {
        ("usable", "At least one verified Android data transport is available, but not all normal-service transports are active.".to_string())
    } else if !android_usb.is_empty() {
        ("limited", "Android USB hardware is visible, but no usable MTP, ADB, or Fastboot transport is established.".to_string())
    } else {
        ("none", "No Android-class USB connection or Android service transport is currently visible.".to_string())
    };

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
        android_usb_devices_seen: android_usb.len(),
        usb_connections,
        connection_grade,
        connection_summary,
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


#[tauri::command]
pub async fn usb_cable_doctor() -> Result<CableDoctorReport, String> {
    const SAMPLE_COUNT: usize = 4;
    let mut sample_sets: Vec<BTreeSet<String>> = Vec::with_capacity(SAMPLE_COUNT);
    let mut observed_speeds = BTreeSet::new();
    let mut observed_modes = BTreeSet::new();
    let mut evidence = Vec::new();
    let mut android_present_samples = 0usize;

    for sample_index in 0..SAMPLE_COUNT {
        let scan = bootforgeusb::scan().map_err(|e| format!("USB scan failed: {e}"))?;
        let android: Vec<_> = scan
            .iter()
            .filter(|d| d.platform_hint.starts_with("android-"))
            .collect();

        if !android.is_empty() {
            android_present_samples += 1;
        }

        let mut identities = BTreeSet::new();
        for d in android {
            identities.insert(d.device_uid.clone());
            observed_speeds.insert(d.speed.clone());
            observed_modes.insert(d.mode.clone());
            evidence.push(DiagnosticEvidence {
                source: "usb-sample".to_string(),
                detail: format!(
                    "sample {} {:04X}:{:04X} uid={} mode={} speed={} bus={} addr={} via {}",
                    sample_index + 1,
                    d.vendor_id,
                    d.product_id,
                    d.device_uid,
                    d.mode,
                    d.speed,
                    d.bus_number,
                    d.device_address,
                    d.evidence_source
                ),
            });
        }
        sample_sets.push(identities);

        if sample_index + 1 < SAMPLE_COUNT {
            tokio::time::sleep(std::time::Duration::from_millis(350)).await;
        }
    }

    let mut reconnect_events = 0usize;
    for pair in sample_sets.windows(2) {
        if pair[0] != pair[1] {
            reconnect_events += 1;
        }
    }

    let adb = crate::adb_workflows::adb_scan().unwrap_or_default();
    let adb_state = if adb.iter().any(|d| d.authorized) {
        "authorized".to_string()
    } else if adb.iter().any(|d| d.state == "unauthorized") {
        "unauthorized".to_string()
    } else if adb.iter().any(|d| d.state == "offline") {
        "offline".to_string()
    } else if adb.is_empty() {
        "not-detected".to_string()
    } else {
        adb[0].state.clone()
    };
    let mtp_connected = crate::mtp_backend::mtp_status().await.is_ok();
    let fastboot_present = !fastboot_devices().is_empty();

    evidence.push(DiagnosticEvidence {
        source: "transport-cross-check".to_string(),
        detail: format!(
            "adb={} mtp={} fastboot={}",
            adb_state, mtp_connected, fastboot_present
        ),
    });

    let any_android = android_present_samples > 0;
    let fully_present = android_present_samples == SAMPLE_COUNT;

    let (grade, summary) = if !any_android && adb.is_empty() && !mtp_connected && !fastboot_present {
        (
            "no-device",
            "No Android USB device or Android service transport was detected during the cable test.".to_string(),
        )
    } else if reconnect_events > 0 || !fully_present {
        (
            "unstable",
            format!(
                "The Android USB identity changed or disappeared {} time(s) across {} samples.",
                reconnect_events, SAMPLE_COUNT
            ),
        )
    } else if mtp_connected || adb_state == "authorized" || fastboot_present {
        (
            "healthy",
            "The Android USB identity remained stable and at least one verified data transport is usable.".to_string(),
        )
    } else {
        (
            "limited",
            "The Android USB device remained visible, but MTP, authorized ADB, and Fastboot are unavailable.".to_string(),
        )
    };

    let mut recommendations = Vec::new();
    match grade {
        "no-device" => {
            recommendations.push("Try a known data-capable USB cable and a direct Mac USB port.".to_string());
            recommendations.push("Unlock the phone and confirm it is powered on.".to_string());
        }
        "unstable" => {
            recommendations.push("Reconnect with a different known-good data cable.".to_string());
            recommendations.push("Remove passive hubs/adapters and connect directly to the Mac for qualification.".to_string());
            recommendations.push("Inspect the phone USB port for intermittent contact or debris.".to_string());
        }
        "limited" => {
            recommendations.push("The physical USB link is stable; check Android USB preferences and choose File Transfer for MTP.".to_string());
            recommendations.push("If ADB is needed, enable USB debugging and authorize this Mac on the phone.".to_string());
        }
        "healthy" => {
            recommendations.push("The sampled USB link is stable. No cable-path change is indicated by this test.".to_string());
        }
        _ => {}
    }

    if adb_state == "unauthorized" {
        recommendations.push("Approve the USB debugging authorization prompt on the unlocked phone.".to_string());
    } else if adb_state == "offline" {
        recommendations.push("Restart the ADB connection after reconnecting USB; the current ADB transport is offline.".to_string());
    }

    Ok(CableDoctorReport {
        grade,
        summary,
        samples: SAMPLE_COUNT,
        android_present_samples,
        reconnect_events,
        observed_speeds: observed_speeds.into_iter().collect(),
        observed_modes: observed_modes.into_iter().collect(),
        adb_state,
        mtp_connected,
        fastboot_present,
        recommendations,
        evidence,
    })
}
