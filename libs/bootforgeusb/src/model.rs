use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceRecord {
    pub vendor_id: u16,
    pub product_id: u16,
    pub manufacturer: Option<String>,
    pub product_name: Option<String>,
    pub serial_number: Option<String>,
    pub class: u8,
    pub subclass: u8,
    pub protocol: u8,
    pub bus_number: u8,
    pub device_address: u8,
    pub platform_hint: String,
    pub mode: String,
    pub transport: String,
    pub evidence_source: String,
}
