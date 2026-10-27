use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::process::{Command, Output};
use std::sync::{Arc, Mutex, OnceLock};
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::{Mutex as AsyncMutex, Notify};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbDeviceRecord {
    pub serial: String,
    pub state: String,
    pub details: Vec<String>,
    pub authorized: bool,
    pub evidence_source: &'static str,
}

const ADB_SCAN_CACHE_TTL: Duration = Duration::from_millis(600);

#[derive(Debug, Clone)]
struct AdbScanCacheEntry {
    observed_at: Instant,
    devices: Vec<AdbDeviceRecord>,
}

static ADB_SCAN_CACHE: OnceLock<Mutex<Option<AdbScanCacheEntry>>> = OnceLock::new();
static ADB_OBSERVATION_GENERATION: AtomicU64 = AtomicU64::new(0);

#[derive(Debug)]
struct AdbObservationState {
    running: bool,
    result_generation: u64,
    completed_at: Option<Instant>,
    result: Option<Result<Vec<AdbDeviceRecord>, String>>,
    notify: Arc<Notify>,
}

impl Default for AdbObservationState {
    fn default() -> Self {
        Self {
            running: false,
            result_generation: 0,
            completed_at: None,
            result: None,
            notify: Arc::new(Notify::new()),
        }
    }
}

struct AdbObservationCoordinator {
    state: AsyncMutex<AdbObservationState>,
}

static ADB_OBSERVATION_COORDINATOR: OnceLock<AdbObservationCoordinator> = OnceLock::new();

fn adb_observation_coordinator() -> &'static AdbObservationCoordinator {
    ADB_OBSERVATION_COORDINATOR.get_or_init(|| AdbObservationCoordinator {
        state: AsyncMutex::new(AdbObservationState::default()),
    })
}

fn current_observation_generation() -> u64 {
    ADB_OBSERVATION_GENERATION.load(Ordering::SeqCst)
}

fn bump_observation_generation() {
    ADB_OBSERVATION_GENERATION.fetch_add(1, Ordering::SeqCst);
}

fn adb_scan_cache() -> &'static Mutex<Option<AdbScanCacheEntry>> {
    ADB_SCAN_CACHE.get_or_init(|| Mutex::new(None))
}

fn cache_is_fresh(observed_at: Instant, now: Instant) -> bool {
    now.saturating_duration_since(observed_at) <= ADB_SCAN_CACHE_TTL
}

fn invalidate_adb_scan_cache() {
    if let Ok(mut cache) = adb_scan_cache().lock() {
        *cache = None;
    }
    bump_observation_generation();
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbDeviceInfo {
    pub serial: String,
    pub properties: BTreeMap<String, String>,
    pub verified: bool,
    pub evidence_source: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SamsungAdbIdentityReceipt {
    pub adb_transport_serial: String,
    pub device_serial: Option<String>,
    pub observed_unix_ms: u64,
    pub manufacturer: Option<String>,
    pub brand: Option<String>,
    pub model: Option<String>,
    pub device: Option<String>,
    pub bootloader: Option<String>,
    pub exact_model_verified: bool,
    pub cross_mode_identity_verified: bool,
    pub report_fingerprint: String,
    pub evidence_source: &'static str,
}

fn observed_unix_ms() -> Result<u64, String> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("System clock error before Samsung identity capture: {e}"))?
        .as_millis()
        .min(u128::from(u64::MAX)) as u64)
}

#[allow(clippy::too_many_arguments)]
fn samsung_identity_fingerprint(
    adb_transport_serial: &str,
    device_serial: Option<&str>,
    observed_unix_ms: u64,
    manufacturer: Option<&str>,
    brand: Option<&str>,
    model: Option<&str>,
    device: Option<&str>,
    bootloader: Option<&str>,
    exact_model_verified: bool,
) -> Result<String, String> {
    let material = serde_json::json!({
        "schema": "bobfwtools.samsung.adb-identity.v1",
        "adbTransportSerial": adb_transport_serial,
        "deviceSerial": device_serial,
        "observedUnixMs": observed_unix_ms,
        "manufacturer": manufacturer,
        "brand": brand,
        "model": model,
        "device": device,
        "bootloader": bootloader,
        "exactModelVerified": exact_model_verified,
        "crossModeIdentityVerified": false,
    });
    let bytes = serde_json::to_vec(&material)
        .map_err(|e| format!("Could not canonicalize Samsung ADB identity evidence: {e}"))?;
    Ok(format!("{:x}", Sha256::digest(&bytes)))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbTextResult {
    pub serial: String,
    pub workflow: &'static str,
    pub output: String,
    pub verified: bool,
    pub evidence_source: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbPackageRecord {
    pub package_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbModeCapabilities {
    pub serial: String,
    pub manufacturer: String,
    pub model: String,
    pub normal: bool,
    pub recovery: bool,
    pub bootloader: bool,
    pub download: bool,
    pub qualcomm_edl: bool,
    pub mediatek_brom: bool,
    pub notes: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbActionResult {
    pub serial: String,
    pub workflow: &'static str,
    pub accepted: bool,
    pub verified: bool,
    pub message: String,
    pub evidence_source: &'static str,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TargetActionToken {
    SamsungInternet,
    #[serde(rename = "youtube")]
    YouTube,
    GoogleMaps,
    GalaxyStore,
}

impl TargetActionToken {
    fn workflow(self) -> &'static str {
        match self {
            Self::SamsungInternet => "launch-samsung-internet",
            Self::YouTube => "launch-youtube",
            Self::GoogleMaps => "launch-google-maps",
            Self::GalaxyStore => "launch-galaxy-store",
        }
    }

    fn intent_args(self) -> &'static [&'static str] {
        match self {
            Self::SamsungInternet => &[
                "shell",
                "am",
                "start",
                "-a",
                "android.intent.action.VIEW",
                "-d",
                "https://www.google.com",
                "-p",
                "com.sec.android.app.sbrowser",
            ],
            Self::YouTube => &[
                "shell",
                "am",
                "start",
                "-a",
                "android.intent.action.VIEW",
                "-d",
                "https://www.youtube.com",
            ],
            Self::GoogleMaps => &[
                "shell",
                "am",
                "start",
                "-a",
                "android.intent.action.VIEW",
                "-d",
                "geo:0,0?q=Samsung+Support",
                "-p",
                "com.google.android.apps.maps",
            ],
            Self::GalaxyStore => &[
                "shell",
                "am",
                "start",
                "-a",
                "android.intent.action.VIEW",
                "-d",
                "samsungapps://MainPage",
                "-p",
                "com.sec.android.app.samsungapps",
            ],
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdbFileResult {
    pub serial: String,
    pub workflow: &'static str,
    pub destination: String,
    pub bytes: u64,
    pub verified: bool,
    pub evidence_source: &'static str,
}

fn run_adb(args: &[&str]) -> Result<Output, String> {
    crate::adb_command::new_adb_command()
        .args(args)
        .output()
        .map_err(|e| format!("Failed to launch adb: {e}"))
}

fn require_success(output: Output, action: &str) -> Result<Output, String> {
    if output.status.success() {
        Ok(output)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Err(format!(
            "{action} failed: {}",
            if !stderr.is_empty() { stderr } else { stdout }
        ))
    }
}

fn parse_adb_devices(stdout: &str) -> Vec<AdbDeviceRecord> {
    let mut devices = Vec::new();

    for line in stdout.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }

        let serial = parts[0].to_string();
        let state = parts[1].to_string();
        devices.push(AdbDeviceRecord {
            serial,
            authorized: state == "device",
            state,
            details: parts.iter().skip(2).map(|s| (*s).to_string()).collect(),
            evidence_source: "adb:devices-l",
        });
    }

    devices
}

fn fresh_adb_scan() -> Result<Vec<AdbDeviceRecord>, String> {
    let output = require_success(run_adb(&["devices", "-l"])?, "adb devices")?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_adb_devices(&stdout))
}

fn cached_adb_scan() -> Result<Vec<AdbDeviceRecord>, String> {
    let now = Instant::now();

    if let Ok(cache) = adb_scan_cache().lock() {
        if let Some(entry) = cache.as_ref() {
            if cache_is_fresh(entry.observed_at, now) {
                return Ok(entry.devices.clone());
            }
        }
    }

    let devices = fresh_adb_scan()?;
    if let Ok(mut cache) = adb_scan_cache().lock() {
        *cache = Some(AdbScanCacheEntry {
            observed_at: now,
            devices: devices.clone(),
        });
    }
    Ok(devices)
}

fn device_state(serial: &str) -> Result<String, String> {
    fresh_adb_scan()?
        .into_iter()
        .find(|device| device.serial == serial)
        .map(|device| device.state)
        .ok_or_else(|| format!("ADB device {serial} is not currently connected"))
}

fn valid_adb_serial(serial: &str) -> bool {
    !serial.trim().is_empty()
        && serial
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':'))
}

fn require_authorized(serial: &str) -> Result<(), String> {
    let state = device_state(serial)?;
    if state != "device" {
        return Err(format!(
            "ADB device {serial} is not authorized for workflows (state: {state})"
        ));
    }
    Ok(())
}

fn parse_getprop_snapshot(stdout: &str) -> BTreeMap<String, String> {
    let mut properties = BTreeMap::new();

    for line in stdout.lines() {
        let Some((raw_key, raw_value)) = line.split_once("]: [") else {
            continue;
        };
        let key = raw_key.trim().trim_start_matches('[').trim();
        let value = raw_value.trim().trim_end_matches(']').trim();
        if !key.is_empty() && !value.is_empty() {
            properties.insert(key.to_string(), value.to_string());
        }
    }

    properties
}

fn get_all_properties(serial: &str) -> Result<BTreeMap<String, String>, String> {
    let output = require_success(
        run_adb(&["-s", serial, "shell", "getprop"])?,
        "adb getprop snapshot",
    )?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_getprop_snapshot(&stdout))
}

fn get_property_from_snapshot(
    properties: &BTreeMap<String, String>,
    key: &str,
) -> Option<String> {
    properties.get(key).cloned().filter(|value| !value.is_empty())
}

fn get_property(serial: &str, key: &str) -> Result<String, String> {
    let output = require_success(
        run_adb(&["-s", serial, "shell", "getprop", key])?,
        &format!("getprop {key}"),
    )?;
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

async fn coalesced_adb_scan() -> Result<Vec<AdbDeviceRecord>, String> {
    let coordinator = adb_observation_coordinator();

    loop {
        let generation = current_observation_generation();
        let mut state = coordinator.state.lock().await;

        if state.result_generation == generation {
            if let (Some(completed_at), Some(result)) = (state.completed_at, state.result.as_ref()) {
                if cache_is_fresh(completed_at, Instant::now()) {
                    return result.clone();
                }
            }
        }

        if state.running {
            let notify = state.notify.clone();
            let notified = notify.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();
            drop(state);
            notified.await;
            continue;
        }

        state.running = true;
        state.result = None;
        state.completed_at = None;
        drop(state);

        let producer_generation = generation;

        let result = match crate::observation_scheduler::acquire_observation_permit().await {
            Ok(permit) => {
                let worker_result = tauri::async_runtime::spawn_blocking(cached_adb_scan)
                    .await
                    .map_err(|e| format!("ADB observation worker failed: {e}"));
                drop(permit);
                match worker_result {
                    Ok(result) => result,
                    Err(error) => Err(error),
                }
            }
            Err(error) => Err(error),
        };

        let mut state = coordinator.state.lock().await;
        state.running = false;

        if current_observation_generation() == producer_generation {
            state.result_generation = producer_generation;
            state.completed_at = Some(Instant::now());
            state.result = Some(result.clone());
        } else {
            state.completed_at = None;
            state.result = None;
        }

        state.notify.notify_waiters();
        drop(state);

        if current_observation_generation() != producer_generation {
            continue;
        }

        return result;
    }
}

pub(crate) fn adb_scan_observed_sync() -> Result<Vec<AdbDeviceRecord>, String> {
    cached_adb_scan()
}

pub(crate) fn adb_scan_fresh_sync() -> Result<Vec<AdbDeviceRecord>, String> {
    fresh_adb_scan()
}

#[tauri::command]
pub async fn adb_scan() -> Result<Vec<AdbDeviceRecord>, String> {
    coalesced_adb_scan().await
}

#[tauri::command]
pub fn adb_device_info(serial: String) -> Result<AdbDeviceInfo, String> {
    require_authorized(&serial)?;

    let keys = [
        "ro.product.manufacturer",
        "ro.product.brand",
        "ro.product.model",
        "ro.product.device",
        "ro.build.version.release",
        "ro.build.version.sdk",
        "ro.build.id",
        "ro.build.version.security_patch",
        "ro.bootloader",
        "ro.boot.verifiedbootstate",
    ];

    let snapshot = get_all_properties(&serial)?;
    let mut properties = BTreeMap::new();
    for key in keys {
        if let Some(value) = get_property_from_snapshot(&snapshot, key) {
            properties.insert(key.to_string(), value);
        }
    }

    if properties.is_empty() {
        return Err("ADB device info returned no verified properties".to_string());
    }

    Ok(AdbDeviceInfo {
        serial,
        properties,
        verified: true,
        evidence_source: "adb:shell-getprop",
    })
}

#[tauri::command]
pub fn samsung_adb_identity_receipt(serial: String) -> Result<SamsungAdbIdentityReceipt, String> {
    require_authorized(&serial)?;

    let observed_unix_ms = observed_unix_ms()?;
    let properties = get_all_properties(&serial)?;
    let manufacturer = get_property_from_snapshot(&properties, "ro.product.manufacturer");
    let brand = get_property_from_snapshot(&properties, "ro.product.brand");
    let model = get_property_from_snapshot(&properties, "ro.product.model");
    let device = get_property_from_snapshot(&properties, "ro.product.device");
    let bootloader = get_property_from_snapshot(&properties, "ro.bootloader");
    let device_serial = get_property_from_snapshot(&properties, "ro.serialno");

    let samsung_claim = manufacturer
        .as_deref()
        .into_iter()
        .chain(brand.as_deref())
        .any(|value| value.eq_ignore_ascii_case("samsung"));
    if !samsung_claim {
        return Err("Authorized ADB target is not independently identified as Samsung.".to_string());
    }

    let exact_model_verified = model.as_deref().is_some_and(|value| !value.trim().is_empty())
        && device.as_deref().is_some_and(|value| !value.trim().is_empty());

    let report_fingerprint = samsung_identity_fingerprint(
        &serial,
        device_serial.as_deref(),
        observed_unix_ms,
        manufacturer.as_deref(),
        brand.as_deref(),
        model.as_deref(),
        device.as_deref(),
        bootloader.as_deref(),
        exact_model_verified,
    )?;

    Ok(SamsungAdbIdentityReceipt {
        adb_transport_serial: serial,
        device_serial,
        observed_unix_ms,
        manufacturer,
        brand,
        model,
        device,
        bootloader,
        exact_model_verified,
        cross_mode_identity_verified: false,
        report_fingerprint,
        evidence_source: "adb:shell-getprop+samsung-identity-v1",
    })
}

#[tauri::command]
pub fn adb_logcat_snapshot(serial: String, lines: Option<u32>) -> Result<AdbTextResult, String> {
    require_authorized(&serial)?;
    let limit = lines.unwrap_or(250).clamp(25, 2000).to_string();
    let output = require_success(
        run_adb(&["-s", &serial, "logcat", "-d", "-t", &limit])?,
        "adb logcat snapshot",
    )?;

    let text = String::from_utf8_lossy(&output.stdout).to_string();
    if text.trim().is_empty() {
        return Err("ADB logcat completed but returned no log lines".to_string());
    }

    Ok(AdbTextResult {
        serial,
        workflow: "logcat-snapshot",
        output: text,
        verified: true,
        evidence_source: "adb:logcat-dump",
    })
}

#[tauri::command]
pub fn adb_screenshot(serial: String, destination_path: String) -> Result<AdbFileResult, String> {
    require_authorized(&serial)?;
    let output = require_success(
        run_adb(&["-s", &serial, "exec-out", "screencap", "-p"])?,
        "adb screenshot",
    )?;

    const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
    if output.stdout.len() < PNG_SIGNATURE.len() || &output.stdout[..8] != PNG_SIGNATURE {
        return Err("ADB screenshot did not return a valid PNG payload".to_string());
    }

    let destination = PathBuf::from(&destination_path);
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create screenshot destination directory: {e}"))?;
    }
    std::fs::write(&destination, &output.stdout)
        .map_err(|e| format!("Failed to write screenshot: {e}"))?;

    let written = std::fs::metadata(&destination)
        .map_err(|e| format!("Failed to verify screenshot: {e}"))?
        .len();

    if written != output.stdout.len() as u64 {
        return Err(format!(
            "Screenshot verification failed: expected {} bytes, found {}",
            output.stdout.len(),
            written
        ));
    }

    Ok(AdbFileResult {
        serial,
        workflow: "screenshot",
        destination: destination.to_string_lossy().to_string(),
        bytes: written,
        verified: true,
        evidence_source: "adb:exec-out-screencap+png-signature+local-size",
    })
}


#[tauri::command]
pub async fn adb_prepare() -> Result<Vec<AdbDeviceRecord>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        require_success(run_adb(&["start-server"])?, "adb start-server")?;
        invalidate_adb_scan_cache();
        fresh_adb_scan()
    })
    .await
    .map_err(|e| format!("ADB prepare worker failed: {e}"))?
}

#[tauri::command]
pub fn adb_battery_info(serial: String) -> Result<AdbTextResult, String> {
    require_authorized(&serial)?;
    let output = require_success(
        run_adb(&["-s", &serial, "shell", "dumpsys", "battery"])?,
        "adb battery info",
    )?;
    let text = String::from_utf8_lossy(&output.stdout).to_string();
    if text.trim().is_empty() {
        return Err("ADB battery info returned no data".to_string());
    }
    Ok(AdbTextResult {
        serial,
        workflow: "battery-info",
        output: text,
        verified: true,
        evidence_source: "adb:dumpsys-battery",
    })
}

#[tauri::command]
pub fn adb_mode_capabilities(serial: String) -> Result<AdbModeCapabilities, String> {
    require_authorized(&serial)?;
    let properties = get_all_properties(&serial)?;
    let manufacturer = get_property_from_snapshot(&properties, "ro.product.manufacturer").unwrap_or_default();
    let brand = get_property_from_snapshot(&properties, "ro.product.brand").unwrap_or_default();
    let model = get_property_from_snapshot(&properties, "ro.product.model").unwrap_or_default();
    let hardware = get_property_from_snapshot(&properties, "ro.hardware").unwrap_or_default();

    let identity = format!("{manufacturer} {brand} {model} {hardware}").to_ascii_lowercase();
    let is_samsung = identity.contains("samsung");
    let is_qualcomm = identity.contains("qcom") || identity.contains("qualcomm");
    let is_mediatek = identity.contains("mt") || identity.contains("mediatek");

    let mut notes = vec![
        "Normal, Recovery, and Bootloader use standard authorized ADB reboot commands.".to_string(),
    ];
    if is_samsung {
        notes.push("Samsung Download Mode is exposed through adb reboot download and must be re-verified after USB re-enumeration.".to_string());
    } else {
        notes.push("Download Mode is hidden because BobFWTools has not identified this target as Samsung.".to_string());
    }
    if is_qualcomm {
        notes.push("Qualcomm hardware detected, but generic adb reboot edl is intentionally not exposed because EDL entry is OEM/build dependent.".to_string());
    }
    if is_mediatek {
        notes.push("MediaTek hardware detected, but BROM/preloader entry is intentionally not exposed as a generic ADB command because entry is device-specific and commonly physical.".to_string());
    }

    Ok(AdbModeCapabilities {
        serial,
        manufacturer: if manufacturer.is_empty() { brand } else { manufacturer },
        model,
        normal: true,
        recovery: true,
        bootloader: true,
        download: is_samsung,
        qualcomm_edl: false,
        mediatek_brom: false,
        notes,
    })
}

#[tauri::command]
pub fn adb_reboot_mode(serial: String, mode: String) -> Result<AdbActionResult, String> {
    require_authorized(&serial)?;
    let (workflow, args): (&'static str, Vec<&str>) = match mode.as_str() {
        "normal" => ("reboot-normal", vec!["-s", &serial, "reboot"]),
        "recovery" => ("reboot-recovery", vec!["-s", &serial, "reboot", "recovery"]),
        "bootloader" => ("reboot-bootloader", vec!["-s", &serial, "reboot", "bootloader"]),
        "download" => {
            let capabilities = adb_mode_capabilities(serial.clone())?;
            if !capabilities.download {
                return Err("Download Mode is only exposed after BobFWTools identifies the authorized ADB target as Samsung.".to_string());
            }
            ("reboot-download", vec!["-s", &serial, "reboot", "download"])
        },
        _ => return Err("Unsupported reboot mode".to_string()),
    };

    require_success(run_adb(&args)?, workflow)?;

    Ok(AdbActionResult {
        serial,
        workflow,
        accepted: true,
        verified: false,
        message: "ADB accepted the reboot command. The device will temporarily disconnect while changing modes.".to_string(),
        evidence_source: "adb:reboot-command-accepted",
    })
}

#[tauri::command]
pub fn open_advanced_actions_window(
    app: tauri::AppHandle,
    serial: String,
) -> Result<(), String> {
    require_authorized(&serial)?;
    let window = app
        .get_webview_window("advanced-device-actions")
        .ok_or_else(|| "Advanced Device Actions window is not available.".to_string())?;

    app.emit_to(
        "advanced-device-actions",
        "advanced-device-target",
        serde_json::json!({ "serial": serial }),
    )
    .map_err(|e| format!("Failed to bind target to Advanced Device Actions window: {e}"))?;

    window
        .show()
        .map_err(|e| format!("Failed to show Advanced Device Actions window: {e}"))?;
    window
        .set_focus()
        .map_err(|e| format!("Failed to focus Advanced Device Actions window: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn launch_target_device_action(
    serial: String,
    action: TargetActionToken,
) -> Result<AdbActionResult, String> {
    if !valid_adb_serial(&serial) {
        return Err("Invalid or malformed ADB transport serial.".to_string());
    }

    require_authorized(&serial)?;

    let mut args = vec!["-s", serial.as_str()];
    args.extend_from_slice(action.intent_args());
    require_success(run_adb(&args)?, action.workflow())?;

    Ok(AdbActionResult {
        serial,
        workflow: action.workflow(),
        accepted: true,
        verified: true,
        message: "Android accepted the allowlisted launch intent on the selected authorized target.".to_string(),
        evidence_source: "adb:serial-bound-am-start-allowlist",
    })
}

#[cfg(test)]
mod adb_observation_coordinator_tests {
    use super::*;

    #[test]
    fn observation_pool_uses_shared_bounded_scheduler() {
        assert_eq!(crate::observation_scheduler::MAX_OBSERVATION_WORKERS, 2);
        assert_eq!(crate::observation_scheduler::available_observation_permits(), 2);
    }

    #[test]
    fn invalidation_advances_observation_generation() {
        let before = current_observation_generation();
        bump_observation_generation();
        let after = current_observation_generation();
        assert!(after > before);
    }

    #[test]
    fn execution_authorization_remains_outside_coalesced_observation_path() {
        let source = include_str!("adb_workflows.rs");
        let require_authorized = source
            .split("fn require_authorized(serial: &str)")
            .nth(1)
            .and_then(|rest| rest.split("fn parse_getprop_snapshot").next())
            .unwrap_or_default();
        assert!(require_authorized.contains("device_state(serial)?"));
        assert!(!require_authorized.contains("coalesced_adb_scan"));
        assert!(!require_authorized.contains("adb_observation_coordinator"));
    }

    #[test]
    fn waiter_registers_before_releasing_coordinator_state() {
        let source = include_str!("adb_workflows.rs");
        let scan = source
            .split("async fn coalesced_adb_scan()")
            .nth(1)
            .and_then(|rest| rest.split("pub(crate) fn adb_scan_observed_sync").next())
            .unwrap_or_default();
        let enable = scan.find("notified.as_mut().enable()");
        let unlock = scan.find("drop(state);");
        assert!(enable.is_some());
        assert!(unlock.is_some());
        assert!(enable.unwrap() < unlock.unwrap());
    }

    #[test]
    fn producer_failure_path_clears_running_and_notifies_waiters() {
        let source = include_str!("adb_workflows.rs");
        let scan = source
            .split("async fn coalesced_adb_scan()")
            .nth(1)
            .and_then(|rest| rest.split("pub(crate) fn adb_scan_observed_sync").next())
            .unwrap_or_default();
        assert!(scan.contains("state.running = false"));
        assert!(scan.contains("state.notify.notify_waiters()"));
        assert!(scan.contains("ADB observation worker failed"));
    }

    #[test]
    fn adb_scan_is_async_and_coalesced() {
        let source = include_str!("adb_workflows.rs");
        assert!(source.contains("pub async fn adb_scan()"));
        assert!(source.contains("coalesced_adb_scan().await"));
        assert!(source.contains("spawn_blocking(cached_adb_scan)"));
    }
}

#[cfg(test)]
mod adb_snapshot_tests {
    use super::*;

    #[test]
    fn parses_adb_devices_into_independent_records() {
        let devices = parse_adb_devices(
            "List of devices attached\nSERIAL_A device product:foo model:A\nSERIAL_B unauthorized usb:1-2\n",
        );
        assert_eq!(devices.len(), 2);
        assert_eq!(devices[0].serial, "SERIAL_A");
        assert!(devices[0].authorized);
        assert_eq!(devices[1].serial, "SERIAL_B");
        assert!(!devices[1].authorized);
    }

    #[test]
    fn parses_getprop_snapshot_once_for_multi_property_reads() {
        let properties = parse_getprop_snapshot(
            "[ro.product.manufacturer]: [samsung]\n[ro.product.model]: [SM-T500]\n[ro.hardware]: [qcom]\n",
        );
        assert_eq!(properties.get("ro.product.manufacturer").map(String::as_str), Some("samsung"));
        assert_eq!(properties.get("ro.product.model").map(String::as_str), Some("SM-T500"));
        assert_eq!(properties.get("ro.hardware").map(String::as_str), Some("qcom"));
    }

    #[test]
    fn observation_cache_expires_quickly() {
        let now = Instant::now();
        assert!(cache_is_fresh(now, now));
        assert!(!cache_is_fresh(
            now - Duration::from_millis(ADB_SCAN_CACHE_TTL.as_millis() as u64 + 1),
            now,
        ));
    }

    #[test]
    fn authorization_path_is_bound_to_fresh_scan_source() {
        let source = include_str!("adb_workflows.rs");
        let device_state = source
            .split("fn device_state(serial: &str)")
            .nth(1)
            .and_then(|rest| rest.split("fn valid_adb_serial").next())
            .unwrap_or_default();
        assert!(device_state.contains("fresh_adb_scan()?"));
        assert!(!device_state.contains("cached_adb_scan()?"));
    }
}

#[cfg(test)]
mod target_action_tests {
    use super::*;

    #[test]
    fn adb_serial_allowlist_accepts_realistic_transport_ids() {
        for serial in ["R9WN929QFKJ", "emulator-5554", "192.168.0.10:5555", "device_01.test"] {
            assert!(valid_adb_serial(serial), "expected valid serial: {serial}");
        }
        for serial in ["", "bad serial", "x;rm", "$(id)", "x/../../y"] {
            assert!(!valid_adb_serial(serial), "expected invalid serial: {serial}");
        }
    }

    #[test]
    fn target_action_tokens_are_fixed_and_shell_free() {
        let actions = [
            TargetActionToken::SamsungInternet,
            TargetActionToken::YouTube,
            TargetActionToken::GoogleMaps,
            TargetActionToken::GalaxyStore,
        ];

        for action in actions {
            let args = action.intent_args();
            assert_eq!(args.get(0), Some(&"shell"));
            assert_eq!(args.get(1), Some(&"am"));
            assert_eq!(args.get(2), Some(&"start"));
            assert!(args.iter().all(|arg| !arg.contains(';')));
            assert!(args.iter().all(|arg| !arg.contains("&&")));
            assert!(args.iter().all(|arg| !arg.contains("|")));
            assert!(args.iter().all(|arg| !arg.contains("$(")));
        }
    }

    #[test]
    fn target_action_tokens_do_not_accept_arbitrary_frontend_values() {
        assert!(serde_json::from_str::<TargetActionToken>(r#""youtube""#).is_ok());
        assert!(serde_json::from_str::<TargetActionToken>(r#""galaxy_store""#).is_ok());
        assert!(serde_json::from_str::<TargetActionToken>(r#""https://example.com""#).is_err());
        assert!(serde_json::from_str::<TargetActionToken>(r#""shell""#).is_err());
    }
}

#[tauri::command]
pub fn adb_open_network_settings(serial: String) -> Result<AdbActionResult, String> {
    require_authorized(&serial)?;
    require_success(
        run_adb(&[
            "-s",
            &serial,
            "shell",
            "am",
            "start",
            "-a",
            "android.settings.NETWORK_SETTINGS",
        ])?,
        "open network settings",
    )?;

    Ok(AdbActionResult {
        serial,
        workflow: "open-network-settings",
        accepted: true,
        verified: true,
        message: "Android network settings opened on the connected device.".to_string(),
        evidence_source: "adb:am-start-network-settings",
    })
}

#[tauri::command]
pub fn adb_open_factory_reset_settings(serial: String) -> Result<AdbActionResult, String> {
    require_authorized(&serial)?;
    require_success(
        run_adb(&[
            "-s",
            &serial,
            "shell",
            "am",
            "start",
            "-a",
            "android.settings.FACTORY_RESET",
        ])?,
        "open factory reset settings",
    )?;

    Ok(AdbActionResult {
        serial,
        workflow: "open-factory-reset-settings",
        accepted: true,
        verified: true,
        message: "Android factory-reset settings opened. Final wipe confirmation remains on the device.".to_string(),
        evidence_source: "adb:am-start-factory-reset-settings",
    })
}

#[tauri::command]
pub fn adb_install_apk(serial: String, apk_path: String) -> Result<AdbActionResult, String> {
    require_authorized(&serial)?;
    let path = PathBuf::from(&apk_path);
    if !path.is_file() {
        return Err("APK path must point to a readable file".to_string());
    }
    if path.extension().and_then(|ext| ext.to_str()).map(|ext| ext.eq_ignore_ascii_case("apk")) != Some(true) {
        return Err("Only .apk files are accepted by this workflow".to_string());
    }

    let path_string = path.to_string_lossy().to_string();
    let output = require_success(
        run_adb(&["-s", &serial, "install", "-r", &path_string])?,
        "adb install apk",
    )?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let verified = stdout.lines().any(|line| line.trim() == "Success");
    if !verified {
        return Err(format!("ADB install returned success exit status but did not report Success: {}", stdout.trim()));
    }

    Ok(AdbActionResult {
        serial,
        workflow: "install-apk",
        accepted: true,
        verified: true,
        message: format!("APK installed from {}", path.display()),
        evidence_source: "adb:install-r+success-token",
    })
}


fn validate_package_name(package: &str) -> Result<(), String> {
    if package.is_empty() || package.len() > 255 {
        return Err("Invalid package name".to_string());
    }
    if !package
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_')
    {
        return Err("Package name contains unsupported characters".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn adb_list_user_packages(serial: String) -> Result<Vec<AdbPackageRecord>, String> {
    require_authorized(&serial)?;
    let output = require_success(
        run_adb(&["-s", &serial, "shell", "pm", "list", "packages", "-3"])?,
        "adb list user packages",
    )?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut packages = stdout
        .lines()
        .filter_map(|line| line.trim().strip_prefix("package:"))
        .map(|name| AdbPackageRecord {
            package_name: name.to_string(),
        })
        .collect::<Vec<_>>();
    packages.sort_by(|a, b| a.package_name.cmp(&b.package_name));
    Ok(packages)
}

#[tauri::command]
pub fn adb_package_action(
    serial: String,
    package_name: String,
    action: String,
) -> Result<AdbActionResult, String> {
    require_authorized(&serial)?;
    validate_package_name(&package_name)?;

    let (workflow, args): (&'static str, Vec<&str>) = match action.as_str() {
        "enable" => (
            "app-enable",
            vec!["-s", &serial, "shell", "pm", "enable", &package_name],
        ),
        "disable-user" => (
            "app-disable-user",
            vec![
                "-s",
                &serial,
                "shell",
                "pm",
                "disable-user",
                "--user",
                "0",
                &package_name,
            ],
        ),
        "clear-data" => (
            "app-clear-data",
            vec!["-s", &serial, "shell", "pm", "clear", &package_name],
        ),
        "uninstall-user" => (
            "app-uninstall-user",
            vec![
                "-s",
                &serial,
                "shell",
                "pm",
                "uninstall",
                "--user",
                "0",
                &package_name,
            ],
        ),
        _ => return Err("Unsupported package action".to_string()),
    };

    let output = require_success(run_adb(&args)?, workflow)?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let verified = match action.as_str() {
        "enable" | "disable-user" => !stdout.to_lowercase().contains("error"),
        "clear-data" | "uninstall-user" => stdout.contains("Success"),
        _ => false,
    };

    if !verified {
        return Err(format!(
            "{workflow} returned success exit status but could not be verified: {stdout}"
        ));
    }

    Ok(AdbActionResult {
        serial,
        workflow,
        accepted: true,
        verified: true,
        message: format!("{workflow} completed for {package_name}"),
        evidence_source: "adb:pm+verified-output",
    })
}

#[cfg(test)]
mod samsung_identity_tests {
    use super::*;

    #[test]
    fn samsung_identity_fingerprint_binds_model_and_never_claims_cross_mode_identity() {
        let first = samsung_identity_fingerprint(
            "R58MTEST",
            Some("R58MTEST"),
            1234,
            Some("samsung"),
            Some("samsung"),
            Some("SM-T500"),
            Some("gta4lwifi"),
            Some("T500XXU8"),
            true,
        )
        .expect("first fingerprint");
        let other_model = samsung_identity_fingerprint(
            "R58MTEST",
            Some("R58MTEST"),
            1234,
            Some("samsung"),
            Some("samsung"),
            Some("SM-T505"),
            Some("gta4l"),
            Some("T505XXU8"),
            true,
        )
        .expect("second fingerprint");

        assert_eq!(first.len(), 64);
        assert_eq!(other_model.len(), 64);
        assert_ne!(first, other_model);
    }
}
