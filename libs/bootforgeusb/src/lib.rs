pub mod model;
pub mod usb_scan;
pub mod classify;
pub mod tools;

use model::{ConfirmedDeviceRecord, Evidence};
use std::collections::HashMap;

/// Main entry point: Scan USB transports and produce confirmed device records.
/// 
/// Pipeline:
/// 1. Probe USB transports (enumerate all USB devices)
/// 2. Classify candidates (determine platform + mode)
/// 3. Probe tools (collect adb/fastboot/idevice_id evidence)
/// 4. Resolve identities (correlate transports to tool IDs)
/// 5. Assemble confirmed device records
/// 
/// Returns: Vec of confirmed devices with stable identities and confidence scores.
pub fn scan() -> Result<Vec<ConfirmedDeviceRecord>, Box<dyn std::error::Error>> {
    // Stage 1: Probe USB transports
    let usb_transports = usb_scan::probe_usb_transports()?;
    
    // Stage 3: Probe tool evidence (done early for correlation)
    let tool_confirmers = tools::confirmers::ToolConfirmers::new();
    
    let mut results = Vec::new();
    
    // Stages 2, 4, 5: Classify, resolve identity, assemble records
    for transport in &usb_transports {
        // Stage 2: Classify candidate
        // Stage 4: Resolve identity with correlation
        let (classification, matched_tool_ids) = classify::resolve_device_identity_with_correlation(
            transport,
            &usb_transports,
            &tool_confirmers,
        );
        
        // Stage 5: Assemble confirmed device record
        let device_uid = resolve_device_identity(transport, &matched_tool_ids);
        
        let platform_hint = match classification.mode.as_str() {
            s if s.starts_with("ios_") => "ios",
            s if s.starts_with("android_") => "android",
            _ => "unknown",
        };
        
        let mut tool_evidence = HashMap::new();
        tool_evidence.insert("adb".to_string(), tool_confirmers.adb.clone());
        tool_evidence.insert("fastboot".to_string(), tool_confirmers.fastboot.clone());
        tool_evidence.insert("idevice_id".to_string(), tool_confirmers.idevice_id.clone());
        
        let record = ConfirmedDeviceRecord {
            device_uid,
            platform_hint: platform_hint.to_string(),
            mode: classification.mode.as_str().to_string(),
            confidence: classification.confidence,
            evidence: Evidence {
                usb: transport.clone(),
                tools: tool_evidence,
            },
            notes: classification.notes,
            matched_tool_ids,
        };
        
        results.push(record);
    }
    
    Ok(results)
}

/// Resolve stable device identity from transport and tool correlation.
/// 
/// Prefers serial number (most stable), falls back to transport UID.
fn resolve_device_identity(transport: &model::UsbTransportEvidence, matched_tool_ids: &[String]) -> String {
    // Prefer serial number if available (stable across reconnections)
    if let Some(serial) = &transport.serial {
        return serial.clone();
    }
    
    // Prefer matched tool ID if available
    if let Some(tool_id) = matched_tool_ids.first() {
        return tool_id.clone();
    }
    
    // Fallback to transport UID (unstable across reconnections)
    format!(
        "usb:{}:{}:bus{}:addr{}",
        transport.vid, transport.pid, transport.bus, transport.address
    )
}

#[cfg(feature = "python")]
use pyo3::prelude::*;

#[cfg(feature = "python")]
#[pyfunction]
fn scan_py() -> PyResult<Vec<PyObject>> {
    Python::with_gil(|py| {
        let devices = scan().map_err(|e| {
            pyo3::exceptions::PyRuntimeError::new_err(format!("Scan failed: {}", e))
        })?;
        
        let json_devices: Vec<PyObject> = devices
            .iter()
            .map(|d| {
                let json_str = serde_json::to_string(d).unwrap();
                let dict = py.eval(&format!("__import__('json').loads('{}')", 
                    json_str.replace('\'', "\\'")
                ), None, None)?;
                Ok(dict.to_object(py))
            })
            .collect::<PyResult<Vec<_>>>()?;
        
        Ok(json_devices)
    })
}

#[cfg(feature = "python")]
#[pymodule]
fn bootforgeusb(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(scan_py, m)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_scan() {
        let result = scan();
        assert!(result.is_ok(), "Scan should not panic");
        
        if let Ok(devices) = result {
            println!("\n=== BootForgeUSB Scan Results ===");
            println!("Found {} devices\n", devices.len());
            
            for device in devices {
                println!("Device: {}", device.device_uid);
                println!("  Platform: {}", device.platform_hint);
                println!("  Mode: {}", device.mode);
                println!("  Confidence: {:.2}%", device.confidence * 100.0);
                println!("  USB: VID:{} PID:{}", device.evidence.usb.vid, device.evidence.usb.pid);
                if let Some(product) = &device.evidence.usb.product {
                    println!("  Product: {}", product);
                }
                println!("  Notes:");
                for note in &device.notes {
                    println!("    - {}", note);
                }
                println!();
            }
        }
    }
}
