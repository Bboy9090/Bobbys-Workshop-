use crate::model::{UsbTransportEvidence, InterfaceHint};
use rusb::{Context, Device, UsbContext};

/// Stage 1: Probe all USB transports (enumerate USB devices).
/// 
/// Enumerates all USB devices on all buses and extracts transport evidence
/// (VID/PID, descriptors, interfaces). This is the first stage of the detection pipeline.
/// 
/// Returns: Vec of USB transport evidence (raw USB layer data).
pub fn probe_usb_transports() -> Result<Vec<UsbTransportEvidence>, Box<dyn std::error::Error>> {
    let context = Context::new()?;
    let devices = context.devices()?;
    
    let mut results = Vec::new();
    
    for device in devices.iter() {
        if let Ok(evidence) = extract_transport_evidence(&device) {
            results.push(evidence);
        }
    }
    
    Ok(results)
}

/// Extract transport evidence from a USB device descriptor.
/// 
/// Reads VID/PID, manufacturer/product/serial strings, and interface descriptors.
/// This is the raw USB layer data before platform classification.
fn extract_transport_evidence<T: UsbContext>(device: &Device<T>) -> Result<UsbTransportEvidence, Box<dyn std::error::Error>> {
    let device_desc = device.device_descriptor()?;
    let bus = device.bus_number();
    let address = device.address();
    
    let vid = format!("{:04x}", device_desc.vendor_id());
    let pid = format!("{:04x}", device_desc.product_id());
    
    let handle = device.open();
    
    let manufacturer = handle.as_ref()
        .ok()
        .and_then(|h| h.read_manufacturer_string_ascii(&device_desc).ok());
    
    let product = handle.as_ref()
        .ok()
        .and_then(|h| h.read_product_string_ascii(&device_desc).ok());
    
    let serial = handle.as_ref()
        .ok()
        .and_then(|h| h.read_serial_number_string_ascii(&device_desc).ok());
    
    let (interface_class, interface_hints) = extract_interface_descriptors(device);
    
    Ok(UsbTransportEvidence {
        vid,
        pid,
        manufacturer,
        product,
        serial,
        bus,
        address,
        interface_class,
        interface_hints,
    })
}

/// Extract interface descriptors (class, subclass, protocol) from USB device.
/// 
/// Used for platform classification hints (e.g., vendor interface 0xff suggests Android).
fn extract_interface_descriptors<T: UsbContext>(device: &Device<T>) -> (Option<u8>, Vec<InterfaceHint>) {
    let mut hints = Vec::new();
    let mut first_class = None;
    
    if let Ok(config_desc) = device.config_descriptor(0) {
        for interface in config_desc.interfaces() {
            for desc in interface.descriptors() {
                if first_class.is_none() {
                    first_class = Some(desc.class_code());
                }
                hints.push(InterfaceHint {
                    class: desc.class_code(),
                    subclass: desc.sub_class_code(),
                    protocol: desc.protocol_code(),
                });
            }
        }
    }
    
    (first_class, hints)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_probe_usb_transports() {
        let result = probe_usb_transports();
        assert!(result.is_ok(), "USB transport probe should not panic");
        
        if let Ok(transports) = result {
            println!("Found {} USB transports", transports.len());
            for transport in transports {
                println!("  VID:PID {}:{} - {:?}", transport.vid, transport.pid, transport.product);
            }
        }
    }
    
    #[test]
    fn test_transport_evidence_structure() {
        // Verify transport evidence contains required fields
        let result = probe_usb_transports();
        if let Ok(transports) = result {
            for transport in transports {
                assert!(!transport.vid.is_empty(), "VID must not be empty");
                assert!(!transport.pid.is_empty(), "PID must not be empty");
                assert!(transport.bus >= 0, "Bus number must be >= 0");
                assert!(transport.address >= 0, "Address must be >= 0");
            }
        }
    }
}
