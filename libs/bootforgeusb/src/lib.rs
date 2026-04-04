use pyo3::prelude::*;
use std::collections::HashMap;

#[pyclass]
pub struct RawUsbController {
    device_id: String,
}

#[pymethods]
impl RawUsbController {
    #[new]
    pub fn new(device_id: String) -> Self {
        RawUsbController { device_id }
    }

    pub fn bulk_write(&self, data: Vec<u8>) -> PyResult<usize> {
        println!("[RUST] [USB] Bulk Write to {}: {} bytes", self.device_id, data.len());
        Ok(data.len())
    }

    pub fn bulk_read(&self, length: usize) -> PyResult<Vec<u8>> {
        println!("[RUST] [USB] Bulk Read from {}: {} bytes requested", self.device_id, length);
        // Mock response for protocol handshakes
        Ok(vec![0x00; length]) 
    }

    /// Low-level JTAG/SPI/UART bridge via FT232H/CH341
    pub fn raw_protocol_write(&self, protocol: String, address: u32, data: Vec<u8>) -> PyResult<bool> {
        println!("[RUST] [BRIDGE] Writing via {}: Addr 0x{:08X}, Data {} bytes", protocol, address, data.len());
        Ok(true)
    }
}

#[pyclass]
pub struct UsbMonitor {
    mock_mode: bool,
}

#[pymethods]
impl UsbMonitor {
    #[new]
    pub fn new(mock_mode: bool) -> Self {
        UsbMonitor { mock_mode }
    }

    pub fn poll_active_devices(&self) -> PyResult<Vec<HashMap<String, String>>> {
        let mut devices = Vec::new();
        if self.mock_mode {
            // --- Mobile ---
            let mut dev1 = HashMap::new();
            dev1.insert("name".to_string(), "iPhone X (A11)".to_string());
            dev1.insert("protocol".to_string(), "Apple DFU (Checkm8)".to_string());
            dev1.insert("serial".to_string(), "05AC:1227".to_string());
            dev1.insert("category".to_string(), "Mobile".to_string());
            devices.push(dev1);

            // --- Gaming ---
            let mut dev2 = HashMap::new();
            dev2.insert("name".to_string(), "Nintendo Switch (V1)".to_string());
            dev2.insert("protocol".to_string(), "Tegra RCM (Payload)".to_string());
            dev2.insert("serial".to_string(), "0955:7321".to_string());
            dev2.insert("category".to_string(), "Gaming".to_string());
            devices.push(dev2);

            // --- IoT/Embedded ---
            let mut dev3 = HashMap::new();
            dev3.insert("name".to_string(), "DJI Mavic 3 (Mainboard)".to_string());
            dev3.insert("protocol".to_string(), "UART/JTAG Bridge (FT232H)".to_string());
            dev3.insert("serial".to_string(), "0403:6014".to_string());
            dev3.insert("category".to_string(), "IoT/Embedded".to_string());
            devices.push(dev3);
            
            // --- Wearables ---
            let mut dev4 = HashMap::new();
            dev4.insert("name".to_string(), "Apple Watch S9 (iBus)".to_string());
            dev4.insert("protocol".to_string(), "AWRT Diagnostic Port".to_string());
            dev4.insert("serial".to_string(), "05AC:1281".to_string()); // Mock iBus ID
            dev4.insert("category".to_string(), "Wearable".to_string());
            devices.push(dev4);
        }
        Ok(devices)
    }
}

#[pymodule]
fn bootforge_usb(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_class::<RawUsbController>()?;
    m.add_class::<UsbMonitor>()?;
    Ok(())
}
