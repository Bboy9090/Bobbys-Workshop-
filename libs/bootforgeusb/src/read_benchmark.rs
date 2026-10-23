//! Explicit opt-in, read-only libusb bulk benchmark for an identified bus/address.
//! Only performs bulk IN transfers. Devices may require a protocol command to produce data.
use crate::stream_schedule::{completed_bytes_per_second, StreamConfig};
use crate::transfer_preflight::candidate_bulk_pairs;
use crate::transport::{scan_transports, TransportError};
use rusb::{Context, UsbContext};
use serde::Serialize;
use std::time::{Duration, Instant};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadBenchmark {
    pub bus: u8,
    pub address: u8,
    pub endpoint: u8,
    pub chunk_bytes: usize,
    pub requested_reads: u32,
    pub completed_reads: u32,
    pub completed_bytes: u64,
    pub elapsed_seconds: f64,
    pub bytes_per_second: Option<f64>,
    pub mib_per_second: Option<f64>,
    pub stop_reason: Option<String>,
}

pub fn benchmark_bulk_in(bus: u8, address: u8, reads: u32, timeout_ms: u64) -> Result<ReadBenchmark, String> {
    if reads == 0 || reads > 4096 || timeout_ms == 0 || timeout_ms > 30_000 {
        return Err("reads must be 1..4096 and timeout-ms 1..30000".into());
    }
    let config = StreamConfig::default().validated().ok_or("invalid stream configuration")?;
    let transport = scan_transports().map_err(|e: TransportError| e.to_string())?
        .into_iter().find(|d| d.bus_number == bus && d.device_address == address)
        .ok_or("target bus/address not found")?;
    let pairs = candidate_bulk_pairs(&transport.endpoints);
    if pairs.len() != 1 {
        return Err(format!("expected exactly one matching bulk endpoint pair; found {}", pairs.len()));
    }
    let pair = &pairs[0];
    let context = Context::new().map_err(|e| e.to_string())?;
    let device = context.devices().map_err(|e| e.to_string())?.iter()
        .find(|d| d.bus_number() == bus && d.address() == address)
        .ok_or("target disconnected before open")?;
    let handle = device.open().map_err(|e| format!("USB open failed: {e}"))?;
    // Never detach a kernel driver automatically or change device configuration.
    let active = handle.active_configuration().map_err(|e| e.to_string())?;
    if active != pair.configuration {
        return Err("active configuration differs from inspected endpoint".into());
    }
    handle.claim_interface(pair.interface).map_err(|e| format!("claim interface failed: {e}"))?;
    if pair.alternate_setting != 0 {
        handle.release_interface(pair.interface).ok();
        return Err("non-default alternate setting is not benchmarked".into());
    }
    let mut buffer = vec![0u8; config.chunk_bytes];
    let start = Instant::now();
    let mut completed_reads = 0;
    let mut completed_bytes = 0u64;
    let mut stop_reason = None;
    for _ in 0..reads {
        match handle.read_bulk(pair.in_address, &mut buffer, Duration::from_millis(timeout_ms)) {
            Ok(n) if n > 0 => {
                completed_reads += 1;
                completed_bytes += n as u64;
            }
            Ok(_) => { stop_reason = Some("zero-length read".into()); break; }
            Err(e) => { stop_reason = Some(format!("bulk read stopped: {e}")); break; }
        }
    }
    let elapsed = start.elapsed();
    handle.release_interface(pair.interface).ok();
    let rate = completed_bytes_per_second(completed_bytes, elapsed);
    Ok(ReadBenchmark {
        bus, address, endpoint: pair.in_address, chunk_bytes: config.chunk_bytes,
        requested_reads: reads, completed_reads, completed_bytes,
        elapsed_seconds: elapsed.as_secs_f64(),
        bytes_per_second: rate,
        mib_per_second: rate.map(|r| r / 1_048_576.0),
        stop_reason,
    })
}
