use crate::model::{Classification, DeviceMode, UsbTransportEvidence, InterfaceHint};
use crate::tools::confirmers::ToolConfirmers;

/// Stage 2: Classify a candidate USB transport (determine platform + mode).
/// 
/// Analyzes VID/PID patterns and interface hints to determine:
/// - Platform: Android, iOS, or Unknown
/// - Mode: ADB, Fastboot, DFU, Recovery, Normal, etc.
/// - Confidence: 0.0 - 1.0 based on evidence strength
/// 
/// This is USB-only classification (no tool correlation yet).
pub fn classify_candidate_device(transport: &UsbTransportEvidence) -> Classification {
    let vid = transport.vid.as_str();
    let pid = transport.pid.as_str();
    
    if vid == "05ac" {
        return classify_apple_device(pid, transport);
    }
    
    if is_android_vendor(vid) {
        return classify_android_device(pid, transport);
    }
    
    Classification {
        mode: DeviceMode::UnknownUsb,
        confidence: 0.5,
        notes: vec!["USB device detected but not classified as mobile device".to_string()],
    }
}

/// Stage 4: Resolve device identity with tool correlation.
/// 
/// Combines USB classification with tool evidence to:
/// 1. Match USB serial to tool device IDs (direct correlation)
/// 2. Apply single-candidate heuristic (if no serial)
/// 3. Update confidence and classification based on correlation
/// 
/// Returns: (Updated classification, matched tool IDs)
pub fn resolve_device_identity_with_correlation(
    transport: &UsbTransportEvidence,
    all_transports: &[UsbTransportEvidence],
    tools: &ToolConfirmers,
) -> (Classification, Vec<String>) {
    // Start with USB-only classification
    let mut classification = classify_candidate_device(transport);
    let mut matched_tool_ids = Vec::new();
    
    // Step 4a: Direct serial match (highest confidence)
    if let Some(serial) = &transport.serial {
        matched_tool_ids = tools.correlate_device_identity(Some(serial), &mut classification);
    }
    
    // Step 4b: Single-candidate heuristic (if no direct match)
    if matched_tool_ids.is_empty() {
        matched_tool_ids.extend(attempt_single_candidate_identity_resolution(
            transport, all_transports, tools, &mut classification
        ));
    }
    
    (classification, matched_tool_ids)
}

/// Attempt single-candidate identity resolution heuristic.
/// 
/// When exactly one platform candidate and exactly one tool device ID,
/// assume they match (heuristic correlation). Used when USB serial is unavailable.
/// 
/// Heuristic rules:
/// - Android + ADB: Single Android candidate + single ADB device → Match
/// - Android + Fastboot: Single Android candidate + single Fastboot device → Match
/// - iOS + idevice_id: Single Apple candidate + single UDID → Match
fn attempt_single_candidate_identity_resolution(
    transport: &UsbTransportEvidence,
    all_transports: &[UsbTransportEvidence],
    tools: &ToolConfirmers,
    classification: &mut Classification,
) -> Vec<String> {
    let mut matched = Vec::new();
    
    // Android + ADB heuristic
    if is_android_likely(transport) && tools.adb.device_ids.len() == 1 {
        let android_count = all_transports.iter().filter(|d| is_android_likely(d)).count();
        if android_count == 1 {
            classification.confidence = 0.90;
            classification.mode = if tools.adb.raw.to_lowercase().contains("sideload") 
                || tools.adb.raw.to_lowercase().contains("recovery") {
                DeviceMode::AndroidRecoveryAdbConfirmed
            } else {
                DeviceMode::AndroidAdbConfirmed
            };
            classification.notes.push(
                "Correlated: single likely-Android USB device + single adb device id present (heuristic)".to_string()
            );
            matched.push(tools.adb.device_ids[0].clone());
        }
    }
    
    // Android + Fastboot heuristic
    if is_android_likely(transport) && tools.fastboot.device_ids.len() == 1 {
        let android_count = all_transports.iter().filter(|d| is_android_likely(d)).count();
        if android_count == 1 {
            classification.confidence = 0.90;
            classification.mode = DeviceMode::AndroidFastbootConfirmed;
            classification.notes.push(
                "Correlated: single likely-Android USB device + single fastboot device id present (heuristic)".to_string()
            );
            matched.push(tools.fastboot.device_ids[0].clone());
        }
    }
    
    // iOS + idevice_id heuristic
    if is_apple(transport) && tools.idevice_id.device_ids.len() == 1 {
        let apple_count = all_transports.iter().filter(|d| is_apple(d)).count();
        if apple_count == 1 {
            classification.confidence = 0.95;
            classification.mode = DeviceMode::IosNormalLikely;
            classification.notes.push(
                "Correlated: single idevice_id UDID + single Apple USB device present".to_string()
            );
            matched.push(tools.idevice_id.device_ids[0].clone());
        }
    }
    
    matched
}

fn has_vendor_interface(hints: &[InterfaceHint]) -> bool {
    hints.iter().any(|h| h.class == 0xff)
}

fn is_apple(transport: &UsbTransportEvidence) -> bool {
    transport.vid.eq_ignore_ascii_case("05ac")
}

fn is_android_likely(transport: &UsbTransportEvidence) -> bool {
    if is_apple(transport) {
        return false;
    }
    is_android_vendor(&transport.vid) || has_vendor_interface(&transport.interface_hints)
}

fn classify_apple_device(pid: &str, transport: &UsbTransportEvidence) -> Classification {
    let missing_strings = transport.product.is_none() && transport.serial.is_none();
    
    match pid {
        "1227" => Classification {
            mode: DeviceMode::IosDfuLikely,
            confidence: 0.86,
            notes: vec![
                "Apple VID with minimal descriptors + vendor interface pattern suggests DFU-like state".to_string(),
                "USB signature matches Apple DFU mode (VID:05AC PID:1227)".to_string(),
            ],
        },
        "1281" => Classification {
            mode: DeviceMode::IosRecoveryLikely,
            confidence: 0.82,
            notes: vec![
                "Apple VID suggests Recovery/Restore-like state".to_string(),
                "USB signature matches Apple Recovery mode (VID:05AC PID:1281)".to_string(),
            ],
        },
        "12a8" | "12ab" => Classification {
            mode: DeviceMode::IosNormalLikely,
            confidence: 0.75,
            notes: vec![
                format!("USB signature matches iOS device in normal mode (VID:05AC PID:{})", pid),
                "Confirm via system tools or idevice_id".to_string(),
            ],
        },
        _ => {
            if missing_strings && has_vendor_interface(&transport.interface_hints) {
                Classification {
                    mode: DeviceMode::IosDfuLikely,
                    confidence: 0.86,
                    notes: vec![
                        "Apple VID with minimal descriptors + vendor interface suggests DFU-like state".to_string(),
                    ],
                }
            } else if transport.product.as_ref().map(|p| p.contains("iPhone") || p.contains("iPad")).unwrap_or(false) {
                Classification {
                    mode: DeviceMode::IosNormalLikely,
                    confidence: 0.70,
                    notes: vec![
                        format!("Apple device with unknown PID:{} but product string suggests iOS", pid),
                    ],
                }
            } else {
                Classification {
                    mode: DeviceMode::IosRecoveryLikely,
                    confidence: 0.75,
                    notes: vec![
                        format!("Apple device with unrecognized PID:{}", pid),
                        "Confirm via system tools".to_string(),
                    ],
                }
            }
        }
    }
}

fn classify_android_device(_pid: &str, transport: &UsbTransportEvidence) -> Classification {
    if has_vendor_interface(&transport.interface_hints) {
        return Classification {
            mode: DeviceMode::UnknownUsb,
            confidence: 0.70,
            notes: vec![
                "Likely Android-related USB device (vendor interface/VID)".to_string(),
                "Confirm via adb/fastboot".to_string(),
            ],
        };
    }
    
    Classification {
        mode: DeviceMode::UnknownUsb,
        confidence: 0.60,
        notes: vec!["Android vendor ID detected but mode unclear - run adb/fastboot to confirm".to_string()],
    }
}

fn is_android_vendor(vid: &str) -> bool {
    matches!(
        vid,
        "18d1" |  // Google
        "04e8" |  // Samsung
        "2a70" |  // OnePlus
        "2717" |  // Xiaomi
        "0bb4" |  // HTC
        "12d1" |  // Huawei
        "0fce" |  // Sony
        "19d2" |  // ZTE
        "1004" |  // LG
        "0e8d" |  // MediaTek
        "2a45" |  // Meizu
        "1ebf" |  // ASUS
        "0502" |  // Acer
        "1782" |  // Lenovo
        "22b8"    // Motorola
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_apple_dfu() {
        let transport = UsbTransportEvidence {
            vid: "05ac".to_string(),
            pid: "1227".to_string(),
            manufacturer: Some("Apple Inc.".to_string()),
            product: None,
            serial: None,
            bus: 1,
            address: 5,
            interface_class: None,
            interface_hints: vec![],
        };
        
        let classification = classify_candidate_device(&transport);
        assert_eq!(classification.mode.as_str(), "ios_dfu_likely");
        assert!(classification.confidence > 0.8);
    }

    #[test]
    fn test_classify_google_android() {
        let transport = UsbTransportEvidence {
            vid: "18d1".to_string(),
            pid: "4ee7".to_string(),
            manufacturer: Some("Google".to_string()),
            product: Some("Pixel 6".to_string()),
            serial: Some("ABC123".to_string()),
            bus: 1,
            address: 3,
            interface_class: Some(0xff),
            interface_hints: vec![InterfaceHint {
                class: 0xff,
                subclass: 0x42,
                protocol: 0x01,
            }],
        };
        
        let classification = classify_candidate_device(&transport);
        assert!(classification.confidence > 0.6);
    }
    
    #[test]
    fn test_classify_unknown_vid() {
        let transport = UsbTransportEvidence {
            vid: "0000".to_string(),
            pid: "0000".to_string(),
            manufacturer: None,
            product: None,
            serial: None,
            bus: 1,
            address: 1,
            interface_class: None,
            interface_hints: vec![],
        };
        
        let classification = classify_candidate_device(&transport);
        assert_eq!(classification.mode.as_str(), "unknown_usb");
        assert!(classification.confidence >= 0.5 && classification.confidence <= 0.6);
    }
    
    #[test]
    fn test_classify_apple_recovery() {
        let transport = UsbTransportEvidence {
            vid: "05ac".to_string(),
            pid: "1281".to_string(),
            manufacturer: Some("Apple Inc.".to_string()),
            product: None,
            serial: None,
            bus: 1,
            address: 2,
            interface_class: None,
            interface_hints: vec![],
        };
        
        let classification = classify_candidate_device(&transport);
        assert_eq!(classification.mode.as_str(), "ios_recovery_likely");
        assert!(classification.confidence > 0.8);
    }
}
