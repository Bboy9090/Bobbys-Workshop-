use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Confirmed device record with stable identity, platform classification, and tool correlation.
/// 
/// A confirmed device is a USB transport that has been:
/// 1. Classified (platform + mode determined)
/// 2. Correlated (matched to tool output, if available)
/// 3. Scored (confidence assigned)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfirmedDeviceRecord {
    pub device_uid: String,
    pub platform_hint: String,
    pub mode: String,
    pub confidence: f32,
    pub evidence: Evidence,
    pub notes: Vec<String>,
    pub matched_tool_ids: Vec<String>,
}

/// Legacy alias for backwards compatibility
pub type DeviceRecord = ConfirmedDeviceRecord;

/// Evidence bundle - USB transport data + tool outputs.
/// 
/// Contains all evidence used for device classification and identity resolution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Evidence {
    /// USB transport evidence (raw USB layer data)
    pub usb: UsbTransportEvidence,
    /// Tool evidence (adb, fastboot, idevice_id outputs)
    pub tools: HashMap<String, ToolEvidence>,
}

/// USB transport evidence - raw USB layer data before platform classification.
/// 
/// A transport represents the physical USB connection (bus + address) with
/// descriptors (VID/PID, manufacturer, product, serial, interfaces).
/// 
/// Multiple transports can represent the same logical device (reconnections).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbTransportEvidence {
    pub vid: String,
    pub pid: String,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial: Option<String>,
    pub bus: u8,
    pub address: u8,
    pub interface_class: Option<u8>,
    pub interface_hints: Vec<InterfaceHint>,
}

/// Legacy alias for backwards compatibility
pub type UsbEvidence = UsbTransportEvidence;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterfaceHint {
    pub class: u8,
    pub subclass: u8,
    pub protocol: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolEvidence {
    pub present: bool,
    pub seen: bool,
    pub raw: String,
    pub device_ids: Vec<String>,
}

impl ToolEvidence {
    pub fn missing() -> Self {
        Self {
            present: false,
            seen: false,
            raw: "missing".to_string(),
            device_ids: vec![],
        }
    }

    pub fn present_not_seen() -> Self {
        Self {
            present: true,
            seen: false,
            raw: String::new(),
            device_ids: vec![],
        }
    }

    pub fn confirmed(raw: String, device_ids: Vec<String>) -> Self {
        Self {
            present: true,
            seen: !device_ids.is_empty(),
            raw,
            device_ids,
        }
    }
}

#[derive(Debug, Clone)]
pub enum DeviceMode {
    IosNormalLikely,
    IosRecoveryLikely,
    IosDfuLikely,
    AndroidAdbConfirmed,
    AndroidFastbootConfirmed,
    AndroidRecoveryAdbConfirmed,
    UnknownUsb,
}

impl DeviceMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            DeviceMode::IosNormalLikely => "ios_normal_likely",
            DeviceMode::IosRecoveryLikely => "ios_recovery_likely",
            DeviceMode::IosDfuLikely => "ios_dfu_likely",
            DeviceMode::AndroidAdbConfirmed => "android_adb_confirmed",
            DeviceMode::AndroidFastbootConfirmed => "android_fastboot_confirmed",
            DeviceMode::AndroidRecoveryAdbConfirmed => "android_recovery_adb_confirmed",
            DeviceMode::UnknownUsb => "unknown_usb",
        }
    }
}

/// Device classification result - platform, mode, and confidence.
/// 
/// Produced by classifying a candidate USB transport based on VID/PID
/// patterns and interface hints. May be updated during identity resolution
/// if tool correlation provides additional evidence.
#[derive(Debug, Clone)]
pub struct Classification {
    pub mode: DeviceMode,
    pub confidence: f32,
    pub notes: Vec<String>,
}
