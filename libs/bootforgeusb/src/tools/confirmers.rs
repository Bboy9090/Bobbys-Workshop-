use crate::model::{Classification, DeviceMode, ToolEvidence};
use std::process::Command;

/// Tool evidence collector - probes adb, fastboot, and idevice_id for device IDs.
/// 
/// Used during identity resolution to correlate USB transports with tool outputs.
pub struct ToolConfirmers {
    pub adb: ToolEvidence,
    pub fastboot: ToolEvidence,
    pub idevice_id: ToolEvidence,
}

impl ToolConfirmers {
    /// Create new tool confirmers by probing all tools.
    /// 
    /// Each tool is checked for availability and executed to collect device IDs.
    pub fn new() -> Self {
        Self {
            adb: probe_adb_tool(),
            fastboot: probe_fastboot_tool(),
            idevice_id: probe_idevice_id_tool(),
        }
    }

    /// Correlate device identity by matching USB serial to tool device IDs.
    /// 
    /// Direct serial match (highest confidence correlation method).
    /// Updates classification confidence and mode if match found.
    /// 
    /// Returns: Vec of matched tool IDs (empty if no match).
    pub fn correlate_device_identity(&self, serial: Option<&str>, classification: &mut Classification) -> Vec<String> {
        let mut matched_ids = Vec::new();
        
        if let Some(serial_num) = serial {
            if self.adb.present && self.adb.device_ids.iter().any(|id| id == serial_num) {
                classification.confidence = (classification.confidence + 0.15).min(0.95);
                classification.notes.push("Correlated: adb device id matches USB serial".to_string());
                matched_ids.push(serial_num.to_string());
                
                if matches!(classification.mode, DeviceMode::UnknownUsb) {
                    classification.mode = DeviceMode::AndroidAdbConfirmed;
                }
            }
            
            if self.fastboot.present && self.fastboot.device_ids.iter().any(|id| id == serial_num) {
                classification.confidence = (classification.confidence + 0.15).min(0.95);
                classification.notes.push("Correlated: fastboot device id matches USB serial".to_string());
                classification.mode = DeviceMode::AndroidFastbootConfirmed;
                matched_ids.push(serial_num.to_string());
            }
            
            if self.idevice_id.present && self.idevice_id.device_ids.iter().any(|id| id == serial_num) {
                classification.confidence = (classification.confidence + 0.15).min(0.95);
                classification.notes.push("Correlated: idevice UDID matches".to_string());
                matched_ids.push(serial_num.to_string());
            }
        }
        
        matched_ids
    }
}

fn parse_adb_ids(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() || line.starts_with("List of devices") {
                return None;
            }
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let state = parts[1];
                if state == "device" || state == "sideload" || state == "recovery" {
                    return Some(parts[0].to_string());
                }
            }
            None
        })
        .collect()
}

fn parse_fastboot_ids(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let parts: Vec<&str> = line.split_whitespace().collect();
            if !parts.is_empty() {
                Some(parts[0].to_string())
            } else {
                None
            }
        })
        .collect()
}

fn parse_idevice_ids(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect()
}

/// Stage 3: Probe ADB tool for device IDs.
/// 
/// Executes `adb devices -l` and parses output for device serials.
/// Used for identity correlation during device detection.
fn probe_adb_tool() -> ToolEvidence {
    if !is_tool_available("adb") {
        return ToolEvidence::missing();
    }
    
    match Command::new("adb").args(["devices", "-l"]).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let device_ids = parse_adb_ids(&stdout);
            let raw = format!("STDOUT:\n{}\nSTDERR:\n{}", 
                stdout.trim(), 
                String::from_utf8_lossy(&output.stderr).trim());
            
            ToolEvidence::confirmed(raw, device_ids)
        }
        Err(e) => ToolEvidence {
            present: true,
            seen: false,
            raw: format!("error: {}", e),
            device_ids: vec![],
        },
    }
}

/// Stage 3: Probe Fastboot tool for device IDs.
/// 
/// Executes `fastboot devices` and parses output for device serials.
/// Used for identity correlation during device detection.
fn probe_fastboot_tool() -> ToolEvidence {
    if !is_tool_available("fastboot") {
        return ToolEvidence::missing();
    }
    
    match Command::new("fastboot").arg("devices").output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let device_ids = parse_fastboot_ids(&stdout);
            let raw = format!("STDOUT:\n{}\nSTDERR:\n{}", 
                stdout.trim(), 
                String::from_utf8_lossy(&output.stderr).trim());
            
            ToolEvidence::confirmed(raw, device_ids)
        }
        Err(e) => ToolEvidence {
            present: true,
            seen: false,
            raw: format!("error: {}", e),
            device_ids: vec![],
        },
    }
}

/// Stage 3: Probe idevice_id tool for UDIDs.
/// 
/// Executes `idevice_id -l` and parses output for iOS device UDIDs.
/// Used for identity correlation during device detection.
fn probe_idevice_id_tool() -> ToolEvidence {
    if !is_tool_available("idevice_id") {
        return ToolEvidence::missing();
    }
    
    match Command::new("idevice_id").arg("-l").output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let device_ids = parse_idevice_ids(&stdout);
            let raw = format!("STDOUT:\n{}\nSTDERR:\n{}", 
                stdout.trim(), 
                String::from_utf8_lossy(&output.stderr).trim());
            
            ToolEvidence::confirmed(raw, device_ids)
        }
        Err(e) => ToolEvidence {
            present: true,
            seen: false,
            raw: format!("error: {}", e),
            device_ids: vec![],
        },
    }
}

fn is_tool_available(tool: &str) -> bool {
    #[cfg(target_os = "windows")]
    let which_cmd = "where";
    
    #[cfg(not(target_os = "windows"))]
    let which_cmd = "which";
    
    Command::new(which_cmd)
        .arg(tool)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_availability() {
        let confirmers = ToolConfirmers::new();
        
        println!("ADB present: {}", confirmers.adb.present);
        println!("Fastboot present: {}", confirmers.fastboot.present);
        println!("idevice_id present: {}", confirmers.idevice_id.present);
    }
    
    #[test]
    fn test_parse_adb_ids() {
        let output = "List of devices attached\nABC123\tdevice\nDEF456\tdevice\n";
        let ids = parse_adb_ids(output);
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"ABC123".to_string()));
        assert!(ids.contains(&"DEF456".to_string()));
    }
    
    #[test]
    fn test_parse_adb_ids_with_recovery() {
        let output = "List of devices attached\nABC123\trecovery\n";
        let ids = parse_adb_ids(output);
        assert_eq!(ids.len(), 1);
        assert!(ids.contains(&"ABC123".to_string()));
    }
    
    #[test]
    fn test_parse_fastboot_ids() {
        let output = "ABC123 fastboot\nDEF456 fastboot\n";
        let ids = parse_fastboot_ids(output);
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"ABC123".to_string()));
        assert!(ids.contains(&"DEF456".to_string()));
    }
    
    #[test]
    fn test_parse_idevice_ids() {
        let output = "00008030-001A3D2A1E38001E\n00008030-001A3D2A1E38001F\n";
        let ids = parse_idevice_ids(output);
        assert_eq!(ids.len(), 2);
        assert!(ids[0].starts_with("00008030"));
    }
    
    #[test]
    fn test_correlate_device_identity_no_match() {
        let mut confirmers = ToolConfirmers::new();
        confirmers.adb.device_ids = vec!["XYZ789".to_string()];
        confirmers.adb.present = true;
        confirmers.adb.seen = true;
        
        let mut classification = crate::model::Classification {
            mode: crate::model::DeviceMode::UnknownUsb,
            confidence: 0.5,
            notes: vec![],
        };
        
        let matched = confirmers.correlate_device_identity(Some("ABC123"), &mut classification);
        assert!(matched.is_empty());
        assert_eq!(classification.confidence, 0.5); // Unchanged
    }
    
    #[test]
    fn test_correlate_device_identity_adb_match() {
        let mut confirmers = ToolConfirmers::new();
        confirmers.adb.device_ids = vec!["ABC123".to_string()];
        confirmers.adb.present = true;
        confirmers.adb.seen = true;
        
        let mut classification = crate::model::Classification {
            mode: crate::model::DeviceMode::UnknownUsb,
            confidence: 0.7,
            notes: vec![],
        };
        
        let matched = confirmers.correlate_device_identity(Some("ABC123"), &mut classification);
        assert_eq!(matched.len(), 1);
        assert!(matched.contains(&"ABC123".to_string()));
        assert!(classification.confidence > 0.7); // Increased
        assert_eq!(classification.mode.as_str(), "android_adb_confirmed");
    }
}
