//! BOOTFORGE USB — OS-SPECIFIC BOOT PROFILES
//!
//! Defines boot profiles for different operating systems and device types.
//! Profiles contain partition layouts, boot sequences, and recovery options.

use std::collections::HashMap;

/// Boot profile for a specific OS/device combination
#[derive(Debug, Clone)]
pub struct BootProfile {
    pub id: String,
    pub name: String,
    pub os_type: OSType,
    pub device_family: DeviceFamily,
    pub partitions: Vec<PartitionDef>,
    pub boot_sequence: Vec<BootStep>,
    pub recovery_options: Vec<RecoveryOption>,
    pub verified_boot: Option<VerifiedBootConfig>,
}

/// Operating system type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum OSType {
    Android,
    IOS,
    Windows,
    Linux,
    ChromeOS,
    Custom,
}

/// Device family for profile matching
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DeviceFamily {
    // Android
    GooglePixel,
    Samsung,
    Xiaomi,
    OnePlus,
    Motorola,
    Huawei,
    GenericAndroid,
    
    // Apple
    IPhone,
    IPad,
    
    // Other
    GenericARM,
    GenericX86,
}

/// Partition definition
#[derive(Debug, Clone)]
pub struct PartitionDef {
    pub name: String,
    pub label: String,
    pub size_bytes: Option<u64>,  // None = dynamic
    pub filesystem: PartitionFS,
    pub flags: Vec<PartitionFlag>,
    pub flashable: bool,
    pub critical: bool,
}

/// Partition filesystem types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PartitionFS {
    Ext4,
    F2FS,
    EROFS,
    VFAT,
    ExFAT,
    NTFS,
    APFS,
    HFS,
    Raw,
    Unknown,
}

/// Partition flags
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PartitionFlag {
    Bootable,
    System,
    Recovery,
    Userdata,
    Cache,
    Vendor,
    ODM,
    Product,
    SystemExt,
    VBMeta,
    DTBO,
    Boot,
    InitBoot,
    VendorBoot,
    Modem,
    Persist,
}

/// Boot sequence step
#[derive(Debug, Clone)]
pub struct BootStep {
    pub order: u32,
    pub name: String,
    pub action: BootAction,
    pub timeout_ms: u32,
    pub required: bool,
    pub fallback: Option<Box<BootStep>>,
}

/// Boot action types
#[derive(Debug, Clone)]
pub enum BootAction {
    FlashPartition { partition: String, image: String },
    ErasePartition { partition: String },
    SetActive { slot: String },
    Reboot { mode: RebootMode },
    Wait { condition: WaitCondition },
    Verify { partition: String, hash: String },
    UnlockBootloader,
    LockBootloader,
    FormatData,
    Custom { command: String },
}

/// Reboot modes
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RebootMode {
    Normal,
    Recovery,
    Bootloader,
    Fastboot,
    Download,
    EDL,
    DFU,
}

/// Wait conditions
#[derive(Debug, Clone)]
pub enum WaitCondition {
    DeviceConnected,
    ModeChange { target: RebootMode },
    UserConfirmation { message: String },
    Timeout { ms: u32 },
}

/// Recovery options
#[derive(Debug, Clone)]
pub struct RecoveryOption {
    pub id: String,
    pub name: String,
    pub description: String,
    pub steps: Vec<BootStep>,
    pub risk_level: RiskLevel,
}

/// Risk levels
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RiskLevel {
    Safe,
    Low,
    Medium,
    High,
    Critical,
}

/// Verified boot configuration
#[derive(Debug, Clone)]
pub struct VerifiedBootConfig {
    pub version: u8,  // AVB 1.0, 2.0, etc
    pub rollback_index: u64,
    pub vbmeta_partitions: Vec<String>,
    pub chain_partitions: Vec<ChainPartition>,
}

/// Chain partition for verified boot
#[derive(Debug, Clone)]
pub struct ChainPartition {
    pub partition: String,
    pub rollback_index_slot: u32,
    pub public_key: String,
}

/// Boot profile registry
pub struct BootProfileRegistry {
    profiles: HashMap<String, BootProfile>,
}

impl BootProfileRegistry {
    /// Create new registry with built-in profiles
    pub fn new() -> Self {
        let mut registry = Self {
            profiles: HashMap::new(),
        };
        registry.load_builtin_profiles();
        registry
    }

    /// Load built-in boot profiles
    fn load_builtin_profiles(&mut self) {
        // Google Pixel (Android 14+)
        self.register_profile(BootProfile {
            id: "google-pixel-android14".to_string(),
            name: "Google Pixel (Android 14+)".to_string(),
            os_type: OSType::Android,
            device_family: DeviceFamily::GooglePixel,
            partitions: vec![
                PartitionDef {
                    name: "boot".to_string(),
                    label: "Boot".to_string(),
                    size_bytes: Some(64 * 1024 * 1024), // 64MB
                    filesystem: PartitionFS::Raw,
                    flags: vec![PartitionFlag::Boot, PartitionFlag::Bootable],
                    flashable: true,
                    critical: true,
                },
                PartitionDef {
                    name: "init_boot".to_string(),
                    label: "Init Boot".to_string(),
                    size_bytes: Some(8 * 1024 * 1024), // 8MB
                    filesystem: PartitionFS::Raw,
                    flags: vec![PartitionFlag::InitBoot],
                    flashable: true,
                    critical: true,
                },
                PartitionDef {
                    name: "vendor_boot".to_string(),
                    label: "Vendor Boot".to_string(),
                    size_bytes: Some(64 * 1024 * 1024), // 64MB
                    filesystem: PartitionFS::Raw,
                    flags: vec![PartitionFlag::VendorBoot],
                    flashable: true,
                    critical: true,
                },
                PartitionDef {
                    name: "system".to_string(),
                    label: "System".to_string(),
                    size_bytes: None, // Dynamic
                    filesystem: PartitionFS::EROFS,
                    flags: vec![PartitionFlag::System],
                    flashable: true,
                    critical: true,
                },
                PartitionDef {
                    name: "vendor".to_string(),
                    label: "Vendor".to_string(),
                    size_bytes: None,
                    filesystem: PartitionFS::EROFS,
                    flags: vec![PartitionFlag::Vendor],
                    flashable: true,
                    critical: true,
                },
                PartitionDef {
                    name: "vbmeta".to_string(),
                    label: "VBMeta".to_string(),
                    size_bytes: Some(64 * 1024), // 64KB
                    filesystem: PartitionFS::Raw,
                    flags: vec![PartitionFlag::VBMeta],
                    flashable: true,
                    critical: true,
                },
                PartitionDef {
                    name: "userdata".to_string(),
                    label: "User Data".to_string(),
                    size_bytes: None,
                    filesystem: PartitionFS::F2FS,
                    flags: vec![PartitionFlag::Userdata],
                    flashable: false,
                    critical: false,
                },
            ],
            boot_sequence: vec![
                BootStep {
                    order: 1,
                    name: "Flash boot".to_string(),
                    action: BootAction::FlashPartition { 
                        partition: "boot".to_string(), 
                        image: "boot.img".to_string() 
                    },
                    timeout_ms: 30000,
                    required: true,
                    fallback: None,
                },
                BootStep {
                    order: 2,
                    name: "Set active slot".to_string(),
                    action: BootAction::SetActive { slot: "a".to_string() },
                    timeout_ms: 5000,
                    required: true,
                    fallback: None,
                },
                BootStep {
                    order: 3,
                    name: "Reboot to system".to_string(),
                    action: BootAction::Reboot { mode: RebootMode::Normal },
                    timeout_ms: 60000,
                    required: true,
                    fallback: None,
                },
            ],
            recovery_options: vec![
                RecoveryOption {
                    id: "factory-reset".to_string(),
                    name: "Factory Reset".to_string(),
                    description: "Wipe user data and cache".to_string(),
                    steps: vec![
                        BootStep {
                            order: 1,
                            name: "Format userdata".to_string(),
                            action: BootAction::FormatData,
                            timeout_ms: 60000,
                            required: true,
                            fallback: None,
                        },
                    ],
                    risk_level: RiskLevel::High,
                },
            ],
            verified_boot: Some(VerifiedBootConfig {
                version: 2,
                rollback_index: 0,
                vbmeta_partitions: vec!["vbmeta".to_string(), "vbmeta_system".to_string()],
                chain_partitions: vec![],
            }),
        });

        // Samsung (Android)
        self.register_profile(BootProfile {
            id: "samsung-android".to_string(),
            name: "Samsung Galaxy (Odin)".to_string(),
            os_type: OSType::Android,
            device_family: DeviceFamily::Samsung,
            partitions: vec![
                PartitionDef {
                    name: "BOOT".to_string(),
                    label: "Boot".to_string(),
                    size_bytes: None,
                    filesystem: PartitionFS::Raw,
                    flags: vec![PartitionFlag::Boot],
                    flashable: true,
                    critical: true,
                },
                PartitionDef {
                    name: "RECOVERY".to_string(),
                    label: "Recovery".to_string(),
                    size_bytes: None,
                    filesystem: PartitionFS::Raw,
                    flags: vec![PartitionFlag::Recovery],
                    flashable: true,
                    critical: true,
                },
                PartitionDef {
                    name: "SYSTEM".to_string(),
                    label: "System".to_string(),
                    size_bytes: None,
                    filesystem: PartitionFS::Ext4,
                    flags: vec![PartitionFlag::System],
                    flashable: true,
                    critical: true,
                },
            ],
            boot_sequence: vec![
                BootStep {
                    order: 1,
                    name: "Wait for Download mode".to_string(),
                    action: BootAction::Wait { 
                        condition: WaitCondition::ModeChange { target: RebootMode::Download } 
                    },
                    timeout_ms: 60000,
                    required: true,
                    fallback: None,
                },
            ],
            recovery_options: vec![],
            verified_boot: None,
        });

        // iPhone (iOS)
        self.register_profile(BootProfile {
            id: "iphone-ios".to_string(),
            name: "iPhone (iOS)".to_string(),
            os_type: OSType::IOS,
            device_family: DeviceFamily::IPhone,
            partitions: vec![
                PartitionDef {
                    name: "iBoot".to_string(),
                    label: "iBoot".to_string(),
                    size_bytes: None,
                    filesystem: PartitionFS::Raw,
                    flags: vec![PartitionFlag::Boot],
                    flashable: false,
                    critical: true,
                },
                PartitionDef {
                    name: "System".to_string(),
                    label: "System".to_string(),
                    size_bytes: None,
                    filesystem: PartitionFS::APFS,
                    flags: vec![PartitionFlag::System],
                    flashable: false,
                    critical: true,
                },
                PartitionDef {
                    name: "Data".to_string(),
                    label: "Data".to_string(),
                    size_bytes: None,
                    filesystem: PartitionFS::APFS,
                    flags: vec![PartitionFlag::Userdata],
                    flashable: false,
                    critical: false,
                },
            ],
            boot_sequence: vec![
                BootStep {
                    order: 1,
                    name: "Enter DFU mode".to_string(),
                    action: BootAction::Wait { 
                        condition: WaitCondition::UserConfirmation { 
                            message: "Please enter DFU mode on the device".to_string() 
                        } 
                    },
                    timeout_ms: 120000,
                    required: true,
                    fallback: None,
                },
            ],
            recovery_options: vec![
                RecoveryOption {
                    id: "dfu-restore".to_string(),
                    name: "DFU Restore".to_string(),
                    description: "Full device restore via DFU mode".to_string(),
                    steps: vec![],
                    risk_level: RiskLevel::High,
                },
            ],
            verified_boot: None,
        });
    }

    /// Register a boot profile
    pub fn register_profile(&mut self, profile: BootProfile) {
        self.profiles.insert(profile.id.clone(), profile);
    }

    /// Get profile by ID
    pub fn get_profile(&self, id: &str) -> Option<&BootProfile> {
        self.profiles.get(id)
    }

    /// Find profiles for OS type
    pub fn find_by_os(&self, os_type: OSType) -> Vec<&BootProfile> {
        self.profiles.values()
            .filter(|p| p.os_type == os_type)
            .collect()
    }

    /// Find profiles for device family
    pub fn find_by_device_family(&self, family: DeviceFamily) -> Vec<&BootProfile> {
        self.profiles.values()
            .filter(|p| p.device_family == family)
            .collect()
    }

    /// Get all profiles
    pub fn all_profiles(&self) -> Vec<&BootProfile> {
        self.profiles.values().collect()
    }
}

impl Default for BootProfileRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_has_builtin_profiles() {
        let registry = BootProfileRegistry::new();
        assert!(registry.get_profile("google-pixel-android14").is_some());
        assert!(registry.get_profile("samsung-android").is_some());
        assert!(registry.get_profile("iphone-ios").is_some());
    }

    #[test]
    fn test_find_by_os() {
        let registry = BootProfileRegistry::new();
        let android_profiles = registry.find_by_os(OSType::Android);
        assert!(!android_profiles.is_empty());
    }
}
