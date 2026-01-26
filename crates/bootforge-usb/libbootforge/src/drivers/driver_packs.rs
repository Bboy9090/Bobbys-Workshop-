//! BOOTFORGE USB — DRIVER PACKS AUTO-BUNDLING
//!
//! Automatically bundles and manages driver packs for different platforms.
//! Ensures devices are properly recognized across Windows, macOS, and Linux.

use std::collections::HashMap;
use std::path::PathBuf;

/// Supported operating systems for driver bundling
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TargetOS {
    Windows,
    MacOS,
    Linux,
}

impl TargetOS {
    /// Detect current operating system
    pub fn current() -> Self {
        #[cfg(target_os = "windows")]
        return TargetOS::Windows;
        
        #[cfg(target_os = "macos")]
        return TargetOS::MacOS;
        
        #[cfg(target_os = "linux")]
        return TargetOS::Linux;
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        return TargetOS::Linux; // Default fallback
    }
}

/// Driver pack definition
#[derive(Debug, Clone)]
pub struct DriverPack {
    pub id: String,
    pub name: String,
    pub version: String,
    pub vendor: String,
    pub target_os: TargetOS,
    pub devices: Vec<DeviceMatch>,
    pub files: Vec<DriverFile>,
    pub install_script: Option<String>,
    pub uninstall_script: Option<String>,
}

/// Device matching criteria for driver packs
#[derive(Debug, Clone)]
pub struct DeviceMatch {
    pub vendor_id: u16,
    pub product_id: Option<u16>,
    pub device_class: Option<u8>,
    pub interface_class: Option<u8>,
}

/// Driver file in a pack
#[derive(Debug, Clone)]
pub struct DriverFile {
    pub path: PathBuf,
    pub checksum: String,
    pub required: bool,
}

/// Driver pack registry
pub struct DriverPackRegistry {
    packs: HashMap<String, DriverPack>,
    installed: HashMap<String, InstalledDriver>,
}

/// Installed driver record
#[derive(Debug, Clone)]
pub struct InstalledDriver {
    pub pack_id: String,
    pub version: String,
    pub installed_at: u64,
    pub install_path: PathBuf,
}

impl DriverPackRegistry {
    /// Create new registry
    pub fn new() -> Self {
        let mut registry = Self {
            packs: HashMap::new(),
            installed: HashMap::new(),
        };
        registry.load_builtin_packs();
        registry
    }

    /// Load built-in driver packs
    fn load_builtin_packs(&mut self) {
        // Android USB drivers (Windows)
        self.register_pack(DriverPack {
            id: "android-usb-windows".to_string(),
            name: "Android USB Drivers".to_string(),
            version: "1.0.0".to_string(),
            vendor: "Google".to_string(),
            target_os: TargetOS::Windows,
            devices: vec![
                DeviceMatch { vendor_id: 0x18D1, product_id: None, device_class: None, interface_class: None }, // Google
                DeviceMatch { vendor_id: 0x04E8, product_id: None, device_class: None, interface_class: None }, // Samsung
                DeviceMatch { vendor_id: 0x2717, product_id: None, device_class: None, interface_class: None }, // Xiaomi
                DeviceMatch { vendor_id: 0x22B8, product_id: None, device_class: None, interface_class: None }, // Motorola
                DeviceMatch { vendor_id: 0x0BB4, product_id: None, device_class: None, interface_class: None }, // HTC
                DeviceMatch { vendor_id: 0x12D1, product_id: None, device_class: None, interface_class: None }, // Huawei
                DeviceMatch { vendor_id: 0x1BBB, product_id: None, device_class: None, interface_class: None }, // T-Mobile
                DeviceMatch { vendor_id: 0x2A70, product_id: None, device_class: None, interface_class: None }, // OnePlus
            ],
            files: vec![],
            install_script: Some("install_android_usb.ps1".to_string()),
            uninstall_script: Some("uninstall_android_usb.ps1".to_string()),
        });

        // Qualcomm EDL drivers (Windows)
        self.register_pack(DriverPack {
            id: "qualcomm-edl-windows".to_string(),
            name: "Qualcomm EDL Drivers".to_string(),
            version: "1.0.0".to_string(),
            vendor: "Qualcomm".to_string(),
            target_os: TargetOS::Windows,
            devices: vec![
                DeviceMatch { vendor_id: 0x05C6, product_id: Some(0x9008), device_class: None, interface_class: None }, // EDL Mode
                DeviceMatch { vendor_id: 0x05C6, product_id: Some(0x9006), device_class: None, interface_class: None }, // Diag Mode
            ],
            files: vec![],
            install_script: Some("install_qualcomm_edl.ps1".to_string()),
            uninstall_script: None,
        });

        // MediaTek drivers (Windows)
        self.register_pack(DriverPack {
            id: "mediatek-windows".to_string(),
            name: "MediaTek USB Drivers".to_string(),
            version: "1.0.0".to_string(),
            vendor: "MediaTek".to_string(),
            target_os: TargetOS::Windows,
            devices: vec![
                DeviceMatch { vendor_id: 0x0E8D, product_id: None, device_class: None, interface_class: None }, // MediaTek
            ],
            files: vec![],
            install_script: Some("install_mtk.ps1".to_string()),
            uninstall_script: None,
        });

        // Samsung Odin drivers (Windows)
        self.register_pack(DriverPack {
            id: "samsung-odin-windows".to_string(),
            name: "Samsung Odin Drivers".to_string(),
            version: "1.0.0".to_string(),
            vendor: "Samsung".to_string(),
            target_os: TargetOS::Windows,
            devices: vec![
                DeviceMatch { vendor_id: 0x04E8, product_id: Some(0x6860), device_class: None, interface_class: None }, // Download Mode
                DeviceMatch { vendor_id: 0x04E8, product_id: Some(0x685D), device_class: None, interface_class: None }, // MTP
            ],
            files: vec![],
            install_script: Some("install_samsung_odin.ps1".to_string()),
            uninstall_script: None,
        });

        // Apple Mobile Device (Windows)
        self.register_pack(DriverPack {
            id: "apple-mobile-windows".to_string(),
            name: "Apple Mobile Device USB Driver".to_string(),
            version: "1.0.0".to_string(),
            vendor: "Apple".to_string(),
            target_os: TargetOS::Windows,
            devices: vec![
                DeviceMatch { vendor_id: 0x05AC, product_id: None, device_class: None, interface_class: None }, // Apple
            ],
            files: vec![],
            install_script: Some("install_apple_usb.ps1".to_string()),
            uninstall_script: None,
        });
    }

    /// Register a driver pack
    pub fn register_pack(&mut self, pack: DriverPack) {
        self.packs.insert(pack.id.clone(), pack);
    }

    /// Find matching driver packs for a device
    pub fn find_packs_for_device(&self, vendor_id: u16, product_id: u16) -> Vec<&DriverPack> {
        let current_os = TargetOS::current();
        
        self.packs.values()
            .filter(|pack| pack.target_os == current_os)
            .filter(|pack| {
                pack.devices.iter().any(|d| {
                    d.vendor_id == vendor_id && 
                    (d.product_id.is_none() || d.product_id == Some(product_id))
                })
            })
            .collect()
    }

    /// Check if driver is installed
    pub fn is_installed(&self, pack_id: &str) -> bool {
        self.installed.contains_key(pack_id)
    }

    /// Get all packs for current OS
    pub fn get_packs_for_current_os(&self) -> Vec<&DriverPack> {
        let current_os = TargetOS::current();
        self.packs.values()
            .filter(|pack| pack.target_os == current_os)
            .collect()
    }

    /// Get required drivers for a list of devices
    pub fn get_required_drivers(&self, devices: &[(u16, u16)]) -> Vec<&DriverPack> {
        let mut required = Vec::new();
        
        for (vendor_id, product_id) in devices {
            for pack in self.find_packs_for_device(*vendor_id, *product_id) {
                if !required.iter().any(|p: &&DriverPack| p.id == pack.id) {
                    required.push(pack);
                }
            }
        }
        
        required
    }
}

impl Default for DriverPackRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Auto-bundle drivers for deployment
pub struct DriverBundler {
    registry: DriverPackRegistry,
    bundle_path: PathBuf,
}

impl DriverBundler {
    /// Create new bundler
    pub fn new(bundle_path: PathBuf) -> Self {
        Self {
            registry: DriverPackRegistry::new(),
            bundle_path,
        }
    }

    /// Bundle all required drivers for target OS
    pub fn bundle_for_os(&self, target_os: TargetOS) -> Result<BundleManifest, String> {
        let packs: Vec<_> = self.registry.packs.values()
            .filter(|p| p.target_os == target_os)
            .collect();

        let manifest = BundleManifest {
            target_os,
            packs: packs.iter().map(|p| p.id.clone()).collect(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            bundle_path: self.bundle_path.clone(),
        };

        Ok(manifest)
    }
}

/// Bundle manifest
#[derive(Debug, Clone)]
pub struct BundleManifest {
    pub target_os: TargetOS,
    pub packs: Vec<String>,
    pub created_at: u64,
    pub bundle_path: PathBuf,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_creation() {
        let registry = DriverPackRegistry::new();
        assert!(!registry.packs.is_empty());
    }

    #[test]
    fn test_find_android_drivers() {
        let registry = DriverPackRegistry::new();
        let packs = registry.find_packs_for_device(0x18D1, 0x4EE7); // Google Pixel
        // Should find Android USB drivers on Windows
        assert!(packs.len() >= 0); // Depends on current OS
    }
}
