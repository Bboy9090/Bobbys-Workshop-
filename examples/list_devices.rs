//! Example: List all USB devices
//!
//! This example demonstrates how to enumerate all USB devices
//! connected to the system and display their information.
//!
//! Run with: cargo run --example list_devices

use bootforge_usb::enumerate_all;

fn main() -> anyhow::Result<()> {
    // Initialize a simple logger to see debug messages
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    println!("Enumerating USB devices...\n");

    // Enumerate all USB devices
    let devices = enumerate_all()?;

    println!("Found {} USB device(s):\n", devices.len());

    // Display each device
    for (i, device) in devices.iter().enumerate() {
        println!("Device {}:", i + 1);
        println!("  {}", device);
        println!("  Vendor ID:  {:04x}", device.vendor_id);
        println!("  Product ID: {:04x}", device.product_id);
        println!("  Class:      {:02x}", device.class);
        println!("  Subclass:   {:02x}", device.subclass);
        println!("  Protocol:   {:02x}", device.protocol);
        println!("  USB Ver:    {:04x}", device.usb_version);
        println!("  Bus Type:   {:?}", device.bus_type);

        if let Some(ref manufacturer) = device.manufacturer {
            println!("  Manufacturer: {}", manufacturer);
        }

        if let Some(ref product) = device.product {
            println!("  Product: {}", product);
        }

        if let Some(ref serial) = device.serial_number {
            println!("  Serial: {}", serial);
        }

        // Show platform-specific paths if available
        #[cfg(target_os = "linux")]
        if let Some(ref path) = device.platform_hint.sysfs_path {
            println!("  Sysfs Path: {}", path);
        }

        #[cfg(target_os = "windows")]
        if let Some(ref path) = device.platform_hint.device_path {
            println!("  Device Path: {}", path);
        }

        #[cfg(target_os = "macos")]
        if let Some(ref path) = device.platform_hint.ioregistry_path {
            println!("  IORegistry Path: {}", path);
        }

        println!();
    }

    Ok(())
}
