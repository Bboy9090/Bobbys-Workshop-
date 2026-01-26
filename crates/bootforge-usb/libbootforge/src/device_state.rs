//! LIBBOOTFORGE — UNIFIED DEVICE STATE
//!
//! Canonical JSON schema for representing device state across all operations.
//! This is the single source of truth for device information, status, and capabilities.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Unified Device State — The canonical representation of a connected device
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedDeviceState {
    /// Unique device identifier (serial number or UUID)
    pub id: String,
    
    /// Device metadata
    pub identity: DeviceIdentity,
    
    /// Current connection state
    pub connection: ConnectionState,
    
    /// Hardware information
    pub hardware: HardwareInfo,
    
    /// Software information
    pub software: SoftwareInfo,
    
    /// Security state
    pub security: SecurityState,
    
    /// Storage information
    pub storage: Vec<StoragePartition>,
    
    /// Battery status
    pub battery: Option<BatteryState>,
    
    /// Current operation (if any)
    pub operation: Option<OperationState>,
    
    /// Device capabilities
    pub capabilities: DeviceCapabilities,
    
    /// Timestamps
    pub timestamps: DeviceTimestamps,
    
    /// Custom properties
    #[serde(default)]
    pub custom: HashMap<String, serde_json::Value>,
}

/// Device identity information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceIdentity {
    /// Manufacturer name
    pub manufacturer: String,
    
    /// Device model
    pub model: String,
    
    /// Marketing name (e.g., "iPhone 15 Pro")
    pub marketing_name: Option<String>,
    
    /// Serial number
    pub serial_number: Option<String>,
    
    /// IMEI (for cellular devices)
    pub imei: Option<String>,
    
    /// MEID (for CDMA devices)
    pub meid: Option<String>,
    
    /// USB Vendor ID
    pub usb_vendor_id: u16,
    
    /// USB Product ID
    pub usb_product_id: u16,
    
    /// Device family (for profile matching)
    pub device_family: String,
}

/// Connection state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionState {
    /// Connection type
    pub transport: ConnectionTransport,
    
    /// Current mode
    pub mode: DeviceMode,
    
    /// USB port path
    pub usb_path: Option<String>,
    
    /// Connection speed
    pub speed: Option<ConnectionSpeed>,
    
    /// Is device authorized
    pub authorized: bool,
    
    /// Connection quality (0-100)
    pub quality: Option<u8>,
}

/// Connection transport types
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionTransport {
    Usb,
    Wifi,
    Bluetooth,
    Ethernet,
    Serial,
}

/// Device mode
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DeviceMode {
    Normal,
    Recovery,
    Fastboot,
    Download,
    Edl,
    Dfu,
    Adb,
    Mtp,
    Ptp,
    Charging,
    Unknown,
}

/// Connection speed
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionSpeed {
    Low,        // USB 1.0 - 1.5 Mbps
    Full,       // USB 1.1 - 12 Mbps
    High,       // USB 2.0 - 480 Mbps
    Super,      // USB 3.0 - 5 Gbps
    SuperPlus,  // USB 3.1 - 10 Gbps
    SuperPlusPlus, // USB 3.2 - 20 Gbps
}

/// Hardware information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareInfo {
    /// CPU architecture
    pub architecture: CpuArchitecture,
    
    /// SoC name
    pub soc: Option<String>,
    
    /// RAM size in bytes
    pub ram_bytes: Option<u64>,
    
    /// Screen resolution
    pub screen: Option<ScreenInfo>,
    
    /// Hardware revision
    pub hardware_rev: Option<String>,
    
    /// Baseband version
    pub baseband: Option<String>,
}

/// CPU architecture
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CpuArchitecture {
    Arm,
    Arm64,
    X86,
    X86_64,
    Mips,
    Riscv,
    Unknown,
}

/// Screen information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenInfo {
    pub width: u32,
    pub height: u32,
    pub density: u32,
}

/// Software information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareInfo {
    /// Operating system
    pub os: OperatingSystem,
    
    /// OS version
    pub os_version: String,
    
    /// Build number
    pub build_number: Option<String>,
    
    /// Security patch level
    pub security_patch: Option<String>,
    
    /// Bootloader version
    pub bootloader_version: Option<String>,
    
    /// Kernel version
    pub kernel_version: Option<String>,
    
    /// Firmware version
    pub firmware_version: Option<String>,
}

/// Operating system types
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum OperatingSystem {
    Android,
    Ios,
    Ipados,
    Windows,
    Linux,
    Chromeos,
    Custom,
    Unknown,
}

/// Security state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityState {
    /// Bootloader lock state
    pub bootloader_locked: Option<bool>,
    
    /// Verified boot state
    pub verified_boot: Option<VerifiedBootState>,
    
    /// Device encrypted
    pub encrypted: Option<bool>,
    
    /// FRP (Factory Reset Protection) enabled
    pub frp_enabled: Option<bool>,
    
    /// Knox enrolled (Samsung)
    pub knox_enrolled: Option<bool>,
    
    /// MDM enrolled
    pub mdm_enrolled: Option<bool>,
    
    /// Activation lock (Apple)
    pub activation_lock: Option<bool>,
    
    /// Root/Jailbreak status
    pub rooted: Option<bool>,
}

/// Verified boot state
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum VerifiedBootState {
    Green,
    Yellow,
    Orange,
    Red,
}

/// Storage partition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoragePartition {
    /// Partition name
    pub name: String,
    
    /// Partition label
    pub label: Option<String>,
    
    /// Total size in bytes
    pub size_bytes: u64,
    
    /// Used space in bytes
    pub used_bytes: Option<u64>,
    
    /// Filesystem type
    pub filesystem: String,
    
    /// Mount point
    pub mount_point: Option<String>,
    
    /// Is writable
    pub writable: bool,
}

/// Battery state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryState {
    /// Battery level (0-100)
    pub level: u8,
    
    /// Is charging
    pub charging: bool,
    
    /// Temperature in Celsius
    pub temperature: Option<f32>,
    
    /// Health status
    pub health: Option<BatteryHealth>,
    
    /// Voltage in mV
    pub voltage_mv: Option<u32>,
}

/// Battery health
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BatteryHealth {
    Good,
    Overheat,
    Dead,
    OverVoltage,
    UnspecifiedFailure,
    Cold,
    Unknown,
}

/// Current operation state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationState {
    /// Operation ID
    pub id: String,
    
    /// Operation type
    pub operation_type: String,
    
    /// Current phase
    pub phase: String,
    
    /// Progress (0-100)
    pub progress: f32,
    
    /// Started at (Unix timestamp)
    pub started_at: u64,
    
    /// Estimated completion (Unix timestamp)
    pub eta: Option<u64>,
    
    /// Can be cancelled
    pub cancellable: bool,
}

/// Device capabilities
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCapabilities {
    /// Supports ADB
    pub adb: bool,
    
    /// Supports Fastboot
    pub fastboot: bool,
    
    /// Supports EDL
    pub edl: bool,
    
    /// Supports DFU
    pub dfu: bool,
    
    /// Supports Download mode
    pub download_mode: bool,
    
    /// Supports OTA updates
    pub ota: bool,
    
    /// Supports sideloading
    pub sideload: bool,
    
    /// Supports backup
    pub backup: bool,
    
    /// Supports restore
    pub restore: bool,
    
    /// Supports screenshots
    pub screenshot: bool,
    
    /// Supports screen recording
    pub screen_record: bool,
    
    /// Supports shell commands
    pub shell: bool,
    
    /// Supports file transfer
    pub file_transfer: bool,
    
    /// Supports app installation
    pub install_app: bool,
    
    /// Supports diagnostics
    pub diagnostics: bool,
}

/// Device timestamps
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceTimestamps {
    /// First seen (Unix timestamp)
    pub first_seen: u64,
    
    /// Last seen (Unix timestamp)
    pub last_seen: u64,
    
    /// Last connected (Unix timestamp)
    pub last_connected: Option<u64>,
    
    /// Last operation completed (Unix timestamp)
    pub last_operation: Option<u64>,
}

impl UnifiedDeviceState {
    /// Create a new device state with minimal information
    pub fn new(id: String, manufacturer: String, model: String, vendor_id: u16, product_id: u16) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        Self {
            id: id.clone(),
            identity: DeviceIdentity {
                manufacturer,
                model,
                marketing_name: None,
                serial_number: Some(id),
                imei: None,
                meid: None,
                usb_vendor_id: vendor_id,
                usb_product_id: product_id,
                device_family: "unknown".to_string(),
            },
            connection: ConnectionState {
                transport: ConnectionTransport::Usb,
                mode: DeviceMode::Unknown,
                usb_path: None,
                speed: None,
                authorized: false,
                quality: None,
            },
            hardware: HardwareInfo {
                architecture: CpuArchitecture::Unknown,
                soc: None,
                ram_bytes: None,
                screen: None,
                hardware_rev: None,
                baseband: None,
            },
            software: SoftwareInfo {
                os: OperatingSystem::Unknown,
                os_version: "unknown".to_string(),
                build_number: None,
                security_patch: None,
                bootloader_version: None,
                kernel_version: None,
                firmware_version: None,
            },
            security: SecurityState {
                bootloader_locked: None,
                verified_boot: None,
                encrypted: None,
                frp_enabled: None,
                knox_enrolled: None,
                mdm_enrolled: None,
                activation_lock: None,
                rooted: None,
            },
            storage: vec![],
            battery: None,
            operation: None,
            capabilities: DeviceCapabilities::default(),
            timestamps: DeviceTimestamps {
                first_seen: now,
                last_seen: now,
                last_connected: Some(now),
                last_operation: None,
            },
            custom: HashMap::new(),
        }
    }
    
    /// Update last seen timestamp
    pub fn touch(&mut self) {
        self.timestamps.last_seen = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
    }
    
    /// Set connection mode
    pub fn set_mode(&mut self, mode: DeviceMode) {
        self.connection.mode = mode;
        self.touch();
    }
    
    /// Check if device is in a flashable state
    pub fn is_flashable(&self) -> bool {
        matches!(
            self.connection.mode,
            DeviceMode::Fastboot | DeviceMode::Download | DeviceMode::Edl | DeviceMode::Dfu
        )
    }
    
    /// Check if device is in normal operation
    pub fn is_normal(&self) -> bool {
        matches!(
            self.connection.mode,
            DeviceMode::Normal | DeviceMode::Adb | DeviceMode::Mtp
        )
    }
    
    /// Serialize to JSON string
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }
    
    /// Parse from JSON string
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

/// JSON Schema for validation (can be used by external tools)
pub const DEVICE_STATE_JSON_SCHEMA: &str = r#"{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "https://phoenixforge.dev/schemas/unified-device-state.json",
    "title": "Unified Device State",
    "description": "Canonical JSON schema for device state representation",
    "type": "object",
    "required": ["id", "identity", "connection", "hardware", "software", "security", "storage", "capabilities", "timestamps"],
    "properties": {
        "id": { "type": "string", "description": "Unique device identifier" },
        "identity": { "$ref": "#/definitions/DeviceIdentity" },
        "connection": { "$ref": "#/definitions/ConnectionState" },
        "hardware": { "$ref": "#/definitions/HardwareInfo" },
        "software": { "$ref": "#/definitions/SoftwareInfo" },
        "security": { "$ref": "#/definitions/SecurityState" },
        "storage": { "type": "array", "items": { "$ref": "#/definitions/StoragePartition" } },
        "battery": { "$ref": "#/definitions/BatteryState" },
        "operation": { "$ref": "#/definitions/OperationState" },
        "capabilities": { "$ref": "#/definitions/DeviceCapabilities" },
        "timestamps": { "$ref": "#/definitions/DeviceTimestamps" },
        "custom": { "type": "object" }
    },
    "definitions": {
        "DeviceIdentity": {
            "type": "object",
            "required": ["manufacturer", "model", "usbVendorId", "usbProductId", "deviceFamily"],
            "properties": {
                "manufacturer": { "type": "string" },
                "model": { "type": "string" },
                "marketingName": { "type": "string" },
                "serialNumber": { "type": "string" },
                "imei": { "type": "string" },
                "meid": { "type": "string" },
                "usbVendorId": { "type": "integer" },
                "usbProductId": { "type": "integer" },
                "deviceFamily": { "type": "string" }
            }
        },
        "ConnectionState": {
            "type": "object",
            "required": ["transport", "mode", "authorized"],
            "properties": {
                "transport": { "enum": ["usb", "wifi", "bluetooth", "ethernet", "serial"] },
                "mode": { "enum": ["normal", "recovery", "fastboot", "download", "edl", "dfu", "adb", "mtp", "ptp", "charging", "unknown"] },
                "usbPath": { "type": "string" },
                "speed": { "enum": ["low", "full", "high", "super", "superPlus", "superPlusPlus"] },
                "authorized": { "type": "boolean" },
                "quality": { "type": "integer", "minimum": 0, "maximum": 100 }
            }
        },
        "HardwareInfo": {
            "type": "object",
            "required": ["architecture"],
            "properties": {
                "architecture": { "enum": ["arm", "arm64", "x86", "x86_64", "mips", "riscv", "unknown"] },
                "soc": { "type": "string" },
                "ramBytes": { "type": "integer" },
                "screen": { "$ref": "#/definitions/ScreenInfo" },
                "hardwareRev": { "type": "string" },
                "baseband": { "type": "string" }
            }
        },
        "ScreenInfo": {
            "type": "object",
            "required": ["width", "height", "density"],
            "properties": {
                "width": { "type": "integer" },
                "height": { "type": "integer" },
                "density": { "type": "integer" }
            }
        },
        "SoftwareInfo": {
            "type": "object",
            "required": ["os", "osVersion"],
            "properties": {
                "os": { "enum": ["android", "ios", "ipados", "windows", "linux", "chromeos", "custom", "unknown"] },
                "osVersion": { "type": "string" },
                "buildNumber": { "type": "string" },
                "securityPatch": { "type": "string" },
                "bootloaderVersion": { "type": "string" },
                "kernelVersion": { "type": "string" },
                "firmwareVersion": { "type": "string" }
            }
        },
        "SecurityState": {
            "type": "object",
            "properties": {
                "bootloaderLocked": { "type": "boolean" },
                "verifiedBoot": { "enum": ["green", "yellow", "orange", "red"] },
                "encrypted": { "type": "boolean" },
                "frpEnabled": { "type": "boolean" },
                "knoxEnrolled": { "type": "boolean" },
                "mdmEnrolled": { "type": "boolean" },
                "activationLock": { "type": "boolean" },
                "rooted": { "type": "boolean" }
            }
        },
        "StoragePartition": {
            "type": "object",
            "required": ["name", "sizeBytes", "filesystem", "writable"],
            "properties": {
                "name": { "type": "string" },
                "label": { "type": "string" },
                "sizeBytes": { "type": "integer" },
                "usedBytes": { "type": "integer" },
                "filesystem": { "type": "string" },
                "mountPoint": { "type": "string" },
                "writable": { "type": "boolean" }
            }
        },
        "BatteryState": {
            "type": "object",
            "required": ["level", "charging"],
            "properties": {
                "level": { "type": "integer", "minimum": 0, "maximum": 100 },
                "charging": { "type": "boolean" },
                "temperature": { "type": "number" },
                "health": { "enum": ["good", "overheat", "dead", "overVoltage", "unspecifiedFailure", "cold", "unknown"] },
                "voltageMv": { "type": "integer" }
            }
        },
        "OperationState": {
            "type": "object",
            "required": ["id", "operationType", "phase", "progress", "startedAt", "cancellable"],
            "properties": {
                "id": { "type": "string" },
                "operationType": { "type": "string" },
                "phase": { "type": "string" },
                "progress": { "type": "number", "minimum": 0, "maximum": 100 },
                "startedAt": { "type": "integer" },
                "eta": { "type": "integer" },
                "cancellable": { "type": "boolean" }
            }
        },
        "DeviceCapabilities": {
            "type": "object",
            "properties": {
                "adb": { "type": "boolean" },
                "fastboot": { "type": "boolean" },
                "edl": { "type": "boolean" },
                "dfu": { "type": "boolean" },
                "downloadMode": { "type": "boolean" },
                "ota": { "type": "boolean" },
                "sideload": { "type": "boolean" },
                "backup": { "type": "boolean" },
                "restore": { "type": "boolean" },
                "screenshot": { "type": "boolean" },
                "screenRecord": { "type": "boolean" },
                "shell": { "type": "boolean" },
                "fileTransfer": { "type": "boolean" },
                "installApp": { "type": "boolean" },
                "diagnostics": { "type": "boolean" }
            }
        },
        "DeviceTimestamps": {
            "type": "object",
            "required": ["firstSeen", "lastSeen"],
            "properties": {
                "firstSeen": { "type": "integer" },
                "lastSeen": { "type": "integer" },
                "lastConnected": { "type": "integer" },
                "lastOperation": { "type": "integer" }
            }
        }
    }
}"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_device_state() {
        let state = UnifiedDeviceState::new(
            "ABC123".to_string(),
            "Google".to_string(),
            "Pixel 8".to_string(),
            0x18D1,
            0x4EE7,
        );
        
        assert_eq!(state.id, "ABC123");
        assert_eq!(state.identity.manufacturer, "Google");
        assert!(!state.is_flashable());
    }

    #[test]
    fn test_serialize_deserialize() {
        let state = UnifiedDeviceState::new(
            "XYZ789".to_string(),
            "Samsung".to_string(),
            "Galaxy S24".to_string(),
            0x04E8,
            0x6860,
        );
        
        let json = state.to_json().unwrap();
        let parsed = UnifiedDeviceState::from_json(&json).unwrap();
        
        assert_eq!(parsed.id, state.id);
        assert_eq!(parsed.identity.model, state.identity.model);
    }

    #[test]
    fn test_flashable_modes() {
        let mut state = UnifiedDeviceState::new(
            "TEST".to_string(),
            "Test".to_string(),
            "Device".to_string(),
            0x0000,
            0x0000,
        );
        
        state.set_mode(DeviceMode::Fastboot);
        assert!(state.is_flashable());
        
        state.set_mode(DeviceMode::Adb);
        assert!(!state.is_flashable());
        assert!(state.is_normal());
    }
}
