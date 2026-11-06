use crate::transfer_preflight::candidate_bulk_pairs;
use crate::transport::{scan_transports, TransportError};
use rusb::{Context, UsbContext};
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub const QUALCOMM_VID: u16 = 0x05c6;
pub const EDL_9008_PID: u16 = 0x9008;

pub const SAHARA_CMD_HELLO: u32 = 0x01;
pub const SAHARA_CMD_HELLO_RESP: u32 = 0x02;
pub const SAHARA_CMD_READ_DATA: u32 = 0x03;
pub const SAHARA_CMD_END_IMAGE_TX: u32 = 0x04;
pub const SAHARA_CMD_DONE: u32 = 0x05;
pub const SAHARA_CMD_DONE_RESP: u32 = 0x06;
pub const SAHARA_CMD_RESET: u32 = 0x07;
pub const SAHARA_CMD_READ_DATA_64: u32 = 0x12;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaharaHello {
    pub command: u32,
    pub packet_length: u32,
    pub version: u32,
    pub compatible_version: u32,
    pub command_packet_length: u32,
    pub mode: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaharaReadDataRequest {
    pub is_64bit: bool,
    pub image_id: u64,
    pub data_offset: u64,
    pub data_length: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GptPartitionEntry {
    pub name: String,
    pub type_guid: String,
    pub unique_guid: String,
    pub first_lba: u64,
    pub last_lba: u64,
    pub num_sectors: u64,
    pub size_bytes: u64,
    pub attributes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaharaLiveProbeResult {
    pub bus: u8,
    pub address: u8,
    pub interface: u8,
    pub in_endpoint: u8,
    pub out_endpoint: u8,
    pub hello: SaharaHello,
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
    if command != SAHARA_CMD_HELLO {
        return Err(format!("expected Sahara HELLO command 0x01, got 0x{command:08x}"));
    }
    if packet_length < 16 || packet_length as usize > packet.len() {
        return Err("Sahara HELLO packet length is inconsistent".to_string());
    }
    let command_packet_length = if packet.len() >= 20 {
        u32::from_le_bytes(packet[16..20].try_into().unwrap())
    } else {
        0
    };
    let mode = if packet.len() >= 24 {
        u32::from_le_bytes(packet[20..24].try_into().unwrap())
    } else {
        0
    };
    Ok(SaharaHello {
        command,
        packet_length,
        version,
        compatible_version,
        command_packet_length,
        mode,
    })
}

/// Build the 48-byte `SAHARA_CMD_HELLO_RESP` packet in response to a device `SaharaHello`.
pub fn build_sahara_hello_response(hello: &SaharaHello, requested_mode: u32) -> [u8; 48] {
    let mut resp = [0u8; 48];
    resp[0..4].copy_from_slice(&SAHARA_CMD_HELLO_RESP.to_le_bytes());
    resp[4..8].copy_from_slice(&48u32.to_le_bytes());
    resp[8..12].copy_from_slice(&hello.version.to_le_bytes());
    resp[12..16].copy_from_slice(&hello.compatible_version.to_le_bytes());
    resp[16..20].copy_from_slice(&0u32.to_le_bytes()); // status = 0 (SUCCESS)
    resp[20..24].copy_from_slice(&requested_mode.to_le_bytes());
    resp
}

/// Parse either a 32-bit (`0x03`) or 64-bit (`0x12`) Sahara `READ_DATA` request packet.
pub fn parse_sahara_read_data(packet: &[u8]) -> Result<SaharaReadDataRequest, String> {
    if packet.len() < 20 {
        return Err("Sahara READ_DATA packet is too short".to_string());
    }
    let cmd = u32::from_le_bytes(packet[0..4].try_into().unwrap());
    match cmd {
        SAHARA_CMD_READ_DATA => {
            let image_id = u32::from_le_bytes(packet[8..12].try_into().unwrap()) as u64;
            let data_offset = u32::from_le_bytes(packet[12..16].try_into().unwrap()) as u64;
            let data_length = u32::from_le_bytes(packet[16..20].try_into().unwrap()) as u64;
            Ok(SaharaReadDataRequest {
                is_64bit: false,
                image_id,
                data_offset,
                data_length,
            })
        }
        SAHARA_CMD_READ_DATA_64 => {
            if packet.len() < 32 {
                return Err("Sahara READ_DATA_64 packet requires 32 bytes".to_string());
            }
            let image_id = u64::from_le_bytes(packet[8..16].try_into().unwrap());
            let data_offset = u64::from_le_bytes(packet[16..24].try_into().unwrap());
            let data_length = u64::from_le_bytes(packet[24..32].try_into().unwrap());
            Ok(SaharaReadDataRequest {
                is_64bit: true,
                image_id,
                data_offset,
                data_length,
            })
        }
        other => Err(format!("unexpected Sahara command 0x{other:02x} while expecting READ_DATA")),
    }
}

/// Build Firehose `<configure .../>` and `<read .../>` XML packets for reading the Primary GPT.
pub fn build_firehose_gpt_read_xml(memory_name: &str, sector_size: u64, physical_partition: u32) -> Result<(String, String), String> {
    let mem = match memory_name.to_ascii_lowercase().as_str() {
        "ufs" => "ufs",
        "emmc" => "emmc",
        other => return Err(format!("unsupported Firehose storage type '{other}' (expected 'ufs' or 'emmc')")),
    };
    if !matches!(sector_size, 512 | 4096) {
        return Err(format!("unsupported sector size {sector_size} (expected 512 or 4096)"));
    }
    let gpt_sectors = if sector_size == 4096 { 6 } else { 34 };
    let configure_xml = format!(
        "<?xml version=\"1.0\" ?><data><configure MemoryName=\"{mem}\" Verbose=\"0\" AlwaysValidate=\"0\" MaxDigestTableSizeInBytes=\"8192\" MaxPayloadSizeToTargetInBytes=\"1048576\" ZlpAwareHost=\"1\" SkipStorageInit=\"0\" /></data>"
    );
    let read_gpt_xml = format!(
        "<?xml version=\"1.0\" ?><data><read SECTOR_SIZE_IN_BYTES=\"{sector_size}\" num_partition_sectors=\"{gpt_sectors}\" physical_partition_number=\"{physical_partition}\" start_sector=\"0\" /></data>"
    );
    Ok((configure_xml, read_gpt_xml))
}

fn format_guid_le(bytes: &[u8]) -> String {
    if bytes.len() != 16 {
        return "00000000-0000-0000-0000-000000000000".to_string();
    }
    let d1 = u32::from_le_bytes(bytes[0..4].try_into().unwrap());
    let d2 = u16::from_le_bytes(bytes[4..6].try_into().unwrap());
    let d3 = u16::from_le_bytes(bytes[6..8].try_into().unwrap());
    format!(
        "{d1:08x}-{d2:04x}-{d3:04x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
    )
}

/// Parse a raw Primary GPT byte buffer (starting at LBA 0 Protective MBR + LBA 1 `"EFI PART"` header + LBA 2.. entries).
pub fn parse_gpt_entries(raw: &[u8], sector_size: usize) -> Result<Vec<GptPartitionEntry>, String> {
    if !matches!(sector_size, 512 | 4096) {
        return Err(format!("unsupported GPT sector size {sector_size}"));
    }
    if raw.len() < sector_size * 2 {
        return Err("buffer is too small to contain Protective MBR and GPT header".to_string());
    }
    let header = &raw[sector_size..sector_size + 92.min(sector_size)];
    if &header[0..8] != b"EFI PART" {
        return Err("missing 'EFI PART' signature at LBA 1".to_string());
    }
    let entries_start_lba = u64::from_le_bytes(header[72..80].try_into().unwrap()) as usize;
    let num_entries = u32::from_le_bytes(header[80..84].try_into().unwrap()) as usize;
    let entry_size = u32::from_le_bytes(header[84..88].try_into().unwrap()) as usize;

    if entry_size < 128 || entry_size > 512 || num_entries > 256 {
        return Err(format!("invalid GPT entry geometry: count={num_entries}, size={entry_size}"));
    }

    let entries_offset = entries_start_lba
        .checked_mul(sector_size)
        .ok_or_else(|| "GPT entries offset overflow".to_string())?;
    if entries_offset >= raw.len() {
        return Err("buffer does not cover GPT partition entry array".to_string());
    }

    let mut partitions = Vec::new();
    for idx in 0..num_entries {
        let start = entries_offset + idx * entry_size;
        let end = start + entry_size;
        if end > raw.len() {
            break;
        }
        let entry = &raw[start..end];
        // Unused entries have an all-zero Type GUID
        if entry[0..16].iter().all(|&b| b == 0) {
            continue;
        }
        let type_guid = format_guid_le(&entry[0..16]);
        let unique_guid = format_guid_le(&entry[16..32]);
        let first_lba = u64::from_le_bytes(entry[32..40].try_into().unwrap());
        let last_lba = u64::from_le_bytes(entry[40..48].try_into().unwrap());
        if last_lba < first_lba {
            continue;
        }
        let attributes = u64::from_le_bytes(entry[48..56].try_into().unwrap());
        let utf16_units: Vec<u16> = entry[56..128]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .take_while(|&u| u != 0)
            .collect();
        let name = String::from_utf16_lossy(&utf16_units).trim().to_string();
        let num_sectors = (last_lba - first_lba) + 1;
        let size_bytes = num_sectors.saturating_mul(sector_size as u64);

        partitions.push(GptPartitionEntry {
            name,
            type_guid,
            unique_guid,
            first_lba,
            last_lba,
            num_sectors,
            size_bytes,
            attributes,
        });
    }

    Ok(partitions)
}

/// Live `rusb` probe of a connected Qualcomm EDL `05c6:9008` device: opens bulk IN/OUT endpoints and reads `SAHARA_CMD_HELLO`.
pub fn probe_edl_sahara_live(timeout_ms: u64) -> Result<SaharaLiveProbeResult, String> {
    let transports = scan_transports().map_err(|e: TransportError| e.to_string())?;
    let target = transports
        .into_iter()
        .find(|d| is_edl_9008(d.vendor_id, d.product_id))
        .ok_or_else(|| "No Qualcomm EDL (05c6:9008) device detected on the USB bus.".to_string())?;

    let pairs = candidate_bulk_pairs(&target.endpoints);
    let pair = pairs
        .first()
        .ok_or_else(|| "Qualcomm 9008 device found, but no bulk IN/OUT endpoint pair was exposed.".to_string())?;

    let context = Context::new().map_err(|e| format!("Failed to initialize libusb context: {e}"))?;
    let device = context
        .devices()
        .map_err(|e| format!("Failed to enumerate USB bus: {e}"))?
        .iter()
        .find(|d| d.bus_number() == target.bus_number && d.address() == target.device_address)
        .ok_or_else(|| "Qualcomm 9008 target disconnected before open.".to_string())?;

    let handle = device
        .open()
        .map_err(|e| format!("Failed to open Qualcomm 9008 USB handle: {e}"))?;
    handle
        .claim_interface(pair.interface)
        .map_err(|e| format!("Failed to claim Qualcomm 9008 interface {}: {e}", pair.interface))?;

    let mut rx = [0u8; 64];
    let read_res = handle.read_bulk(
        pair.in_address,
        &mut rx,
        Duration::from_millis(timeout_ms.clamp(250, 10_000)),
    );
    let _ = handle.release_interface(pair.interface);

    let n = read_res.map_err(|e| format!("Failed reading Sahara HELLO from endpoint 0x{:02x}: {e}", pair.in_address))?;
    let hello = parse_sahara_hello(&rx[..n])?;

    Ok(SaharaLiveProbeResult {
        bus: target.bus_number,
        address: target.device_address,
        interface: pair.interface,
        in_endpoint: pair.in_address,
        out_endpoint: pair.out_address,
        hello,
    })
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

    #[test]
    fn builds_sahara_hello_response_and_parses_read_data_32_and_64() {
        let mut p = vec![0u8; 48];
        p[0..4].copy_from_slice(&1u32.to_le_bytes());
        p[4..8].copy_from_slice(&48u32.to_le_bytes());
        p[8..12].copy_from_slice(&2u32.to_le_bytes());
        p[12..16].copy_from_slice(&1u32.to_le_bytes());
        let hello = parse_sahara_hello(&p).unwrap();
        let resp = build_sahara_hello_response(&hello, 0);
        assert_eq!(u32::from_le_bytes(resp[0..4].try_into().unwrap()), SAHARA_CMD_HELLO_RESP);
        assert_eq!(u32::from_le_bytes(resp[4..8].try_into().unwrap()), 48);

        let mut rd32 = [0u8; 20];
        rd32[0..4].copy_from_slice(&SAHARA_CMD_READ_DATA.to_le_bytes());
        rd32[8..12].copy_from_slice(&13u32.to_le_bytes());
        rd32[12..16].copy_from_slice(&4096u32.to_le_bytes());
        rd32[16..20].copy_from_slice(&65536u32.to_le_bytes());
        let parsed32 = parse_sahara_read_data(&rd32).unwrap();
        assert!(!parsed32.is_64bit);
        assert_eq!(parsed32.image_id, 13);
        assert_eq!(parsed32.data_offset, 4096);
        assert_eq!(parsed32.data_length, 65536);

        let mut rd64 = [0u8; 32];
        rd64[0..4].copy_from_slice(&SAHARA_CMD_READ_DATA_64.to_le_bytes());
        rd64[8..16].copy_from_slice(&13u64.to_le_bytes());
        rd64[16..24].copy_from_slice(&0x100000u64.to_le_bytes());
        rd64[24..32].copy_from_slice(&0x40000u64.to_le_bytes());
        let parsed64 = parse_sahara_read_data(&rd64).unwrap();
        assert!(parsed64.is_64bit);
        assert_eq!(parsed64.data_offset, 0x100000);
        assert_eq!(parsed64.data_length, 0x40000);
    }

    #[test]
    fn parses_gpt_partition_table_entries_and_builds_firehose_xml() {
        let (cfg_xml, read_xml) = build_firehose_gpt_read_xml("ufs", 4096, 0).unwrap();
        assert!(cfg_xml.contains("MemoryName=\"ufs\""));
        assert!(read_xml.contains("SECTOR_SIZE_IN_BYTES=\"4096\""));

        let sector_size = 512usize;
        let mut raw = vec![0u8; sector_size * 4];
        // LBA 1: GPT Header
        let hdr = &mut raw[sector_size..sector_size * 2];
        hdr[0..8].copy_from_slice(b"EFI PART");
        hdr[72..80].copy_from_slice(&2u64.to_le_bytes()); // entries start at LBA 2
        hdr[80..84].copy_from_slice(&4u32.to_le_bytes()); // 4 entries
        hdr[84..88].copy_from_slice(&128u32.to_le_bytes()); // 128 bytes per entry

        // Entry 0 at LBA 2: "efs" partition from LBA 100 to 199 (100 sectors)
        let entry0 = &mut raw[sector_size * 2..sector_size * 2 + 128];
        entry0[0] = 0xAA; // non-zero type GUID
        entry0[16] = 0xBB; // unique GUID
        entry0[32..40].copy_from_slice(&100u64.to_le_bytes());
        entry0[40..48].copy_from_slice(&199u64.to_le_bytes());
        for (i, ch) in "efs".encode_utf16().enumerate() {
            let off = 56 + i * 2;
            entry0[off..off + 2].copy_from_slice(&ch.to_le_bytes());
        }

        let entries = parse_gpt_entries(&raw, sector_size).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "efs");
        assert_eq!(entries[0].first_lba, 100);
        assert_eq!(entries[0].last_lba, 199);
        assert_eq!(entries[0].num_sectors, 100);
        assert_eq!(entries[0].size_bytes, 51200);
    }
}
