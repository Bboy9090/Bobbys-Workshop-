//! # BootForge USB
//!
//! A cross-platform USB device enumeration and information library.
//!
//! This library provides a unified interface for discovering USB devices across
//! Windows, macOS, and Linux platforms. It uses libusb (via rusb) for cross-platform
//! base enumeration and platform-specific APIs for enriching device information.
//!
//! ## Features
//!
//! - Cross-platform USB device enumeration
//! - Platform-specific device information enrichment
//! - Normalized device information structure
//! - Support for vendor/product IDs, serial numbers, and device paths
//!
//! ## Example
//!
//! ```no_run
//! use bootforge_usb::enumerate_all;
//!
//! fn main() -> anyhow::Result<()> {
//!     let devices = enumerate_all()?;
//!     
//!     for device in devices {
//!         println!("Device: {}", device);
//!         println!("  Vendor ID: {:04x}", device.vendor_id);
//!         println!("  Product ID: {:04x}", device.product_id);
//!         if let Some(manufacturer) = device.manufacturer {
//!             println!("  Manufacturer: {}", manufacturer);
//!         }
//!     }
//!     
//!     Ok(())
//! }
//! ```

pub mod enumerate;
pub mod types;

// Re-export main types and functions for convenient access
pub use enumerate::enumerate_all;
pub use types::{PlatformHint, UsbBusType, UsbDeviceInfo, UsbIds};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_enumeration() {
        // This is a basic smoke test
        // It may fail in CI environments without USB devices or permissions
        let result = enumerate_all();

        // We just verify it doesn't panic and returns a Result
        match result {
            Ok(_devices) => {
                // Success - devices were enumerated
            }
            Err(_e) => {
                // Also ok - may not have permissions or devices
            }
        }
    }
}
