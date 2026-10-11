use serde::{Deserialize, Serialize};

pub const QUALCOMM_VID: u16 = 0x05c6;
pub const EDL_9008_PID: u16 = 0x9008;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaharaHello {
    pub command: u32,
    pub packet_length: u32,
    pub version: u32,
    pub compatible_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EdlProgrammerQualification {
    pub path: String,
    pub sha256: String,
    pub bytes: u64,
    pub enrolled_as_authorized: bool,
    pub device_family: Option<String>,
    pub notes: Vec<String>,
}

pub fn is_edl_9008(vendor_id: u16, product_id: u16) -> bool {
    vendor_id == QUALCOMM_VID && product_id == EDL_9008_PID
}

pub fn parse_sahara_hello(packet: &[u8]) -> Result<SaharaHello, String> {
    if packet.len() < 16 {
        return Err("Sahara HELLO packet is too short".to_string());
    }
    let command = u32::from_le_bytes(packet[0..4].try_into().unwrap());
    let packet_length = u32::from_le_bytes(packet[4..8].try_into().unwrap());
    let version = u32::from_le_bytes(packet[8..12].try_into().unwrap());
    let compatible_version = u32::from_le_bytes(packet[12..16].try_into().unwrap());
    if command != 0x01 {
        return Err(format!("expected Sahara HELLO command 0x01, got 0x{command:08x}"));
    }
    if packet_length < 16 || packet_length as usize > packet.len() {
        return Err("Sahara HELLO packet length is inconsistent".to_string());
    }
    Ok(SaharaHello { command, packet_length, version, compatible_version })
}

pub fn programmer_upload_permitted(q: &EdlProgrammerQualification) -> Result<(), String> {
    if q.bytes == 0 {
        return Err("programmer file is empty".to_string());
    }
    if q.sha256.len() != 64 || !q.sha256.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("programmer SHA-256 is invalid".to_string());
    }
    if !q.enrolled_as_authorized {
        return Err("programmer is not enrolled as OEM/service-authorized for this repair environment".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_9008() {
        assert!(is_edl_9008(0x05c6, 0x9008));
        assert!(!is_edl_9008(0x05c6, 0x900e));
    }

    #[test]
    fn parses_hello() {
        let mut p = vec![0u8; 48];
        p[0..4].copy_from_slice(&1u32.to_le_bytes());
        p[4..8].copy_from_slice(&48u32.to_le_bytes());
        p[8..12].copy_from_slice(&2u32.to_le_bytes());
        p[12..16].copy_from_slice(&1u32.to_le_bytes());
        let hello = parse_sahara_hello(&p).unwrap();
        assert_eq!(hello.version, 2);
    }

    #[test]
    fn blocks_unenrolled_programmer() {
        let q = EdlProgrammerQualification {
            path: "prog_firehose.elf".into(),
            sha256: "0".repeat(64),
            bytes: 4096,
            enrolled_as_authorized: false,
            device_family: None,
            notes: vec![],
        };
        assert!(programmer_upload_permitted(&q).is_err());
    }
}
