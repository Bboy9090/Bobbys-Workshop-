use rusb::{Context, Direction, TransferType, UsbContext};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TransportError {
    #[error("failed to initialize USB context: {0}")]
    Context(String),
    #[error("failed to enumerate USB devices: {0}")]
    Enumeration(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EndpointRecord {
    pub configuration: u8,
    pub interface: u8,
    pub alternate_setting: u8,
    pub address: u8,
    pub direction: String,
    pub transfer_type: String,
    pub max_packet_size: u16,
    pub interval: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransportDevice {
    pub device_uid: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub bus_number: u8,
    pub device_address: u8,
    pub manufacturer: Option<String>,
    pub product_name: Option<String>,
    pub serial_number: Option<String>,
    pub mode: String,
    pub endpoints: Vec<EndpointRecord>,
    pub bulk_in: Vec<u8>,
    pub bulk_out: Vec<u8>,
}

fn mode_hint(vendor_id: u16, product_id: u16) -> &'static str {
    match (vendor_id, product_id) {
        (0x04e8, 0x685d | 0x6601) => "samsung-download",
        (0x05c6, 0x9008) => "qualcomm-edl",
        (0x0e8d, 0x0003) => "mediatek-brom",
        (0x0e8d, 0x2000 | 0x2001) => "mediatek-preloader",
        _ => "usb",
    }
}

fn transfer_type_name(kind: TransferType) -> &'static str {
    match kind {
        TransferType::Control => "control",
        TransferType::Isochronous => "isochronous",
        TransferType::Bulk => "bulk",
        TransferType::Interrupt => "interrupt",
    }
}

pub fn scan_transports() -> Result<Vec<TransportDevice>, TransportError> {
    let context = Context::new().map_err(|e| TransportError::Context(e.to_string()))?;
    let devices = context
        .devices()
        .map_err(|e| TransportError::Enumeration(e.to_string()))?;

    let mut out = Vec::new();
    for device in devices.iter() {
        let descriptor = match device.device_descriptor() {
            Ok(v) => v,
            Err(_) => continue,
        };
        let vendor_id = descriptor.vendor_id();
        let product_id = descriptor.product_id();
        let (manufacturer, product_name, serial_number) = match device.open() {
            Ok(handle) => (
                handle
                    .read_manufacturer_string_ascii(&descriptor)
                    .ok()
                    .map(|v| v.trim_matches(char::from(0)).trim().to_string())
                    .filter(|v| !v.is_empty()),
                handle
                    .read_product_string_ascii(&descriptor)
                    .ok()
                    .map(|v| v.trim_matches(char::from(0)).trim().to_string())
                    .filter(|v| !v.is_empty()),
                handle
                    .read_serial_number_string_ascii(&descriptor)
                    .ok()
                    .map(|v| v.trim_matches(char::from(0)).trim().to_string())
                    .filter(|v| !v.is_empty()),
            ),
            Err(_) => (None, None, None),
        };

        let uid = serial_number
            .as_ref()
            .map(|s| format!("usb:{vendor_id:04x}:{product_id:04x}:{s}"))
            .unwrap_or_else(|| {
                format!(
                    "usb:{vendor_id:04x}:{product_id:04x}:bus{}:addr{}",
                    device.bus_number(),
                    device.address()
                )
            });

        let mut endpoints = Vec::new();
        let mut bulk_in = Vec::new();
        let mut bulk_out = Vec::new();
        for config_index in 0..descriptor.num_configurations() {
            let Ok(config) = device.config_descriptor(config_index) else {
                continue;
            };
            for interface in config.interfaces() {
                for iface in interface.descriptors() {
                    for ep in iface.endpoint_descriptors() {
                        let direction = match ep.direction() {
                            Direction::In => "in",
                            Direction::Out => "out",
                        };
                        if ep.transfer_type() == TransferType::Bulk {
                            match ep.direction() {
                                Direction::In => bulk_in.push(ep.address()),
                                Direction::Out => bulk_out.push(ep.address()),
                            }
                        }
                        endpoints.push(EndpointRecord {
                            configuration: config.number(),
                            interface: iface.interface_number(),
                            alternate_setting: iface.setting_number(),
                            address: ep.address(),
                            direction: direction.to_string(),
                            transfer_type: transfer_type_name(ep.transfer_type()).to_string(),
                            max_packet_size: ep.max_packet_size(),
                            interval: ep.interval(),
                        });
                    }
                }
            }
        }
        bulk_in.sort_unstable();
        bulk_in.dedup();
        bulk_out.sort_unstable();
        bulk_out.dedup();

        out.push(TransportDevice {
            device_uid: uid,
            vendor_id,
            product_id,
            bus_number: device.bus_number(),
            device_address: device.address(),
            manufacturer,
            product_name,
            serial_number,
            mode: mode_hint(vendor_id, product_id).to_string(),
            endpoints,
            bulk_in,
            bulk_out,
        });
    }
    Ok(out)
}
