pub mod model;

use model::DeviceRecord;
use rusb::{Context, UsbContext};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum BootForgeUsbError {
    #[error("failed to initialize USB context: {0}")]
    Context(String),
    #[error("failed to enumerate USB devices: {0}")]
    Enumeration(String),
}

pub type Result<T> = std::result::Result<T, BootForgeUsbError>;

fn platform_hint(vendor_id: u16) -> &'static str {
    match vendor_id {
        0x04e8 => "android-samsung",
        0x0e8d => "android-mediatek",
        0x18d1 => "android-google",
        0x22b8 => "android-motorola",
        0x2717 => "android-xiaomi",
        0x2a70 => "android-oneplus",
        0x05ac => "apple",
        _ => "unknown",
    }
}

fn mode_hint(vendor_id: u16, product_id: u16, class: u8, subclass: u8, protocol: u8) -> &'static str {
    if vendor_id == 0x04e8 && matches!(product_id, 0x6601 | 0x685d) {
        return "samsung-download";
    }
    if vendor_id == 0x0e8d && matches!(product_id, 0x0003 | 0x2000 | 0x2001) {
        return "mediatek-preloader";
    }
    if vendor_id == 0x05ac && product_id == 0x1227 {
        return "apple-dfu";
    }
    if class == 0x06 && subclass == 0x01 && protocol == 0x01 {
        return "ptp";
    }
    "usb"
}

fn read_strings<T: UsbContext>(
    device: &rusb::Device<T>,
) -> (Option<String>, Option<String>, Option<String>) {
    let descriptor = match device.device_descriptor() {
        Ok(d) => d,
        Err(_) => return (None, None, None),
    };
    let handle = match device.open() {
        Ok(h) => h,
        Err(_) => return (None, None, None),
    };
    let manufacturer = handle.read_manufacturer_string_ascii(&descriptor).ok();
    let product = handle.read_product_string_ascii(&descriptor).ok();
    let serial = handle.read_serial_number_string_ascii(&descriptor).ok();
    (manufacturer, product, serial)
}

pub fn scan() -> Result<Vec<DeviceRecord>> {
    let context = Context::new().map_err(|e| BootForgeUsbError::Context(e.to_string()))?;
    let devices = context
        .devices()
        .map_err(|e| BootForgeUsbError::Enumeration(e.to_string()))?;

    let mut records = Vec::new();
    for device in devices.iter() {
        let descriptor = match device.device_descriptor() {
            Ok(d) => d,
            Err(_) => continue,
        };
        let (manufacturer, product_name, serial_number) = read_strings(&device);
        let vendor_id = descriptor.vendor_id();
        let product_id = descriptor.product_id();

        let device_uid = serial_number
            .as_ref()
            .map(|serial| format!("usb:{:04x}:{:04x}:{}", vendor_id, product_id, serial))
            .unwrap_or_else(|| format!(
                "usb:{:04x}:{:04x}:bus{}:addr{}",
                vendor_id,
                product_id,
                device.bus_number(),
                device.address()
            ));

        records.push(DeviceRecord {
            device_uid,
            vendor_id,
            product_id,
            manufacturer,
            product_name,
            serial_number,
            class: descriptor.class_code(),
            subclass: descriptor.sub_class_code(),
            protocol: descriptor.protocol_code(),
            bus_number: device.bus_number(),
            device_address: device.address(),
            platform_hint: platform_hint(vendor_id).to_string(),
            mode: mode_hint(
                vendor_id,
                product_id,
                descriptor.class_code(),
                descriptor.sub_class_code(),
                descriptor.protocol_code(),
            )
            .to_string(),
            transport: "usb".to_string(),
            evidence_source: "rusb-descriptor".to_string(),
        });
    }
    Ok(records)
}

#[cfg(feature = "python")]
mod python_api {
    use super::*;
    use pyo3::{exceptions::PyRuntimeError, prelude::*};
    use std::collections::HashMap;

    #[pyclass]
    pub struct RawUsbController {
        device_id: String,
    }

    #[pymethods]
    impl RawUsbController {
        #[new]
        pub fn new(device_id: String) -> Self {
            Self { device_id }
        }

        pub fn bulk_write(&self, _data: Vec<u8>) -> PyResult<usize> {
            Err(PyRuntimeError::new_err(format!(
                "raw USB write is disabled for {} until endpoint discovery and hardware qualification are implemented",
                self.device_id
            )))
        }

        pub fn bulk_read(&self, _length: usize) -> PyResult<Vec<u8>> {
            Err(PyRuntimeError::new_err(format!(
                "raw USB read is disabled for {} until endpoint discovery and hardware qualification are implemented",
                self.device_id
            )))
        }

        pub fn control_transfer(
            &self,
            _rt: u8,
            _r: u8,
            _v: u16,
            _i: u16,
            _data: Vec<u8>,
        ) -> PyResult<bool> {
            Err(PyRuntimeError::new_err(format!(
                "raw USB control transfers are disabled for {} in BobFWTools",
                self.device_id
            )))
        }
    }

    #[pyclass]
    pub struct UsbMonitor;

    #[pymethods]
    impl UsbMonitor {
        #[new]
        pub fn new(_mock_mode: bool) -> Self {
            Self
        }

        pub fn poll_active_devices(&self) -> PyResult<Vec<HashMap<String, String>>> {
            let records = scan().map_err(|e| PyRuntimeError::new_err(e.to_string()))?;
            Ok(records
                .into_iter()
                .map(|d| {
                    let mut m = HashMap::new();
                    m.insert("name".into(), d.product_name.unwrap_or_else(|| format!("USB {:04X}:{:04X}", d.vendor_id, d.product_id)));
                    m.insert("protocol".into(), d.mode);
                    m.insert("serial".into(), d.serial_number.unwrap_or_else(|| format!("{:04X}:{:04X}", d.vendor_id, d.product_id)));
                    m.insert("category".into(), d.platform_hint);
                    m
                })
                .collect())
        }
    }

    #[pymodule]
    fn bootforge_usb(_py: Python<'_>, m: &Bound<'_, PyModule>) -> PyResult<()> {
        m.add_class::<RawUsbController>()?;
        m.add_class::<UsbMonitor>()?;
        Ok(())
    }
}
