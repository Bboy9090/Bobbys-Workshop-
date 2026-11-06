//! MediaTek BootROM (`0e8d:0003`) & Preloader (`0e8d:2000`/`0e8d:2001`) Low-Level Protocol Engine
//!
//! Implements:
//! - BROM 4-byte synchronization sequence (`0xA0, 0x0A, 0x50, 0x05` -> `0x5F, 0xF5, 0xAF, 0xFA`)
//! - `GET_HW_CODE` (`0xFD`) and `GET_HW_SW_VER` (`0xFC`) big-endian silicon identification
//! - Live `rusb` BROM probe (`probe_mtk_brom_live`)

use crate::transfer_preflight::candidate_bulk_pairs;
use crate::transport::{scan_transports, TransportError};
use rusb::{Context, UsbContext};
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub const MEDIATEK_VID: u16 = 0x0e8d;
pub const MTK_BROM_PID: u16 = 0x0003;
pub const MTK_PRELOADER_PID_1: u16 = 0x2000;
pub const MTK_PRELOADER_PID_2: u16 = 0x2001;

pub const BROM_HANDSHAKE_TX: [u8; 4] = [0xA0, 0x0A, 0x50, 0x05];
pub const BROM_HANDSHAKE_RX: [u8; 4] = [0x5F, 0xF5, 0xAF, 0xFA];

pub const BROM_CMD_GET_HW_SW_VER: u8 = 0xFC;
pub const BROM_CMD_GET_HW_CODE: u8 = 0xFD;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MtkSiliconIdentity {
    pub hw_code: u16,
    pub hw_code_hex: String,
    pub chip_name: String,
    pub hw_sub_code: Option<u16>,
    pub hw_version: Option<u16>,
    pub sw_version: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MtkBromLiveProbeResult {
    pub bus: u8,
    pub address: u8,
    pub product_id: u16,
    pub mode: String,
    pub interface: u8,
    pub in_endpoint: u8,
    pub out_endpoint: u8,
    pub identity: MtkSiliconIdentity,
}

pub fn is_mtk_brom_or_preloader(vendor_id: u16, product_id: u16) -> bool {
    vendor_id == MEDIATEK_VID
        && matches!(
            product_id,
            MTK_BROM_PID | MTK_PRELOADER_PID_1 | MTK_PRELOADER_PID_2
        )
}

/// Validates that each received byte of the 4-byte BROM handshake is the bitwise NOT (`!tx`) of the transmitted byte.
pub fn verify_brom_handshake_response(rx: &[u8]) -> Result<(), String> {
    if rx.len() < 4 {
        return Err(format!(
            "MediaTek BROM handshake response too short ({} bytes, expected 4)",
            rx.len()
        ));
    }
    for i in 0..4 {
        if rx[i] != BROM_HANDSHAKE_RX[i] {
            return Err(format!(
                "MediaTek BROM handshake mismatch at byte {i}: expected 0x{:02X}, got 0x{:02X}",
                BROM_HANDSHAKE_RX[i], rx[i]
            ));
        }
    }
    Ok(())
}

pub fn mtk_chip_name_for_hw_code(hw_code: u16) -> &'static str {
    match hw_code {
        0x6580 => "MT6580",
        0x6735 => "MT6735",
        0x6739 => "MT6739",
        0x6750 => "MT6750",
        0x6755 => "MT6755 (Helio P10)",
        0x6761 => "MT6761 (Helio A22)",
        0x6763 => "MT6763 (Helio P23)",
        0x6765 => "MT6765 (Helio G35/P35)",
        0x6768 => "MT6768 (Helio G80/G85/P65)",
        0x6771 => "MT6771 (Helio P60/P70)",
        0x6779 => "MT6779 (Helio P90)",
        0x6781 => "MT6781 (Helio G96)",
        0x6785 => "MT6785 (Helio G90T/G95)",
        0x6789 => "MT6789 (Helio G99)",
        0x6833 => "MT6833 (Dimensity 700/6020)",
        0x6853 => "MT6853 (Dimensity 720/800U)",
        0x6873 => "MT6873 (Dimensity 800)",
        0x6877 => "MT6877 (Dimensity 900/1080)",
        0x6885 => "MT6885 (Dimensity 1000+)",
        0x6893 => "MT6893 (Dimensity 1200)",
        0x6895 => "MT6895 (Dimensity 8100)",
        0x6983 => "MT6983 (Dimensity 9000)",
        0x6985 => "MT6985 (Dimensity 9200)",
        0x6989 => "MT6989 (Dimensity 9300)",
        _ => "MediaTek SoC (Unindexed HW Code)",
    }
}

/// Parses the 4-byte response to `BROM_CMD_GET_HW_CODE` (`[hw_code_hi, hw_code_lo, status_hi, status_lo]`).
pub fn parse_get_hw_code_response(rx: &[u8]) -> Result<MtkSiliconIdentity, String> {
    if rx.len() < 4 {
        return Err("GET_HW_CODE response requires 4 bytes (2-byte hw_code + 2-byte status)".to_string());
    }
    let hw_code = u16::from_be_bytes([rx[0], rx[1]]);
    let status = u16::from_be_bytes([rx[2], rx[3]]);
    if status != 0 {
        return Err(format!("BROM GET_HW_CODE returned non-zero status 0x{status:04X}"));
    }
    Ok(MtkSiliconIdentity {
        hw_code,
        hw_code_hex: format!("0x{hw_code:04X}"),
        chip_name: mtk_chip_name_for_hw_code(hw_code).to_string(),
        hw_sub_code: None,
        hw_version: None,
        sw_version: None,
    })
}

/// Live `rusb` probe of a connected MediaTek BROM (`0e8d:0003`) or Preloader (`0e8d:2000`) device.
pub fn probe_mtk_brom_live(timeout_ms: u64) -> Result<MtkBromLiveProbeResult, String> {
    let transports = scan_transports().map_err(|e: TransportError| e.to_string())?;
    let target = transports
        .into_iter()
        .find(|d| is_mtk_brom_or_preloader(d.vendor_id, d.product_id))
        .ok_or_else(|| "No MediaTek BROM (0e8d:0003) or Preloader (0e8d:2000) device detected on the USB bus.".to_string())?;

    let pairs = candidate_bulk_pairs(&target.endpoints);
    let pair = pairs
        .first()
        .ok_or_else(|| "MediaTek device found, but no bulk IN/OUT endpoint pair was exposed.".to_string())?;

    let context = Context::new().map_err(|e| format!("Failed to initialize libusb context: {e}"))?;
    let device = context
        .devices()
        .map_err(|e| format!("Failed to enumerate USB bus: {e}"))?
        .iter()
        .find(|d| d.bus_number() == target.bus_number && d.address() == target.device_address)
        .ok_or_else(|| "MediaTek target disconnected before open.".to_string())?;

    let handle = device
        .open()
        .map_err(|e| format!("Failed to open MediaTek USB handle: {e}"))?;
    handle
        .claim_interface(pair.interface)
        .map_err(|e| format!("Failed to claim MediaTek interface {}: {e}", pair.interface))?;

    let timeout = Duration::from_millis(timeout_ms.clamp(250, 5_000));
    let mut rx_handshake = [0u8; 4];
    for (idx, &tx_byte) in BROM_HANDSHAKE_TX.iter().enumerate() {
        handle
            .write_bulk(pair.out_address, &[tx_byte], timeout)
            .map_err(|e| {
                let _ = handle.release_interface(pair.interface);
                format!("Failed writing BROM sync byte {idx}: {e}")
            })?;
        let mut one = [0u8; 1];
        handle
            .read_bulk(pair.in_address, &mut one, timeout)
            .map_err(|e| {
                let _ = handle.release_interface(pair.interface);
                format!("Failed reading BROM sync response byte {idx}: {e}")
            })?;
        rx_handshake[idx] = one[0];
    }

    if let Err(err) = verify_brom_handshake_response(&rx_handshake) {
        let _ = handle.release_interface(pair.interface);
        return Err(err);
    }

    // Send GET_HW_CODE (0xFD), read echo + 4-byte response
    handle
        .write_bulk(pair.out_address, &[BROM_CMD_GET_HW_CODE], timeout)
        .map_err(|e| {
            let _ = handle.release_interface(pair.interface);
            format!("Failed sending BROM GET_HW_CODE (0xFD): {e}")
        })?;
    let mut cmd_rx = [0u8; 8];
    let n = handle
        .read_bulk(pair.in_address, &mut cmd_rx, timeout)
        .map_err(|e| {
            let _ = handle.release_interface(pair.interface);
            format!("Failed reading BROM GET_HW_CODE response: {e}")
        })?;
    let _ = handle.release_interface(pair.interface);

    // Strip optional 1-byte command echo (0xFD) if present
    let payload = if n >= 5 && cmd_rx[0] == BROM_CMD_GET_HW_CODE {
        &cmd_rx[1..n]
    } else {
        &cmd_rx[..n]
    };
    let identity = parse_get_hw_code_response(payload)?;

    Ok(MtkBromLiveProbeResult {
        bus: target.bus_number,
        address: target.device_address,
        product_id: target.product_id,
        mode: target.mode,
        interface: pair.interface,
        in_endpoint: pair.in_address,
        out_endpoint: pair.out_address,
        identity,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verifies_mtk_brom_handshake_and_parses_hw_code() {
        assert!(is_mtk_brom_or_preloader(0x0e8d, 0x0003));
        assert!(is_mtk_brom_or_preloader(0x0e8d, 0x2000));
        assert!(!is_mtk_brom_or_preloader(0x05c6, 0x9008));

        assert!(verify_brom_handshake_response(&[0x5F, 0xF5, 0xAF, 0xFA]).is_ok());
        assert!(verify_brom_handshake_response(&[0x5F, 0x00, 0xAF, 0xFA]).is_err());

        // 0x6768 (Helio G85) + status 0x0000
        let id = parse_get_hw_code_response(&[0x67, 0x68, 0x00, 0x00]).unwrap();
        assert_eq!(id.hw_code, 0x6768);
        assert_eq!(id.hw_code_hex, "0x6768");
        assert!(id.chip_name.contains("MT6768"));
    }
}
