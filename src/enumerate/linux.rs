// Suppress unused import warnings on non-Linux platforms where these are conditionally compiled
#[allow(unused_imports)]
use crate::types::UsbDeviceInfo;
use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};

/// Enrich Linux platform specific data for USB device information
#[cfg(target_os = "linux")]
pub fn enrich_linux(devices: &mut [UsbDeviceInfo]) -> Result<()> {
    for device in devices.iter_mut() {
        let sysfs_path = find_sysfs_path(device.bus_number, device.device_address);

        if let Some(path) = sysfs_path {
            device.platform_hint.sysfs_path = Some(path.to_string_lossy().to_string());

            enrich_from_sysfs(device, &path);
        }
    }

    Ok(())
}

/// Find the sysfs path for a USB device on Linux given its bus and device number
#[cfg(target_os = "linux")]
fn find_sysfs_path(bus_number: u8, device_address: u8) -> Option<PathBuf> {
    let sysfs_base = PathBuf::from("/sys/bus/usb/devices");

    if !sysfs_base.exists() {
        return None;
    }

    if let Ok(entries) = fs::read_dir(&sysfs_base) {
        for entry in entries.flatten() {
            let path = entry.path();

            if let (Ok(bus), Ok(dev)) = (
                read_sysfs_number(&path, "busnum"),
                read_sysfs_number(&path, "devnum"),
            ) {
                if bus == bus_number && dev == device_address {
                    return Some(path);
                }
            }
        }
    }

    None
}

/// Read a numeric value from a sysfs file on Linux
#[cfg(target_os = "linux")]
fn read_sysfs_number(device_path: &std::path::Path, filename: &str) -> Result<u8> {
    let file_path = device_path.join(filename);
    let content = fs::read_to_string(&file_path)
        .with_context(|| format!("Failed to read {}", file_path.display()))?;
    let value = content.trim().parse().with_context(|| {
        format!(
            "Failed to parse {} from {} as number",
            content.trim(),
            file_path.display()
        )
    })?;
    Ok(value)
}

/// Enrich device information with Linux-specific data from sysfs files
#[cfg(target_os = "linux")]
fn enrich_from_sysfs(device: &mut UsbDeviceInfo, sysfs_path: &std::path::Path) {
    if device.manufacturer.is_none() {
        if let Ok(content) = fs::read_to_string(sysfs_path.join("manufacturer")) {
            device.manufacturer = Some(content.trim().to_string());
        }
    }

    if device.product.is_none() {
        if let Ok(content) = fs::read_to_string(sysfs_path.join("product")) {
            device.product = Some(content.trim().to_string());
        }
    }

    if device.serial_number.is_none() {
        if let Ok(content) = fs::read_to_string(sysfs_path.join("serial")) {
            device.serial_number = Some(content.trim().to_string());
        }
    }
}

/// Non-Linux platforms: no-op stub
#[cfg(not(target_os = "linux"))]
pub fn enrich_linux(_devices: &mut [UsbDeviceInfo]) -> Result<()> {
    Ok(())
}
