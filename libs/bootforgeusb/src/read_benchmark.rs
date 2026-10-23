//! Explicit opt-in, read-only libusb bulk benchmark for an identified bus/address.
//! Only performs bulk IN transfers. Devices may require a protocol command to produce data.
use crate::mtp;
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
    pub interface: u8,
    pub interface_class: u8,
    pub interface_subclass: u8,
    pub chunk_bytes: usize,
    pub requested_reads: u32,
    pub completed_reads: u32,
    pub completed_bytes: u64,
    pub elapsed_seconds: f64,
    pub bytes_per_second: Option<f64>,
    pub mib_per_second: Option<f64>,
    pub stop_reason: Option<String>,
}

pub fn benchmark_bulk_in(bus: u8, address: u8, interface: Option<u8>, reads: u32, timeout_ms: u64) -> Result<ReadBenchmark, String> {
    if reads == 0 || reads > 4096 || timeout_ms == 0 || timeout_ms > 30_000 {
        return Err("reads must be 1..4096 and timeout-ms 1..30000".into());
    }
    let config = StreamConfig::default().validated().ok_or("invalid stream configuration")?;
    let transport = scan_transports().map_err(|e: TransportError| e.to_string())?
        .into_iter().find(|d| d.bus_number == bus && d.device_address == address)
        .ok_or("target bus/address not found")?;
    let pairs: Vec<_> = candidate_bulk_pairs(&transport.endpoints)
        .into_iter().filter(|pair| interface.is_none_or(|wanted| pair.interface == wanted)).collect();
    if pairs.len() != 1 {
        return Err(format!("expected exactly one matching bulk endpoint pair after interface selection; found {}", pairs.len()));
    }
    let pair = &pairs[0];
    let context = Context::new().map_err(|e| e.to_string())?;
    let device = context.devices().map_err(|e| e.to_string())?.iter()
        .find(|d| d.bus_number() == bus && d.address() == address)
        .ok_or("target disconnected before open")?;
    let descriptor = device.config_descriptor(pair.configuration - 1).map_err(|e| e.to_string())?;
    let interface_descriptor = descriptor.interfaces().flat_map(|iface| iface.descriptors())
        .find(|desc| desc.interface_number() == pair.interface && desc.setting_number() == pair.alternate_setting)
        .ok_or("selected USB interface descriptor missing")?;
    let interface_class = interface_descriptor.class_code();
    let interface_subclass = interface_descriptor.sub_class_code();
    let interface_protocol = interface_descriptor.protocol_code();
    if (interface_class, interface_subclass, interface_protocol) != (0x06, 0x01, 0x01) {
        return Err(format!("interface {} is class {:02x}/{:02x}/{:02x}, not MTP imaging 06/01/01; refusing MTP command", pair.interface, interface_class, interface_subclass, interface_protocol));
    }
    let handle = device.open().map_err(|e| format!("USB open failed: {e}"))?;
    // Driver detachment is opt-in only, and only after descriptor validation.
    // Never change device configuration.
    let active = handle.active_configuration().map_err(|e| e.to_string())?;
    if active != pair.configuration {
        return Err("active configuration differs from inspected endpoint".into());
    }
    // On macOS, auto-detach is not universally supported by libusb. A failure
    // must not trigger manual kext removal or an implicit device reset.
    #[cfg(not(target_os = "macos"))]
    handle.set_auto_detach_kernel_driver(true).map_err(|e| format!("auto-detach unsupported: {e}"))?;
    handle.claim_interface(pair.interface).map_err(|e| format!("claim interface failed (OS driver may own interface): {e}"))?;
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
        bus, address, endpoint: pair.in_address, interface: pair.interface, interface_class, interface_subclass, chunk_bytes: config.chunk_bytes,
        requested_reads: reads, completed_reads, completed_bytes,
        elapsed_seconds: elapsed.as_secs_f64(),
        bytes_per_second: rate,
        mib_per_second: rate.map(|r| r / 1_048_576.0),
        stop_reason,
    })
}

/// Execute a bounded, read-only MTP GetDeviceInfo transaction on an explicitly
/// identified imaging interface. No fallback to CDC or vendor-specific modes.
pub fn mtp_get_device_info(bus: u8, address: u8, interface: u8, timeout_ms: u64) -> Result<usize, String> {
    if !(1..=30000).contains(&timeout_ms) { return Err("timeout-ms must be 1..30000".into()); }
    let transport = scan_transports().map_err(|e| e.to_string())?.into_iter()
        .find(|d| d.bus_number == bus && d.device_address == address)
        .ok_or("target bus/address not found")?;
    let pairs: Vec<_> = candidate_bulk_pairs(&transport.endpoints).into_iter()
        .filter(|p| p.interface == interface && p.alternate_setting == 0).collect();
    if pairs.len() != 1 { return Err("expected exactly one default-alternate bulk endpoint pair".into()); }
    let pair = &pairs[0];
    let context = Context::new().map_err(|e| e.to_string())?;
    let device = context.devices().map_err(|e| e.to_string())?.iter()
        .find(|d| d.bus_number() == bus && d.address() == address)
        .ok_or("target disconnected before open")?;
    let descriptor = device.config_descriptor(pair.configuration - 1).map_err(|e| e.to_string())?;
    let iface = descriptor.interfaces().flat_map(|i| i.descriptors())
        .find(|d| d.interface_number() == interface && d.setting_number() == 0)
        .ok_or("selected interface descriptor missing")?;
    if (iface.class_code(), iface.sub_class_code(), iface.protocol_code()) != (0x06, 0x01, 0x01) {
        return Err(format!("interface {interface} is not MTP imaging 06/01/01; no command sent"));
    }
    let handle = device.open().map_err(|e| format!("USB open failed: {e}"))?;
    if handle.active_configuration().map_err(|e| e.to_string())? != pair.configuration {
        return Err("active USB configuration changed".into());
    }
    handle.claim_interface(interface).map_err(|e| {
        #[cfg(target_os = "macos")]
        { format!("imaging interface claim failed: {e}. macOS may have a matching DriverKit extension (SamsungComposite/SamsungMTP). Check systemextensionsctl list and System Settings > General > Login Items & Extensions > Driver Extensions; disable the third-party Samsung driver through the supported macOS UI only if appropriate, then unplug/replug and rescan. Do not force-unload drivers or disable system security.") }
        #[cfg(not(target_os = "macos"))]
        { format!("imaging interface claim failed: {e}") }
    })?;
    let result = (|| {
        let timeout = Duration::from_millis(timeout_ms);
        let request = mtp::operation(mtp::GET_DEVICE_INFO, 1, &[])?;
        let written = handle.write_bulk(pair.out_address, &request, timeout).map_err(|e| format!("MTP command write failed: {e}"))?;
        if written != request.len() { return Err("partial MTP command write".into()); }
        let mut read = |buf: &mut [u8]| handle.read_bulk(pair.in_address, buf, timeout).map_err(|e| format!("MTP bulk read failed: {e}"));
        let data = mtp::read_container(&mut read)?;
        let response = mtp::read_container(&mut read)?;
        mtp::validate_device_info(&data, &response, 1)?;
        Ok(data.payload.len())
    })();
    handle.release_interface(interface).ok();
    result
}
