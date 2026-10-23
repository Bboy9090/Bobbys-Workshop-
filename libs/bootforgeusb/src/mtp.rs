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


/// Read exactly one framed container using bounded bulk reads. Never allocate
/// from an untrusted length until the header has been validated.
pub fn read_container<F>(mut read: F) -> Result<Container, String>
where F: FnMut(&mut [u8]) -> Result<usize, String> {
    let mut header = [0u8; 12];
    let mut filled = 0;
    while filled < header.len() {
        let n = read(&mut header[filled..])?;
        if n == 0 || n > header.len() - filled { return Err("short or invalid MTP header read".into()); }
        filled += n;
    }
    let size = u32::from_le_bytes(header[0..4].try_into().unwrap()) as usize;
    if !(12..=MAX_CONTAINER).contains(&size) { return Err("invalid or oversized MTP container".into()); }
    let mut frame = vec![0u8; size];
    frame[..12].copy_from_slice(&header);
    let mut filled = 12;
    while filled < size {
        let n = read(&mut frame[filled..])?;
        if n == 0 || n > size - filled { return Err("short or invalid MTP payload read".into()); }
        filled += n;
    }
    parse(&frame)
}

/// Require GetDeviceInfo data followed by a matching success response.
pub fn validate_device_info(data: &Container, response: &Container, transaction: u32) -> Result<(), String> {
    if data.kind != 2 || data.code != GET_DEVICE_INFO || data.transaction != transaction || data.payload.is_empty() {
        return Err("invalid GetDeviceInfo data container".into());
    }
    if response.kind != 3 || response.code != RESPONSE_OK || response.transaction != transaction {
        return Err("GetDeviceInfo response was not successful".into());
    }
    Ok(())
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
