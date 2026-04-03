use pyo3::prelude::*;
use pyo3::exceptions::PyException;

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
        // Mock MTK Handshake Response
        Ok(vec![0x5F, 0x0A, 0x50, 0x05])
    }

    pub fn control_transfer(&self, request_type: u8, request: u8, value: u16, index: u16, data: Vec<u8>) -> PyResult<bool> {
        println!("[RUST] [USB] Control Transfer to {}: Type=0x{:02X}, Req=0x{:02X}, Data={} bytes", 
                 self.device_id, request_type, request, data.len());
        
        // Simulate the BROM crash/timeout behavior for the glitch
        if data.len() > 128 {
             return Err(PyException::new_err("USB Timeout/Pipe Error (Simulated Glitch Success)"));
        }
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

    pub fn poll_active_devices(&self) -> PyResult<Vec<std::collections::HashMap<String, String>>> {
        let mut devices = Vec::new();
        if self.mock_mode {
            let mut dev1 = std::collections::HashMap::new();
            dev1.insert("name".to_string(), "Snapdragon 8 Gen 6 (EDL)".to_string());
            dev1.insert("protocol".to_string(), "Firehose 7.0 (Auth Required)".to_string());
            dev1.insert("serial".to_string(), "05C6:9008".to_string());
            devices.push(dev1);

            let mut dev2 = std::collections::HashMap::new();
            dev2.insert("name".to_string(), "MediaTek Dimensity 9500 (BROM)".to_string());
            dev2.insert("protocol".to_string(), "VCOM V3 (SLA/DAA Locked)".to_string());
            dev2.insert("serial".to_string(), "0E8D:2000".to_string());
            devices.push(dev2);
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
