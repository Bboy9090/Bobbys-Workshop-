//! Bounded MTP/PTP USB container codec. No destructive device operations.
use std::convert::TryInto;

pub const GET_DEVICE_INFO: u16 = 0x1001;
pub const OPEN_SESSION: u16 = 0x1002;
pub const RESPONSE_OK: u16 = 0x2001;
const MAX_CONTAINER: usize = 1024 * 1024;

#[derive(Debug, PartialEq, Eq)]
pub struct Container {
    pub kind: u16,
    pub code: u16,
    pub transaction: u32,
    pub payload: Vec<u8>,
}

pub fn operation(code: u16, transaction: u32, parameters: &[u32]) -> Result<Vec<u8>, String> {
    if parameters.len() > 5 { return Err("MTP operation has more than five parameters".into()); }
    let mut out = Vec::with_capacity(12 + parameters.len() * 4);
    out.extend_from_slice(&((12 + parameters.len() * 4) as u32).to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&code.to_le_bytes());
    out.extend_from_slice(&transaction.to_le_bytes());
    for parameter in parameters { out.extend_from_slice(&parameter.to_le_bytes()); }
    Ok(out)
}

pub fn parse(bytes: &[u8]) -> Result<Container, String> {
    if bytes.len() < 12 { return Err("truncated MTP header".into()); }
    let length = u32::from_le_bytes(bytes[0..4].try_into().unwrap()) as usize;
    if !(12..=MAX_CONTAINER).contains(&length) { return Err("invalid or oversized MTP container".into()); }
    if length != bytes.len() { return Err("MTP container length mismatch".into()); }
    let kind = u16::from_le_bytes(bytes[4..6].try_into().unwrap());
    if !(1..=4).contains(&kind) { return Err("invalid MTP container type".into()); }
    Ok(Container {
        kind, code: u16::from_le_bytes(bytes[6..8].try_into().unwrap()),
        transaction: u32::from_le_bytes(bytes[8..12].try_into().unwrap()),
        payload: bytes[12..].to_vec(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn get_device_info_request() {
        assert_eq!(operation(GET_DEVICE_INFO, 1, &[]).unwrap(), [12,0,0,0,1,0,1,16,1,0,0,0]);
    }
    #[test]
    fn rejects_malformed_packets() {
        assert!(parse(&[0; 11]).is_err());
        assert!(parse(&[255,255,255,127,2,0,1,16,1,0,0,0]).is_err());
        assert!(parse(&[13,0,0,0,2,0,1,16,1,0,0,0]).is_err());
    }
    #[test]
    fn parses_valid_response() {
        assert_eq!(parse(&[12,0,0,0,3,0,1,32,1,0,0,0]).unwrap().code, RESPONSE_OK);
    }
}
