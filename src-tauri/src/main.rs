// BobFWTools - Tauri Main Entry Point
// Manages app lifecycle. The legacy Node backend is opt-in.

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[cfg(any(feature = "legacy-backends", feature = "qualified-flash"))]
use std::process::{Command, Stdio};
#[cfg(feature = "legacy-backends")]
use std::process::Child;
use std::sync::Mutex;
use tauri::{Manager, AppHandle, Emitter};
#[cfg(any(feature = "legacy-backends", feature = "qualified-flash"))]
use std::path::PathBuf;
use std::env;
use std::collections::HashMap;
#[cfg(feature = "qualified-flash")]
use std::sync::atomic::{AtomicU64, Ordering};

#[cfg(feature = "legacy-backends")]
mod python_backend;
#[cfg(feature = "legacy-backends")]
mod py_client;
#[cfg(feature = "legacy-backends")]
mod fastapi_backend;
mod mtp_backend;
mod adb_workflows;
mod audit;
mod workflow_capabilities;
mod diagnostics;
mod workflow_jobs;
mod workstation;
mod calibration_backup_exec;
mod edl_programmer_vault;
#[cfg(feature = "legacy-backends")]
use python_backend::{launch_python_backend, shutdown_python_backend};
#[cfg(feature = "legacy-backends")]
use py_client::PyWorkerClient;
#[cfg(feature = "legacy-backends")]
use fastapi_backend::{launch_fastapi_backend, shutdown_fastapi_backend};
use mtp_backend::{mtp_status, mtp_list_root, mtp_download_file, mtp_upload_file, mtp_list_directory, mtp_download_path, mtp_upload_path};
use audit::{audit_recent, audit_log_path};
use adb_workflows::{adb_scan, adb_device_info, adb_logcat_snapshot, adb_screenshot, adb_prepare, adb_battery_info, adb_reboot_mode, adb_open_network_settings, adb_open_factory_reset_settings, adb_install_apk, adb_list_user_packages, adb_package_action};
use workflow_capabilities::workflow_capabilities;
use diagnostics::{diagnose_phone, usb_cable_doctor};
use workflow_jobs::{workflow_job_start, workflow_job_list, workflow_job_get, workflow_job_retry};
use workstation::{workstation_readiness, workstation_initialize};
use calibration_backup_exec::{backup_calibration_partition, inspect_calibration_backup};
use edl_programmer_vault::{edl_inspect_programmer, edl_enroll_programmer, edl_list_programmers};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};

#[cfg(feature = "qualified-flash")]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FlashPartition {
    name: String,
    imagePath: String,
    size: u64,
}

#[cfg(feature = "qualified-flash")]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FlashJobConfig {
    deviceSerial: String,
    deviceBrand: String,
    flashMethod: String,
    partitions: Vec<FlashPartition>,
    verifyAfterFlash: bool,
    autoReboot: bool,
    wipeUserData: bool,
}

#[cfg(feature = "qualified-flash")]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FlashStartResponse {
    jobId: String,
}

#[cfg(feature = "qualified-flash")]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct RealTimeFlashUpdate {
    #[serde(rename = "type")]
    kind: String,
    jobId: String,
    timestamp: u64,
    data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeviceHotplugEvent {
    #[serde(rename = "type")]
    event_type: String,
    device_uid: String,
    platform_hint: String,
    mode: String,
    confidence: f32,
    timestamp: String,
    display_name: String,
    matched_tool_ids: Vec<String>,
    evidence_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeviceEventEnvelope {
    #[serde(rename = "type")]
    kind: String,
    event: DeviceHotplugEvent,
}

#[cfg(feature = "qualified-flash")]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FlashHistoryEntry {
    jobId: String,
    deviceSerial: String,
    deviceBrand: Option<String>,
    flashMethod: String,
    partitions: Vec<String>,
    status: String,
    startTime: u64,
    endTime: u64,
    duration: u64,
    bytesWritten: u64,
    averageSpeed: u64,
}

#[cfg(feature = "qualified-flash")]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FlashOperationStatus {
    jobId: String,
    status: String,
    progress: u64,
    currentStep: String,
    totalSteps: u64,
    completedSteps: u64,
    bytesWritten: u64,
    totalBytes: u64,
    speed: u64,
    timeElapsed: u64,
    timeRemaining: u64,
    logs: Vec<String>,
    startTime: u64,
}

#[cfg(feature = "qualified-flash")]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FlashProgressModel {
    jobId: String,
    deviceSerial: String,
    deviceBrand: String,
    status: String,
    currentPartition: Option<String>,
    overallProgress: u64,
    partitionProgress: u64,
    bytesTransferred: u64,
    totalBytes: u64,
    transferSpeed: u64,
    estimatedTimeRemaining: u64,
    currentStage: String,
    startedAt: u64,
    pausedAt: Option<u64>,
    completedAt: Option<u64>,
    error: Option<String>,
    warnings: Vec<String>,
}

#[cfg(feature = "qualified-flash")]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct FlashOperationModel {
    id: String,
    jobConfig: FlashJobConfig,
    progress: FlashProgressModel,
    logs: Vec<String>,
    canPause: bool,
    canResume: bool,
    canCancel: bool,
}

#[cfg(feature = "qualified-flash")]
#[derive(Debug, Clone)]
struct FlashJobRuntime {
    status: String,
    progress: u64,
    current_step: String,
    total_steps: u64,
    completed_steps: u64,
    logs: Vec<String>,
    start_time_ms: u64,
    end_time_ms: Option<u64>,
    total_bytes: u64,
    cancel_requested: bool,
    active_pid: Option<u32>,
    config: FlashJobConfig,
}

#[cfg(feature = "qualified-flash")]
fn to_bootforge_status(raw: &str) -> String {
    match raw {
        "queued" => "preparing",
        "running" => "flashing",
        "paused" => "paused",
        "completed" => "completed",
        "failed" => "failed",
        "cancelled" => "cancelled",
        other => other,
    }
    .to_string()
}

#[cfg(feature = "qualified-flash")]
fn job_to_operation(job_id: &str, job: &FlashJobRuntime) -> FlashOperationModel {
    let status = to_bootforge_status(&job.status);
    let stage = job.current_step.clone();
    let completed_at = job.end_time_ms;

    FlashOperationModel {
        id: job_id.to_string(),
        jobConfig: job.config.clone(),
        progress: FlashProgressModel {
            jobId: job_id.to_string(),
            deviceSerial: job.config.deviceSerial.clone(),
            deviceBrand: job.config.deviceBrand.clone(),
            status,
            currentPartition: None,
            overallProgress: job.progress,
            partitionProgress: 0,
            bytesTransferred: 0,
            totalBytes: job.total_bytes,
            transferSpeed: 0,
            estimatedTimeRemaining: 0,
            currentStage: stage,
            startedAt: job.start_time_ms,
            pausedAt: None,
            completedAt: completed_at,
            error: None,
            warnings: vec![],
        },
        logs: job.logs.clone(),
        canPause: false,
        canResume: false,
        canCancel: job.status == "running" || job.status == "queued",
    }
}

fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn iso_now() -> String {
    // Minimal ISO-ish timestamp without extra dependencies.
    // We keep it stable and readable: milliseconds since epoch.
    format!("{}", now_ms())
}

#[cfg(feature = "qualified-flash")]
fn emit_flash_update(app_handle: &AppHandle, job_id: &str, kind: &str, data: serde_json::Value) {
    let payload = RealTimeFlashUpdate {
        kind: kind.to_string(),
        jobId: job_id.to_string(),
        timestamp: now_ms(),
        data,
    };

    // Per-job channel. In Tauri v2, emit to all windows.
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.emit(&format!("flash-progress:{}", job_id), &payload);
    }
}

fn emit_device_event(app_handle: &AppHandle, event: DeviceHotplugEvent) {
    let envelope = DeviceEventEnvelope {
        kind: "device_event".to_string(),
        event,
    };

    // In Tauri v2, emit to all windows.
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.emit("device-events", &envelope);
    }
}

#[cfg(feature = "legacy-backends")]
fn run_command_capture_lines(mut cmd: Command) -> Result<Vec<String>, String> {
    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let output = cmd.output().map_err(|e| format!("Failed to spawn: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}{}", stdout, stderr);
    if !output.status.success() {
        return Err(combined.trim().to_string());
    }

    Ok(combined
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect())
}

#[cfg(feature = "qualified-flash")]
fn fastboot_exists() -> bool {
    let mut cmd = Command::new("fastboot");
    cmd.arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(feature = "legacy-backends")]
fn adb_exists() -> bool {
    let mut cmd = Command::new("adb");
    cmd.arg("version")
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(feature = "legacy-backends")]
fn adb_list_serials() -> Vec<String> {
    let mut cmd = Command::new("adb");
    cmd.args(["devices"]);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let lines = match run_command_capture_lines(cmd) {
        Ok(l) => l,
        Err(_) => return vec![],
    };

    // Output format:
    // List of devices attached
    // SERIAL\tdevice
    lines
        .into_iter()
        .filter(|l| !l.starts_with("List of devices"))
        .filter_map(|l| {
            let mut parts = l.split_whitespace();
            let serial = parts.next()?;
            let state = parts.next().unwrap_or("");
            if serial.is_empty() || state.is_empty() {
                return None;
            }
            // accept device/unauthorized/recovery etc as "present" for hotplug
            Some(serial.to_string())
        })
        .collect()
}

#[cfg(feature = "legacy-backends")]
fn fastboot_list_serials() -> Vec<String> {
    let mut cmd = Command::new("fastboot");
    cmd.args(["devices"]);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let lines = match run_command_capture_lines(cmd) {
        Ok(l) => l,
        Err(_) => return vec![],
    };

    // Output format: SERIAL\tfastboot
    lines
        .into_iter()
        .filter_map(|l| {
            let mut parts = l.split_whitespace();
            let serial = parts.next()?;
            if serial.is_empty() {
                return None;
            }
            Some(serial.to_string())
        })
        .collect()
}

struct AppState {
    #[cfg(feature = "legacy-backends")]
    backend_server: Mutex<Option<Child>>,
    #[cfg(feature = "qualified-flash")]
    flash_jobs: Mutex<HashMap<String, FlashJobRuntime>>,
    #[cfg(feature = "qualified-flash")]
    flash_history: Mutex<Vec<FlashHistoryEntry>>,
    #[cfg(feature = "qualified-flash")]
    job_counter: AtomicU64,
    device_monitor_started: Mutex<bool>,
    #[cfg(feature = "legacy-backends")]
    py_client: Mutex<Option<PyWorkerClient>>,
    #[cfg(feature = "legacy-backends")]
    py_backend_port: Mutex<Option<u16>>,
    #[cfg(feature = "legacy-backends")]
    fastapi_backend: Mutex<Option<Child>>,
}

#[cfg(feature = "legacy-backends")]
fn env_var_truthy(name: &str) -> bool {
    match env::var(name) {
        Ok(v) => matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"),
        Err(_) => false,
    }
}

#[cfg(feature = "legacy-backends")]
fn should_start_node_backend() -> bool {
    env_var_truthy("BOBFW_ENABLE_LEGACY_NODE_BACKEND")
}

#[cfg(feature = "legacy-backends")]
fn should_start_python_backend() -> bool {
    env_var_truthy("BOBFW_ENABLE_LEGACY_PYTHON_BACKEND")
}

#[cfg(feature = "legacy-backends")]
fn should_start_fastapi_backend() -> bool {
    env_var_truthy("BOBFW_ENABLE_LEGACY_FASTAPI_BACKEND")
}

#[derive(Debug, Clone, Serialize)]
struct FrontendBackendHandshake {
    protocol: String,
    backend: String,
    status: String,
    greeting: String,
    correlation_id: String,
}

#[tauri::command]
fn frontend_backend_handshake() -> FrontendBackendHandshake {
    FrontendBackendHandshake {
        protocol: "bobfwtools-handshake-v1".to_string(),
        backend: "native-tauri-rust".to_string(),
        status: "ready".to_string(),
        greeting: "Hello from BobFWTools backend — frontend connection confirmed.".to_string(),
        correlation_id: format!("handshake-{}", uuid::Uuid::new_v4()),
    }
}

#[tauri::command]
fn get_backend_status() -> String {
    "BobFWTools native Rust/Tauri core active".to_string()
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn bootforgeusb_scan() -> Result<Vec<bootforgeusb::model::DeviceRecord>, String> {
    bootforgeusb::scan().map_err(|e| format!("USB scan failed: {e}"))
}

#[tauri::command]
fn workflow_policy_catalog() -> Vec<bootforgeusb::workflow_catalog::WorkflowPolicy> {
    bootforgeusb::workflow_catalog::workflow_catalog()
}

#[tauri::command]
fn calibration_partition_allowlist() -> Vec<String> {
    bootforgeusb::calibration::CALIBRATION_ALLOWLIST
        .iter()
        .map(|value| value.to_string())
        .collect()
}

#[tauri::command]
fn edl_9008_devices() -> Result<Vec<bootforgeusb::model::DeviceRecord>, String> {
    let devices = bootforgeusb::scan().map_err(|e| format!("USB scan failed: {e}"))?;
    Ok(devices
        .into_iter()
        .filter(|device| bootforgeusb::edl::is_edl_9008(device.vendor_id, device.product_id))
        .collect())
}

#[tauri::command]
fn firmware_target_preflight(
    device: bootforgeusb::preflight::DeviceFirmwareIdentity,
    firmware: bootforgeusb::preflight::FirmwareTargetIdentity,
    destructive: bool,
) -> bootforgeusb::preflight::PreflightResult {
    bootforgeusb::preflight::validate_target_match(&device, &firmware, destructive)
}

#[tauri::command]
fn calibration_backup_plan(
    device_uid: String,
    authorized: bool,
    root_or_service_access_verified: bool,
    dry_run: bool,
    partitions: Vec<bootforgeusb::calibration::CalibrationPartition>,
) -> bootforgeusb::calibration_backup::CalibrationBackupPlan {
    bootforgeusb::calibration_backup::build_backup_plan(
        device_uid,
        authorized,
        root_or_service_access_verified,
        dry_run,
        partitions,
    )
}

#[tauri::command]
fn edl_programmer_qualification(
    qualification: bootforgeusb::edl::EdlProgrammerQualification,
) -> Result<(), String> {
    bootforgeusb::edl::programmer_upload_permitted(&qualification)
}

#[tauri::command]
fn firehose_write_plan(
    request: bootforgeusb::firehose_plan::FirehoseWriteRequest,
) -> bootforgeusb::firehose_plan::FirehoseWritePlan {
    bootforgeusb::firehose_plan::build_write_plan(&request)
}

#[tauri::command]
fn transport_retry_decision(
    context: bootforgeusb::retry_policy::RetryContext,
) -> bootforgeusb::retry_policy::RetryDecision {
    bootforgeusb::retry_policy::decide_retry(&context)
}

#[tauri::command]
fn calibration_restore_preflight(
    manifest: bootforgeusb::calibration::CalibrationBackupManifest,
    current_device_uid: String,
    partition: String,
    actual_bytes: u64,
    actual_sha256: String,
) -> Result<(), String> {
    bootforgeusb::calibration::validate_restore_binding(
        &manifest,
        &current_device_uid,
        &partition,
        actual_bytes,
        &actual_sha256,
    )
}

#[tauri::command]
fn hardware_service_profile_validate(
    profile: bootforgeusb::hardware_service::HardwareServiceProfile,
) -> bootforgeusb::hardware_service::HardwareServiceValidation {
    bootforgeusb::hardware_service::validate_profile(&profile)
}

#[tauri::command]
fn bootforgeusb_transport_scan() -> Result<Vec<bootforgeusb::transport::TransportDevice>, String> {
    bootforgeusb::transport::scan_transports()
        .map_err(|e| format!("USB transport scan failed: {e}"))
}

#[tauri::command]
fn bootforge_firmware_inspect(paths: Vec<String>) -> Result<Vec<bootforgeusb::firmware::FirmwareArchiveReport>, String> {
    if paths.is_empty() {
        return Err("At least one firmware package path is required".to_string());
    }
    bootforgeusb::firmware::inspect_many(paths)
        .map_err(|e| format!("Firmware inspection failed: {e}"))
}

#[tauri::command]
fn bootforge_samsung_plan(paths: Vec<String>) -> Result<bootforgeusb::planner::FlashPlan, String> {
    if paths.is_empty() {
        return Err("At least one firmware package path is required".to_string());
    }
    let reports = bootforgeusb::firmware::inspect_many(paths)
        .map_err(|e| format!("Firmware inspection failed: {e}"))?;
    Ok(bootforgeusb::planner::build_samsung_plan(&reports))
}

#[tauri::command]
fn bootforge_recovery_scan() -> Result<Vec<bootforgeusb::recovery::RecoveryCandidate>, String> {
    let devices = bootforgeusb::transport::scan_transports()
        .map_err(|e| format!("USB transport scan failed: {e}"))?;
    Ok(bootforgeusb::recovery::scan_recovery_candidates(&devices))
}

#[tauri::command]
fn bootforge_recovery_plan(kind: String, paths: Vec<String>) -> Result<bootforgeusb::recovery::RecoveryPlan, String> {
    if paths.is_empty() {
        return Err("At least one recovery artifact path is required".to_string());
    }
    let kind = bootforgeusb::recovery::RecoveryKind::parse(&kind)
        .map_err(|e| format!("Recovery workflow selection failed: {e}"))?;
    bootforgeusb::recovery::build_recovery_plan(kind, paths.into_iter().map(std::path::PathBuf::from).collect())
        .map_err(|e| format!("Recovery planning failed: {e}"))
}

#[tauri::command]
fn bootforge_recovery_prepare(
    candidate: bootforgeusb::recovery::RecoveryCandidate,
    paths: Vec<String>,
) -> Result<bootforgeusb::recovery_job::RecoveryJob, String> {
    if paths.is_empty() {
        return Err("At least one recovery artifact path is required".to_string());
    }
    let device_uid = candidate.device_uid.clone();
    let workflow = format!("{:?}", candidate.workflow);
    let plan = bootforgeusb::recovery::build_recovery_plan(
        candidate.workflow,
        paths.into_iter().map(std::path::PathBuf::from).collect(),
    ).map_err(|e| format!("Recovery planning failed: {e}"))?;
    let job = bootforgeusb::recovery_job::build_job(&candidate, &plan)
        .map_err(|e| format!("Recovery job preparation failed: {e}"))?;

    let evidence = job.artifact_digests.iter()
        .map(|artifact| format!("{}:{}:{}", artifact.role, artifact.size, artifact.sha256))
        .chain(std::iter::once(format!("payload-digests:{}", job.payload_digests.len())))
        .chain(std::iter::once(format!("integrity-checks-passed:{}", job.integrity_checks_passed)))
        .chain(std::iter::once(format!("high-risk-partitions:{}", job.high_risk_partitions.join(","))))
        .chain(std::iter::once(format!("normalized-operations:{}", job.operations.len())))
        .chain(std::iter::once(format!("prerequisites-met:{}", job.prerequisites_met)))
        .collect::<Vec<_>>();
    let _ = crate::audit::record(
        "Recovery",
        "prepare-audited-job",
        if job.destructive { "destructive" } else { "elevated" },
        "prepared-blocked",
        Some(device_uid),
        format!("{} recovery job prepared; executorQualified={} executionReady={}", workflow, job.executor_qualified, job.execution_ready),
        evidence,
    );
    Ok(job)
}

#[tauri::command]
fn bootforge_recovery_revalidate(
    mut job: bootforgeusb::recovery_job::RecoveryJob,
) -> Result<bootforgeusb::recovery_job::RecoveryJob, String> {
    let device_uid = job.identity.device_uid.clone();
    let risk = if job.destructive { "destructive" } else { "elevated" };
    let devices = bootforgeusb::transport::scan_transports()
        .map_err(|e| format!("USB transport scan failed: {e}"))?;
    let current = devices.iter().find(|device| {
        device.device_uid == job.identity.device_uid
            && device.vendor_id == job.identity.vendor_id
            && device.product_id == job.identity.product_id
            && device.mode == job.identity.mode
            && device.serial_number == job.identity.serial_number
    });

    let Some(current) = current else {
        let _ = crate::audit::record(
            "Recovery",
            "revalidate-device-identity",
            risk,
            "blocked",
            Some(device_uid),
            "Prepared recovery device identity is no longer present exactly as prepared.",
            vec![
                format!("expected-mode:{}", job.identity.mode),
                format!("expected-vidpid:{:04X}:{:04X}", job.identity.vendor_id, job.identity.product_id),
            ],
        );
        return Err("Recovery device identity is no longer present exactly as prepared".to_string());
    };

    bootforgeusb::recovery_job::revalidate_job_identity(&mut job, current)
        .map_err(|e| format!("Recovery identity revalidation failed: {e}"))?;

    let _ = crate::audit::record(
        "Recovery",
        "revalidate-device-identity",
        risk,
        "passed",
        Some(job.identity.device_uid.clone()),
        "Prepared recovery job matched the currently enumerated USB device identity.",
        vec![
            format!("mode:{}", job.identity.mode),
            format!("vidpid:{:04X}:{:04X}", job.identity.vendor_id, job.identity.product_id),
            format!("serial:{}", job.identity.serial_number.clone().unwrap_or_else(|| "<none>".to_string())),
            format!("execution-ready:{}", job.execution_ready),
        ],
    );
    Ok(job)
}

#[tauri::command]
fn bootforge_recovery_export_receipt(
    job: bootforgeusb::recovery_job::RecoveryJob,
    plan: Option<bootforgeusb::recovery::RecoveryPlan>,
    destination_path: String,
) -> Result<String, String> {
    let destination = std::path::PathBuf::from(&destination_path);
    if destination.as_os_str().is_empty() {
        return Err("Evidence receipt destination is required".to_string());
    }

    let generated_unix_seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("System clock error: {e}"))?
        .as_secs();

    let gates = serde_json::json!({
        "artifactsHashed": !job.artifact_digests.is_empty(),
        "payloadsHashed": !job.payload_digests.is_empty(),
        "payloadIntegrityPassed": job.integrity_checks_passed,
        "partitionMapNormalized": !job.operations.is_empty(),
        "prerequisitesMet": job.prerequisites_met,
        "hardwareIdentityRevalidated": job.identity_revalidated,
        "executorPhysicallyQualified": job.executor_qualified,
        "executionReady": job.execution_ready,
    });

    let receipt = serde_json::json!({
        "schema": "com.bobbyblanco.bobfwtools.recovery-evidence.v1",
        "generatedUnixSeconds": generated_unix_seconds,
        "executionPerformed": false,
        "job": job,
        "plan": plan,
        "qualificationGates": gates,
        "policy": {
            "rawWriteExecutorEnabled": false,
            "requiresPhysicalExecutorQualification": true,
            "securityBypassExecutionSupported": false
        }
    });

    let bytes = serde_json::to_vec_pretty(&receipt)
        .map_err(|e| format!("Could not serialize evidence receipt: {e}"))?;
    std::fs::write(&destination, bytes)
        .map_err(|e| format!("Could not write evidence receipt {}: {e}", destination.display()))?;

    let _ = crate::audit::record(
        "Recovery",
        "export-evidence-receipt",
        if job.destructive { "destructive" } else { "elevated" },
        "completed-no-execution",
        Some(job.identity.device_uid.clone()),
        "Recovery evidence receipt exported; no write/flash execution was performed.",
        vec![
            format!("destination:{}", destination.display()),
            format!("identity-revalidated:{}", job.identity_revalidated),
            format!("executor-qualified:{}", job.executor_qualified),
            format!("execution-ready:{}", job.execution_ready),
        ],
    );

    Ok(destination.display().to_string())
}


#[derive(Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct QualificationWorkstationSnapshot {
    os: String,
    architecture: String,
    workspace_root: String,
    ready_for_diagnostics: bool,
    ready_for_android_service: bool,
    blockers: Vec<String>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct QualificationProgrammerSnapshot {
    path: String,
    sha256: String,
    bytes: u64,
    device_family: Option<String>,
    authorized: bool,
    authorization_source: Option<String>,
    enrolled_at_unix_ms: Option<u64>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct QualificationRecoveryIdentitySnapshot {
    device_uid: String,
    vendor_id: u16,
    product_id: u16,
    mode: String,
    serial_number: Option<String>,
}


fn valid_sha256_hex(value: &str) -> bool {
    let trimmed = value.trim();
    trimmed.len() == 64 && trimmed.chars().all(|c| c.is_ascii_hexdigit())
}

fn qualification_device_identity_matches(
    prepared: Option<&QualificationRecoveryIdentitySnapshot>,
    live: &bootforgeusb::transport::TransportDevice,
) -> bool {
    prepared
        .map(|prepared| {
            prepared.device_uid == live.device_uid
                && prepared.vendor_id == live.vendor_id
                && prepared.product_id == live.product_id
                && prepared.mode == live.mode
                && prepared.serial_number == live.serial_number
        })
        .unwrap_or(false)
}

fn qualification_source_revision_available(value: &str) -> bool {
    let trimmed = value.trim();
    !trimmed.is_empty() && trimmed != "unavailable"
}


#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct QualificationBuildIdentity {
    package_version: String,
    source_revision: String,
    source_revision_available: bool,
    build_profile: String,
    qualified_flash_compiled: bool,
    executor_build_fingerprint: String,
}

fn qualification_build_identity_snapshot() -> QualificationBuildIdentity {
    use sha2::{Digest, Sha256};

    let source_revision = option_env!("BOBFWTOOLS_SOURCE_REVISION")
        .or(option_env!("GITHUB_SHA"))
        .unwrap_or("unavailable")
        .trim()
        .to_string();
    let source_revision_available = qualification_source_revision_available(&source_revision);
    let build_profile = if cfg!(debug_assertions) { "debug" } else { "release" }.to_string();
    let qualified_flash_compiled = cfg!(feature = "qualified-flash");
    let package_version = env!("CARGO_PKG_VERSION").to_string();
    let executor_descriptor = format!(
        "bobfwtools|{}|{}|{}|qualified-flash:{}",
        package_version,
        source_revision,
        build_profile,
        qualified_flash_compiled
    );
    let executor_build_fingerprint = format!("{:x}", Sha256::digest(executor_descriptor.as_bytes()));

    QualificationBuildIdentity {
        package_version,
        source_revision,
        source_revision_available,
        build_profile,
        qualified_flash_compiled,
        executor_build_fingerprint,
    }
}

#[tauri::command]
fn bootforge_qualification_build_identity() -> QualificationBuildIdentity {
    qualification_build_identity_snapshot()
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct QualificationDossierInput {
    device: bootforgeusb::transport::TransportDevice,
    workstation: QualificationWorkstationSnapshot,
    authorized_programmers: Vec<QualificationProgrammerSnapshot>,
    recovery_job_fingerprint: String,
    prepared_recovery_identity: Option<QualificationRecoveryIdentitySnapshot>,
    operator_notes: String,
}


#[cfg(test)]
mod qualification_binding_tests {
    use super::*;

    fn transport(uid: &str, serial: Option<&str>) -> bootforgeusb::transport::TransportDevice {
        bootforgeusb::transport::TransportDevice {
            device_uid: uid.to_string(),
            vendor_id: 0x05c6,
            product_id: 0x9008,
            bus_number: 1,
            device_address: 2,
            manufacturer: Some("Qualcomm".into()),
            product_name: Some("QDLoader 9008".into()),
            serial_number: serial.map(str::to_string),
            mode: "qualcomm-edl".into(),
            endpoints: vec![],
            bulk_in: vec![0x81],
            bulk_out: vec![0x01],
        }
    }

    #[test]
    fn sha256_binding_requires_exact_hex_length() {
        assert!(valid_sha256_hex(&"a".repeat(64)));
        assert!(valid_sha256_hex(&"A1".repeat(32)));
        assert!(!valid_sha256_hex(&"a".repeat(63)));
        assert!(!valid_sha256_hex(&"g".repeat(64)));
        assert!(!valid_sha256_hex(""));
    }

    #[test]
    fn source_revision_fails_closed_when_unavailable() {
        assert!(qualification_source_revision_available("abc1234"));
        assert!(!qualification_source_revision_available(""));
        assert!(!qualification_source_revision_available("  "));
        assert!(!qualification_source_revision_available("unavailable"));
    }

    #[test]
    fn qualification_requires_exact_frozen_device_identity() {
        let prepared = QualificationRecoveryIdentitySnapshot {
            device_uid: "usb:05c6:9008:SERIAL".into(),
            vendor_id: 0x05c6,
            product_id: 0x9008,
            mode: "qualcomm-edl".into(),
            serial_number: Some("SERIAL".into()),
        };
        let live = transport("usb:05c6:9008:SERIAL", Some("SERIAL"));
        assert!(qualification_device_identity_matches(Some(&prepared), &live));

        let swapped = transport("usb:05c6:9008:OTHER", Some("OTHER"));
        assert!(!qualification_device_identity_matches(Some(&prepared), &swapped));
        assert!(!qualification_device_identity_matches(None, &live));
    }
}

#[tauri::command]
fn bootforge_qualification_export(
    input: QualificationDossierInput,
    destination_path: String,
) -> Result<String, String> {
    let destination = std::path::PathBuf::from(&destination_path);
    if destination.as_os_str().is_empty() {
        return Err("Qualification dossier destination is required".to_string());
    }
    let generated_unix_seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("System clock error: {e}"))?
        .as_secs();

    let recovery_job_fingerprint = input.recovery_job_fingerprint.trim().to_ascii_lowercase();
    let fingerprint_valid = valid_sha256_hex(&recovery_job_fingerprint);

    let build_identity = qualification_build_identity_snapshot();
    let source_revision = build_identity.source_revision.clone();
    let source_revision_available = build_identity.source_revision_available;
    let executor_build_fingerprint = build_identity.executor_build_fingerprint.clone();

    let device_identity_match = qualification_device_identity_matches(
        input.prepared_recovery_identity.as_ref(),
        &input.device,
    );

    let qualification_binding_ready =
        fingerprint_valid && source_revision_available && device_identity_match;
    let mut binding_blockers = Vec::new();
    if !fingerprint_valid {
        binding_blockers.push(
            "A valid 64-character recovery-job SHA-256 fingerprint is required".to_string(),
        );
    }
    if !source_revision_available {
        binding_blockers.push(
            "Executor source revision is unavailable; build is not qualification-binding ready"
                .to_string(),
        );
    }
    if !device_identity_match {
        binding_blockers.push(
            "Live recovery-mode device does not exactly match the frozen recovery-job identity"
                .to_string(),
        );
    }

    let required_physical_checks = vec![
        "Repeat USB enumeration without identity drift",
        "Confirm expected recovery mode after reconnect",
        "Confirm bulk endpoint stability across repeated scans",
        "Confirm OEM/service programmer hash remains enrolled and unchanged",
        "Confirm firmware/device/layout preflight matches target",
        "Confirm dry-run partition plan stays within verified bounds",
        "Confirm backup/rollback evidence exists where required",
        "Record designated-device bench outcome separately before any executor qualification",
        "Require an exact recovery-job fingerprint match before qualification review",
        "Require the live recovery-mode device to exactly match the frozen recovery-job identity",
        "Require an executor source revision and build fingerprint before qualification review",
    ];

    let binding_material = serde_json::json!({
        "schema": "com.bobbyblanco.bobfwtools.designated-device-qualification.binding.v1",
        "recoveryJobFingerprint": recovery_job_fingerprint,
        "preparedRecoveryIdentity": input.prepared_recovery_identity,
        "liveDeviceIdentityMatch": device_identity_match,
        "executorBuildFingerprint": executor_build_fingerprint,
        "sourceRevision": source_revision,
        "device": input.device,
        "workstation": input.workstation,
        "authorizedProgrammers": input.authorized_programmers,
        "operatorNotes": input.operator_notes,
        "requiredPhysicalChecks": required_physical_checks,
        "bindingBlockers": binding_blockers,
    });
    let binding_bytes = serde_json::to_vec(&binding_material)
        .map_err(|e| format!("Could not serialize qualification binding material: {e}"))?;
    use sha2::Digest;
    let dossier_fingerprint = format!("{:x}", sha2::Sha256::digest(&binding_bytes));

    let receipt = serde_json::json!({
        "schema": "com.bobbyblanco.bobfwtools.designated-device-qualification.v1",
        "generatedUnixSeconds": generated_unix_seconds,
        "qualificationStatus": "pending-physical-review",
        "executorQualified": false,
        "executionEnabledByThisDossier": false,
        "qualificationBindingReady": qualification_binding_ready,
        "dossierFingerprint": dossier_fingerprint,
        "bindingMaterial": binding_material,
        "recoveryJobFingerprint": recovery_job_fingerprint,
        "recoveryJobFingerprintValid": fingerprint_valid,
        "preparedRecoveryIdentity": input.prepared_recovery_identity,
        "liveDeviceIdentityMatch": device_identity_match,
        "executorBuild": build_identity,
        "device": input.device,
        "workstation": input.workstation,
        "authorizedProgrammers": input.authorized_programmers,
        "operatorNotes": input.operator_notes,
        "requiredPhysicalChecks": required_physical_checks,
        "bindingBlockers": binding_blockers
    });
    let bytes = serde_json::to_vec_pretty(&receipt)
        .map_err(|e| format!("Could not serialize qualification dossier: {e}"))?;
    std::fs::write(&destination, bytes)
        .map_err(|e| format!("Could not write qualification dossier {}: {e}", destination.display()))?;

    let _ = crate::audit::record(
        "Recovery",
        "export-qualification-dossier",
        "elevated",
        "completed-no-execution",
        Some(input.device.device_uid.clone()),
        "Designated-device qualification dossier exported; executor qualification remains false.",
        vec![
            format!("destination:{}", destination.display()),
            format!("dossier-fingerprint:{}", dossier_fingerprint),
            format!("recovery-job-fingerprint:{}", recovery_job_fingerprint),
            format!("live-device-identity-match:{}", device_identity_match),
            format!("qualification-binding-ready:{}", qualification_binding_ready),
            format!("executor-build-fingerprint:{}", executor_build_fingerprint),
        ],
    );

    Ok(destination.display().to_string())
}

#[cfg(feature = "qualified-flash")]
#[tauri::command]
fn flash_start(app_handle: AppHandle, state: tauri::State<'_, AppState>, config: FlashJobConfig) -> Result<FlashStartResponse, String> {
    if config.flashMethod != "fastboot" {
        return Err("Only fastboot is supported by the in-process (Tauri) flash backend".to_string());
    }

    if !fastboot_exists() {
        return Err("fastboot not found in PATH".to_string());
    }

    if config.deviceSerial.trim().is_empty() {
        return Err("deviceSerial is required".to_string());
    }

    if config.partitions.is_empty() {
        return Err("At least one partition is required".to_string());
    }

    // Partition name allowlist (standard Android partitions only)
    let allowed_partitions = [
        "boot", "system", "vendor", "userdata", "cache", "recovery",
        "bootloader", "radio", "aboot", "vbmeta", "dtbo", "persist"
    ];
    
    for p in &config.partitions {
        let partition_name = p.name.trim();
        if partition_name.is_empty() {
            return Err("Partition name cannot be empty".to_string());
        }
        // Validate partition name format (alphanumeric, dots, dashes, underscores)
        if !partition_name.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-' || c == '_') {
            return Err(format!("Invalid partition name format: {}", partition_name));
        }
        // Additional check: warn if partition is not in allowlist (but allow it anyway for flexibility)
        if !allowed_partitions.contains(&partition_name) {
            eprintln!("WARNING: Partition '{}' is not in the standard allowlist", partition_name);
        }
        if p.imagePath.trim().is_empty() {
            return Err(format!("imagePath missing for partition {}", p.name));
        }
        let pb = PathBuf::from(&p.imagePath);
        if !pb.exists() {
            return Err(format!("Image file not found: {}", p.imagePath));
        }
    }

    let id = {
        let next = state.job_counter.fetch_add(1, Ordering::SeqCst) + 1;
        format!("tauri-{}-{}", now_ms(), next)
    };

    let total_bytes: u64 = config.partitions.iter().map(|p| p.size).sum();
    let total_steps = config.partitions.len() as u64
        + if config.wipeUserData { 1 } else { 0 }
        + if config.autoReboot { 1 } else { 0 };

    let runtime = FlashJobRuntime {
        status: "queued".to_string(),
        progress: 0,
        current_step: "Queued".to_string(),
        total_steps,
        completed_steps: 0,
        logs: vec![],
        start_time_ms: now_ms(),
        end_time_ms: None,
        total_bytes,
        cancel_requested: false,
        active_pid: None,
        config: config.clone(),
    };

    {
        let mut jobs = state.flash_jobs.lock().map_err(|_| "flash_jobs mutex poisoned".to_string())?;
        jobs.insert(id.clone(), runtime);
    }

    emit_flash_update(
        &app_handle,
        &id,
        "status",
        serde_json::json!({
            "status": "preparing",
            "progress": 0,
            "message": "Queued"
        }),
    );

    // Run the job on a background thread.
    let app_for_thread = app_handle.clone();
    let id_for_thread = id.clone();

    std::thread::spawn(move || {
        let set_job_status = |status: &str, step: &str| {
            let state = app_for_thread.state::<AppState>();
            if let Ok(mut jobs) = state.flash_jobs.lock() {
                if let Some(job) = jobs.get_mut(&id_for_thread) {
                    job.status = status.to_string();
                    job.current_step = step.to_string();
                    if status == "completed" || status == "failed" || status == "cancelled" {
                        job.end_time_ms = Some(now_ms());
                    }
                }
            }
            emit_flash_update(
                &app_for_thread,
                &id_for_thread,
                "status",
                serde_json::json!({ "status": status, "message": step }),
            );
        };

        let push_log = |line: &str| {
            let state = app_for_thread.state::<AppState>();
            if let Ok(mut jobs) = state.flash_jobs.lock() {
                if let Some(job) = jobs.get_mut(&id_for_thread) {
                    job.logs.push(line.to_string());
                    if job.logs.len() > 5000 {
                        let drain = job.logs.len() - 5000;
                        job.logs.drain(0..drain);
                    }
                }
            }
            emit_flash_update(
                &app_for_thread,
                &id_for_thread,
                "log",
                serde_json::json!({ "message": line }),
            );
        };

        let complete_step = |completed: u64, total: u64| {
            let pct = if total == 0 { 0 } else { ((completed * 100) / total).min(100) };
            let state = app_for_thread.state::<AppState>();
            if let Ok(mut jobs) = state.flash_jobs.lock() {
                if let Some(job) = jobs.get_mut(&id_for_thread) {
                    job.completed_steps = completed;
                    job.progress = pct;
                }
            }
            emit_flash_update(
                &app_for_thread,
                &id_for_thread,
                "progress",
                serde_json::json!({ "progress": pct }),
            );
        };

        let cancel_requested = || -> bool {
            let state = app_for_thread.state::<AppState>();
            if let Ok(jobs) = state.flash_jobs.lock() {
                if let Some(job) = jobs.get(&id_for_thread) {
                    return job.cancel_requested;
                }
            }
            false
        };

        set_job_status("running", "Preparing");
        push_log("[tauri-fastboot] Starting fastboot flash job");
        if config.verifyAfterFlash {
            push_log("[tauri-fastboot] NOTE: verifyAfterFlash is not implemented for fastboot backend");
        }

        let mut completed_steps: u64 = 0;
        let total_steps_local = total_steps;

        // Optional wipe
        if config.wipeUserData {
            if cancel_requested() {
                set_job_status("cancelled", "Cancelled");
                return;
            }

            set_job_status("running", "Wiping userdata (-w)");
            push_log("[tauri-fastboot] fastboot -w");
            let mut cmd = Command::new("fastboot");
            cmd.arg("-s").arg(&config.deviceSerial).arg("-w");
            #[cfg(target_os = "windows")]
            {
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }
            match cmd.output() {
                Ok(out) => {
                    let combined = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
                    for line in combined.lines() {
                        let line = line.trim();
                        if !line.is_empty() {
                            push_log(line);
                        }
                    }
                    if !out.status.success() {
                        set_job_status("failed", "Wipe failed");
                        emit_flash_update(
                            &app_for_thread,
                            &id_for_thread,
                            "error",
                            serde_json::json!({ "message": "fastboot -w failed" }),
                        );
                        return;
                    }
                }
                Err(e) => {
                    set_job_status("failed", "Wipe failed");
                    emit_flash_update(
                        &app_for_thread,
                        &id_for_thread,
                        "error",
                        serde_json::json!({ "message": format!("Failed to run fastboot -w: {e}") }),
                    );
                    return;
                }
            }
            completed_steps += 1;
            complete_step(completed_steps, total_steps_local);
        }

        // Flash partitions
        for p in &config.partitions {
            if cancel_requested() {
                set_job_status("cancelled", "Cancelled");
                return;
            }

            set_job_status("running", &format!("Flashing {}", p.name));
            push_log(&format!("[tauri-fastboot] fastboot flash {} {}", p.name, p.imagePath));

            let mut cmd = Command::new("fastboot");
            cmd.arg("-s").arg(&config.deviceSerial);
            cmd.arg("flash").arg(&p.name).arg(&p.imagePath);
            #[cfg(target_os = "windows")]
            {
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }

            match cmd.output() {
                Ok(out) => {
                    let combined = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
                    for line in combined.lines() {
                        let line = line.trim();
                        if !line.is_empty() {
                            push_log(line);
                        }
                    }
                    if !out.status.success() {
                        set_job_status("failed", &format!("Flash failed: {}", p.name));
                        emit_flash_update(
                            &app_for_thread,
                            &id_for_thread,
                            "error",
                            serde_json::json!({ "message": format!("fastboot flash {} failed", p.name) }),
                        );
                        return;
                    }
                }
                Err(e) => {
                    set_job_status("failed", &format!("Flash failed: {}", p.name));
                    emit_flash_update(
                        &app_for_thread,
                        &id_for_thread,
                        "error",
                        serde_json::json!({ "message": format!("Failed to run fastboot flash {}: {e}", p.name) }),
                    );
                    return;
                }
            }

            completed_steps += 1;
            complete_step(completed_steps, total_steps_local);
        }

        // Optional reboot
        if config.autoReboot {
            if cancel_requested() {
                set_job_status("cancelled", "Cancelled");
                return;
            }

            set_job_status("running", "Rebooting");
            push_log("[tauri-fastboot] fastboot reboot");
            let mut cmd = Command::new("fastboot");
            cmd.arg("-s").arg(&config.deviceSerial).arg("reboot");
            #[cfg(target_os = "windows")]
            {
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }
            let _ = cmd.output().map(|out| {
                let combined = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
                for line in combined.lines() {
                    let line = line.trim();
                    if !line.is_empty() {
                        push_log(line);
                    }
                }
            });
            completed_steps += 1;
            complete_step(completed_steps, total_steps_local);
        }

        set_job_status("completed", "Completed");
        emit_flash_update(
            &app_for_thread,
            &id_for_thread,
            "status",
            serde_json::json!({ "status": "completed", "message": "Completed" }),
        );
        emit_flash_update(
            &app_for_thread,
            &id_for_thread,
            "log",
            serde_json::json!({ "message": "[tauri-fastboot] Job complete" }),
        );

        // Ensure no closures keep borrowing `state` before we lock other mutexes.
        let _ = set_job_status;
        let _ = push_log;
        let _ = complete_step;
        let _ = cancel_requested;

        // Save a lightweight history entry for flash-api consumers
        let end = now_ms();
        let start = {
            let state = app_for_thread.state::<AppState>();
            let jobs = state.flash_jobs.lock().ok();
            jobs.and_then(|j| j.get(&id_for_thread).map(|r| r.start_time_ms)).unwrap_or(end)
        };
        let duration = end.saturating_sub(start);
        let entry = FlashHistoryEntry {
            jobId: id_for_thread.clone(),
            deviceSerial: config.deviceSerial.clone(),
            deviceBrand: Some(config.deviceBrand.clone()),
            flashMethod: config.flashMethod.clone(),
            partitions: config.partitions.iter().map(|p| p.name.clone()).collect(),
            status: "completed".to_string(),
            startTime: start,
            endTime: end,
            duration,
            bytesWritten: 0,
            averageSpeed: 0,
        };
        let state = app_for_thread.state::<AppState>();
        if let Ok(mut hist) = state.flash_history.lock() {
            hist.insert(0, entry);
            if hist.len() > 200 {
                hist.truncate(200);
            }
        };
    });

    Ok(FlashStartResponse { jobId: id })
}

#[cfg(feature = "qualified-flash")]
#[tauri::command]
fn flash_cancel(state: tauri::State<'_, AppState>, jobId: String) -> Result<(), String> {
    let mut jobs = state.flash_jobs.lock().map_err(|_| "flash_jobs mutex poisoned".to_string())?;
    let job = jobs.get_mut(&jobId).ok_or_else(|| "Unknown jobId".to_string())?;
    job.cancel_requested = true;
    job.status = "cancelled".to_string();
    job.end_time_ms = Some(now_ms());
    Ok(())
}

#[cfg(feature = "qualified-flash")]
#[tauri::command]
fn bootforge_flash_history(state: tauri::State<'_, AppState>, limit: Option<usize>) -> Result<Vec<FlashOperationModel>, String> {
    let jobs = state.flash_jobs.lock().map_err(|_| "flash_jobs mutex poisoned".to_string())?;
    let mut items: Vec<(u64, String, FlashOperationModel)> = Vec::new();
    for (job_id, job) in jobs.iter() {
        if job.status == "completed" || job.status == "failed" || job.status == "cancelled" {
            let sort_key = job.end_time_ms.unwrap_or(job.start_time_ms);
            items.push((sort_key, job_id.clone(), job_to_operation(job_id, job)));
        }
    }
    items.sort_by(|a, b| b.0.cmp(&a.0));
    let lim = limit.unwrap_or(50).min(200);
    Ok(items.into_iter().take(lim).map(|t| t.2).collect())
}

#[cfg(feature = "qualified-flash")]
#[tauri::command]
fn bootforge_flash_active(state: tauri::State<'_, AppState>) -> Result<Vec<FlashOperationModel>, String> {
    let jobs = state.flash_jobs.lock().map_err(|_| "flash_jobs mutex poisoned".to_string())?;
    let mut out = Vec::new();
    for (job_id, job) in jobs.iter() {
        if job.status == "running" || job.status == "queued" || job.status == "paused" {
            out.push(job_to_operation(job_id, job));
        }
    }
    Ok(out)
}

#[cfg(feature = "qualified-flash")]
#[tauri::command]
fn flash_status(state: tauri::State<'_, AppState>, jobId: String) -> Result<FlashOperationStatus, String> {
    let jobs = state.flash_jobs.lock().map_err(|_| "flash_jobs mutex poisoned".to_string())?;
    let job = jobs.get(&jobId).ok_or_else(|| "Unknown jobId".to_string())?;
    let elapsed = now_ms().saturating_sub(job.start_time_ms);
    Ok(FlashOperationStatus {
        jobId: jobId.clone(),
        status: job.status.clone(),
        progress: job.progress,
        currentStep: job.current_step.clone(),
        totalSteps: job.total_steps,
        completedSteps: job.completed_steps,
        bytesWritten: 0,
        totalBytes: job.total_bytes,
        speed: 0,
        timeElapsed: elapsed,
        timeRemaining: 0,
        logs: job.logs.clone(),
        startTime: job.start_time_ms,
    })
}

#[cfg(feature = "qualified-flash")]
#[tauri::command]
fn flash_history(state: tauri::State<'_, AppState>, limit: Option<usize>) -> Result<Vec<FlashHistoryEntry>, String> {
    let hist = state.flash_history.lock().map_err(|_| "flash_history mutex poisoned".to_string())?;
    let lim = limit.unwrap_or(50).min(200);
    Ok(hist.iter().take(lim).cloned().collect())
}

#[cfg(feature = "qualified-flash")]
#[tauri::command]
fn flash_active(state: tauri::State<'_, AppState>) -> Result<Vec<FlashOperationStatus>, String> {
    let jobs = state.flash_jobs.lock().map_err(|_| "flash_jobs mutex poisoned".to_string())?;
    let mut out = Vec::new();
    for (job_id, job) in jobs.iter() {
        if job.status == "running" || job.status == "queued" || job.status == "paused" {
            let elapsed = now_ms().saturating_sub(job.start_time_ms);
            out.push(FlashOperationStatus {
                jobId: job_id.clone(),
                status: job.status.clone(),
                progress: job.progress,
                currentStep: job.current_step.clone(),
                totalSteps: job.total_steps,
                completedSteps: job.completed_steps,
                bytesWritten: 0,
                totalBytes: job.total_bytes,
                speed: 0,
                timeElapsed: elapsed,
                timeRemaining: 0,
                logs: vec![],
                startTime: job.start_time_ms,
            });
        }
    }
    Ok(out)
}

fn start_device_monitor_once(app_handle: &AppHandle, state: tauri::State<'_, AppState>) {
    let should_start = {
        let mut started_guard = state.device_monitor_started.lock().unwrap_or_else(|p| p.into_inner());
        if *started_guard {
            false
        } else {
            *started_guard = true;
            true
        }
    };

    if !should_start {
        return;
    }

    let app = app_handle.clone();
    std::thread::spawn(move || {
        let mut seen: HashMap<String, bootforgeusb::model::DeviceRecord> = HashMap::new();

        loop {
            let mut current: HashMap<String, bootforgeusb::model::DeviceRecord> = HashMap::new();

            if let Ok(devices) = bootforgeusb::scan() {
                for device in devices {
                    current.insert(device.device_uid.clone(), device);
                }
            }

            for (uid, device) in current.iter() {
                if !seen.contains_key(uid) {
                    let display_name = device
                        .product_name
                        .clone()
                        .or_else(|| device.manufacturer.clone())
                        .unwrap_or_else(|| format!("USB {:04X}:{:04X}", device.vendor_id, device.product_id));

                    let _ = crate::audit::record(
                        "Diagnostics",
                        "usb-connected",
                        "read-only",
                        "observed",
                        Some(uid.clone()),
                        format!("{} connected in mode {}", display_name, device.mode),
                        vec![format!("{:04X}:{:04X}", device.vendor_id, device.product_id), device.evidence_source.clone()],
                    );

                    emit_device_event(
                        &app,
                        DeviceHotplugEvent {
                            event_type: "connected".to_string(),
                            device_uid: uid.clone(),
                            platform_hint: device.platform_hint.clone(),
                            mode: device.mode.clone(),
                            confidence: 1.0,
                            timestamp: iso_now(),
                            display_name,
                            matched_tool_ids: vec![],
                            evidence_source: device.evidence_source.clone(),
                        },
                    );
                }
            }

            for (uid, device) in seen.iter() {
                if !current.contains_key(uid) {
                    let display_name = device
                        .product_name
                        .clone()
                        .or_else(|| device.manufacturer.clone())
                        .unwrap_or_else(|| format!("USB {:04X}:{:04X}", device.vendor_id, device.product_id));

                    let _ = crate::audit::record(
                        "Diagnostics",
                        "usb-disconnected",
                        "read-only",
                        "observed",
                        Some(uid.clone()),
                        format!("{} disconnected from mode {}", display_name, device.mode),
                        vec![format!("{:04X}:{:04X}", device.vendor_id, device.product_id), device.evidence_source.clone()],
                    );

                    emit_device_event(
                        &app,
                        DeviceHotplugEvent {
                            event_type: "disconnected".to_string(),
                            device_uid: uid.clone(),
                            platform_hint: device.platform_hint.clone(),
                            mode: device.mode.clone(),
                            confidence: 1.0,
                            timestamp: iso_now(),
                            display_name,
                            matched_tool_ids: vec![],
                            evidence_source: device.evidence_source.clone(),
                        },
                    );
                }
            }

            seen = current;
            std::thread::sleep(std::time::Duration::from_millis(1500));
        }
    });
}

#[cfg(feature = "legacy-backends")]
fn get_log_directory() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        // Windows: %LOCALAPPDATA%\BobFWTools\logs
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("C:\\Users\\Public"))
            .join("BobFWTools")
            .join("logs")
    }
    #[cfg(target_os = "macos")]
    {
        // macOS: ~/Library/Logs/BobFWTools
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join("Library")
            .join("Logs")
            .join("BobFWTools")
    }
    #[cfg(target_os = "linux")]
    {
        // Linux: ~/.local/share/bobfwtools/logs
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join("bobfwtools")
            .join("logs")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        // Fallback
        PathBuf::from("/tmp").join("bobfwtools").join("logs")
    }
}

#[cfg(feature = "legacy-backends")]
fn find_node_executable(app_handle: &AppHandle) -> Option<PathBuf> {
    // First, try to find bundled Node.js in resources
    // In Tauri v2, use app_handle.path().resource_dir()
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let bundled_node = resource_dir.join("nodejs");
        
        #[cfg(target_os = "windows")]
        let bundled_node_exe = bundled_node.join("node.exe");
        
        #[cfg(not(target_os = "windows"))]
        let bundled_node_exe = bundled_node.join("bin").join("node");
        
        if bundled_node_exe.exists() {
            println!("[Tauri] Found bundled Node.js at: {:?}", bundled_node_exe);
            return Some(bundled_node_exe);
        }
    }
    
    // Fall back to system Node.js (for development)
    println!("[Tauri] Bundled Node.js not found, trying system Node.js...");
    
    // Try to find Node.js in system PATH
    let mut node_cmd = Command::new("node");
    node_cmd.arg("--version");
    #[cfg(target_os = "windows")]
    {
        node_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    if let Ok(output) = node_cmd.output() {
        if output.status.success() {
            println!("[Tauri] Found system Node.js in PATH");
            return Some(PathBuf::from("node"));
        }
    }
    
    // Platform-specific common Node.js installation paths
    #[cfg(target_os = "windows")]
    {
        let common_paths = vec![
            "C:\\Program Files\\nodejs\\node.exe",
            "C:\\Program Files (x86)\\nodejs\\node.exe",
        ];
        
        for path in common_paths {
            let node_path = PathBuf::from(path);
            if node_path.exists() {
                println!("[Tauri] Found system Node.js at: {:?}", node_path);
                return Some(node_path);
            }
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        let common_paths = vec![
            "/usr/local/bin/node",
            "/opt/homebrew/bin/node",
        ];
        
        for path in common_paths {
            let node_path = PathBuf::from(path);
            if node_path.exists() {
                println!("[Tauri] Found system Node.js at: {:?}", node_path);
                return Some(node_path);
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let common_paths = vec![
            "/usr/bin/node",
            "/usr/local/bin/node",
        ];
        
        for path in common_paths {
            let node_path = PathBuf::from(path);
            if node_path.exists() {
                println!("[Tauri] Found system Node.js at: {:?}", node_path);
                return Some(node_path);
            }
        }
    }
    
    None
}

#[cfg(feature = "legacy-backends")]
fn start_backend_server(app_handle: &AppHandle) -> Result<Child, std::io::Error> {
    println!("[Tauri] Starting backend API server...");
    
    // Find Node.js executable (bundled first, then system)
    let node_exe = match find_node_executable(app_handle) {
        Some(exe) => exe,
        None => {
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Node.js executable not found. Bundled Node.js missing and system Node.js not installed. Please install Node.js from https://nodejs.org/"
            ));
        }
    };
    
    // Get the resource directory where we bundled the server
    // In Tauri v2, use app_handle.path().resource_dir()
    // Try multiple locations as fallback
    let resource_dir = match app_handle.path().resource_dir() {
        Ok(dir) if dir.join("server").join("index.js").exists() => dir,
        _ => {
            // Fallback: try relative to executable
            if let Ok(exe_path) = env::current_exe() {
                if let Some(exe_dir) = exe_path.parent() {
                    // Check if server is in bundle/resources relative to exe
                    let bundle_server = exe_dir.parent()
                        .and_then(|p| p.parent())
                        .map(|p| p.join("bundle").join("resources"));
                    
                    if let Some(bundle_path) = bundle_server {
                        if bundle_path.join("server").join("index.js").exists() {
                            println!("[Tauri] Using fallback bundle path: {:?}", bundle_path);
                            bundle_path
                        } else {
                            // Last resort: check if server directory exists next to exe
                            let local_server = exe_dir.join("server");
                            if local_server.join("index.js").exists() {
                                println!("[Tauri] Using local server path: {:?}", local_server.parent().unwrap());
                                local_server.parent().unwrap().to_path_buf()
                            } else {
                                return Err(std::io::Error::new(
                                    std::io::ErrorKind::NotFound,
                                    format!("Server files not found. Checked: resource_dir, bundle/resources, and local server directory")
                                ));
                            }
                        }
                    } else {
                        return Err(std::io::Error::new(
                            std::io::ErrorKind::NotFound,
                            "Failed to locate server files in any expected location"
                        ));
                    }
                } else {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        "Could not determine executable directory"
                    ));
                }
            } else {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Could not determine executable path"
                ));
            }
        }
    };
    
    let server_path = resource_dir.join("server").join("index.js");
    
    // Convert paths to string, stripping Windows long path prefix if present
    let server_path_str = server_path.to_string_lossy().to_string()
        .trim_start_matches(r"\\?\")
        .to_string();
    let resource_dir_str = resource_dir.to_string_lossy().to_string()
        .trim_start_matches(r"\\?\")
        .to_string();
    
    println!("[Tauri] Server path: {}", server_path_str);
    
    if !server_path.exists() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Server files not found at {}", server_path_str)
        ));
    }
    
    // Use port 3001 for the backend server
    let port = 3001;
    
    // Get log directory for backend logs
    let log_dir = get_log_directory();
    std::fs::create_dir_all(&log_dir).ok();
    
    // Start the Node.js server with log directory environment variable
    // Working directory must be server folder for relative imports to work
    let server_dir_str = format!("{}/server", resource_dir_str.replace("\\", "/"));
    let mut cmd = Command::new(&node_exe);
    cmd.arg(&server_path_str)
        .current_dir(&server_dir_str)
        .env("PORT", port.to_string())
        .env("BW_LOG_DIR", log_dir.to_string_lossy().to_string());
    
    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    // In production, redirect stdout/stderr to log file
    // In development, inherit for debugging
    #[cfg(debug_assertions)]
    {
        cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit());
    }
    #[cfg(not(debug_assertions))]
    {
        let log_file = log_dir.join("backend.log");
        if let (Ok(stdout_file), Ok(stderr_file)) = (
            std::fs::File::create(&log_file),
            std::fs::File::create(&log_file)
        ) {
            cmd.stdout(Stdio::from(stdout_file)).stderr(Stdio::from(stderr_file));
        } else {
            cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit());
        }
    }
    
    let child = cmd.spawn()?;
    
    println!("[Tauri] Backend API server started on http://localhost:{}", port);
    println!("[Tauri] Server PID: {}", child.id());
    
    // Give the server time to start up and bind to the port
    // Check if port is listening by attempting a TCP connection
    let mut attempts = 0;
    let max_attempts = 30; // 15 seconds total (30 * 500ms)
    let mut server_ready = false;
    
    while attempts < max_attempts && !server_ready {
        std::thread::sleep(std::time::Duration::from_millis(500));
        attempts += 1;
        
        // Try to connect to the port to see if server is listening
        match std::net::TcpStream::connect(format!("127.0.0.1:{}", port)) {
            Ok(_) => {
                server_ready = true;
                println!("[Tauri] Backend server confirmed ready after {}ms", attempts * 500);
                break;
            }
            Err(_) => {
                // Port not ready yet, continue waiting
            }
        }
    }
    
    if !server_ready {
        println!("[Tauri] Warning: Backend server may not be fully ready after {}ms, but continuing...", attempts * 500);
    }
    
    Ok(child)
}

#[cfg(feature = "legacy-backends")]
fn stop_backend_server(app_handle: &AppHandle) {
    // Take the child process out of shared state while holding the lock,
    // then drop the lock before kill/wait.
    let child = {
        let state: tauri::State<'_, AppState> = app_handle.state();
        let mut backend = match state.backend_server.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        backend.take()
    };

    if let Some(mut child) = child {
        println!("[Tauri] Stopping backend server...");
        let _ = child.kill();
        let _ = child.wait();
        println!("[Tauri] Backend server stopped");
    }
}

fn main() {
    // Initialize app state
    let app_state = AppState {
        #[cfg(feature = "legacy-backends")]
        backend_server: Mutex::new(None),
        #[cfg(feature = "qualified-flash")]
        flash_jobs: Mutex::new(HashMap::new()),
        #[cfg(feature = "qualified-flash")]
        flash_history: Mutex::new(vec![]),
        #[cfg(feature = "qualified-flash")]
        job_counter: AtomicU64::new(0),
        device_monitor_started: Mutex::new(false),
        #[cfg(feature = "legacy-backends")]
        py_client: Mutex::new(None),
        #[cfg(feature = "legacy-backends")]
        py_backend_port: Mutex::new(None),
        #[cfg(feature = "legacy-backends")]
        fastapi_backend: Mutex::new(None),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .setup(|app| {
            let state = app.state::<AppState>();
            let handle = app.handle();

            // Start in-process device monitor (Tauri events)
            start_device_monitor_once(&handle, state.clone());

            #[cfg(feature = "legacy-backends")]
            {
                if should_start_python_backend() {
                    if let Ok(resource_dir) = handle.path().resource_dir() {
                        match launch_python_backend(&resource_dir) {
                            Ok(port) => {
                                println!("[Tauri] Legacy Python backend launched on port {}", port);
                                let client = PyWorkerClient::new(port);
                                let handle_for_client = handle.clone();
                                tokio::spawn(async move {
                                    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                                    if client.health().await.is_ok() {
                                        let state_for_client = handle_for_client.state::<AppState>();
                                        if let Ok(mut guard) = state_for_client.py_client.lock() {
                                            *guard = Some(client);
                                        }
                                        if let Ok(mut guard) = state_for_client.py_backend_port.lock() {
                                            *guard = Some(port);
                                        }
                                    }
                                });
                            }
                            Err(e) => eprintln!("[Tauri] Legacy Python backend launch failed: {}", e),
                        }
                    }
                }

                if should_start_fastapi_backend() {
                    match launch_fastapi_backend(&handle) {
                        Ok(child) => {
                            if let Ok(mut guard) = state.fastapi_backend.lock() {
                                *guard = Some(child);
                            }
                        }
                        Err(e) => eprintln!("[Tauri] Legacy FastAPI backend launch failed: {}", e),
                    }
                }

                if should_start_node_backend() {
                    match start_backend_server(&handle) {
                        Ok(child) => {
                            if let Ok(mut guard) = state.backend_server.lock() {
                                *guard = Some(child);
                            }
                        }
                        Err(e) => eprintln!("[Tauri] Legacy Node backend launch failed: {}", e),
                    }
                }
            }

            
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                #[cfg(feature = "legacy-backends")]
                {
                    stop_backend_server(&_window.app_handle());
                    shutdown_python_backend();

                    let state = _window.app_handle().state::<AppState>();
                    let fastapi_child = {
                        let mut guard = state.fastapi_backend.lock().unwrap_or_else(|p| p.into_inner());
                        guard.take()
                    };
                    shutdown_fastapi_backend(fastapi_child);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            frontend_backend_handshake,
            get_backend_status,
            get_app_version,
            bootforgeusb_scan,
            workflow_policy_catalog,
            calibration_partition_allowlist,
            edl_9008_devices,
            firmware_target_preflight,
            calibration_backup_plan,
            edl_programmer_qualification,
            firehose_write_plan,
            transport_retry_decision,
            backup_calibration_partition,
            inspect_calibration_backup,
            calibration_restore_preflight,
            edl_inspect_programmer,
            edl_enroll_programmer,
            edl_list_programmers,
            hardware_service_profile_validate,
bootforgeusb_transport_scan,
            bootforge_firmware_inspect,
            bootforge_samsung_plan,
            bootforge_recovery_scan,
            bootforge_recovery_plan,
            bootforge_recovery_prepare,
            bootforge_recovery_revalidate,
            bootforge_recovery_export_receipt,
            bootforge_qualification_export,
            bootforge_qualification_build_identity,
            mtp_status,
            mtp_list_root,
            mtp_download_file,
            mtp_upload_file,
            mtp_list_directory,
            mtp_download_path,
            mtp_upload_path,
            adb_scan,
            adb_device_info,
            adb_logcat_snapshot,
            adb_screenshot,
            adb_prepare,
            adb_battery_info,
            adb_reboot_mode,
            adb_open_network_settings,
            adb_open_factory_reset_settings,
            adb_install_apk,
            adb_list_user_packages,
            adb_package_action,
            workflow_capabilities,
            diagnose_phone,
            usb_cable_doctor,
            workflow_job_start,
            workflow_job_list,
            workflow_job_get,
            workflow_job_retry,
            workstation_readiness,
            workstation_initialize,
            audit_recent,
            audit_log_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
