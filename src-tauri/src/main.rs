// Bobby's Workshop - Tauri Main Entry Point
// Manages app lifecycle. The legacy Node backend is opt-in.

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use tauri::{Manager, AppHandle, Emitter};
use std::path::PathBuf;
use std::env;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};

mod python_backend;
mod py_client;
mod fastapi_backend;
use python_backend::{launch_python_backend, shutdown_python_backend};
use py_client::PyWorkerClient;
use fastapi_backend::{launch_fastapi_backend, shutdown_fastapi_backend};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FlashPartition {
    name: String,
    imagePath: String,
    size: u64,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FlashStartResponse {
    jobId: String,
}

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeviceEventEnvelope {
    #[serde(rename = "type")]
    kind: String,
    event: DeviceHotplugEvent,
}

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
    backend_server: Mutex<Option<Child>>,
    flash_jobs: Mutex<HashMap<String, FlashJobRuntime>>,
    flash_history: Mutex<Vec<FlashHistoryEntry>>,
    job_counter: AtomicU64,
    device_monitor_started: Mutex<bool>,
    py_client: Mutex<Option<PyWorkerClient>>,
    py_backend_port: Mutex<Option<u16>>,
    fastapi_backend: Mutex<Option<Child>>,
}

fn env_var_truthy(name: &str) -> bool {
    match env::var(name) {
        Ok(v) => matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"),
        Err(_) => false,
    }
}

fn should_start_node_backend() -> bool {
    // ALWAYS AUTO-START backend for complete standalone experience
    // Backend is required for full functionality
    // Set BW_DISABLE_NODE_BACKEND=1 to disable (not recommended)
    !env_var_truthy("BW_DISABLE_NODE_BACKEND")
}

#[tauri::command]
fn get_backend_status(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let is_running = {
        let backend = state
            .backend_server
            .lock()
            .map_err(|_| "backend_server lock poisoned".to_string())?;
        backend.is_some()
    };

    if is_running {
        return Ok("Backend running on http://localhost:3001".to_string());
    }

    if should_start_node_backend() {
        Ok(
            "Backend server is enabled but not running. Ensure Node.js is installed and check app logs for startup errors."
                .to_string(),
        )
    } else {
        Ok(
            "Backend server disabled. To enable the Node backend, unset BW_DISABLE_NODE_BACKEND or set it to 0."
                .to_string(),
        )
    }
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
        let mut set_job_status = |status: &str, step: &str| {
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

        let mut push_log = |line: &str| {
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

        let mut complete_step = |completed: u64, total: u64| {
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
        drop(set_job_status);
        drop(push_log);
        drop(complete_step);
        drop(cancel_requested);

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

#[tauri::command]
fn flash_cancel(state: tauri::State<'_, AppState>, jobId: String) -> Result<(), String> {
    let mut jobs = state.flash_jobs.lock().map_err(|_| "flash_jobs mutex poisoned".to_string())?;
    let job = jobs.get_mut(&jobId).ok_or_else(|| "Unknown jobId".to_string())?;
    job.cancel_requested = true;
    job.status = "cancelled".to_string();
    job.end_time_ms = Some(now_ms());
    Ok(())
}

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

#[tauri::command]
fn flash_history(state: tauri::State<'_, AppState>, limit: Option<usize>) -> Result<Vec<FlashHistoryEntry>, String> {
    let hist = state.flash_history.lock().map_err(|_| "flash_history mutex poisoned".to_string())?;
    let lim = limit.unwrap_or(50).min(200);
    Ok(hist.iter().take(lim).cloned().collect())
}

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
        let mut seen: HashSet<String> = HashSet::new();
        loop {
            // Prefer BootForgeUSB scan (includes libusb enumeration + tool confirmers).
            let mut current: HashSet<String> = HashSet::new();
            let scan = bootforgeusb::scan().ok();
            if let Some(devs) = scan {
                for d in devs {
                    current.insert(d.device_uid.clone());
                }
            } else {
                // Fall back to tool lists.
                for s in adb_list_serials() {
                    current.insert(format!("adb:{}", s));
                }
                for s in fastboot_list_serials() {
                    current.insert(format!("fastboot:{}", s));
                }
            }

            // Connected
            for uid in current.difference(&seen) {
                emit_device_event(
                    &app,
                    DeviceHotplugEvent {
                        event_type: "connected".to_string(),
                        device_uid: uid.to_string(),
                        platform_hint: if uid.contains("ios") { "ios".to_string() } else if uid.contains("android") || uid.starts_with("adb:") || uid.starts_with("fastboot:") { "android".to_string() } else { "unknown".to_string() },
                        mode: if uid.contains("fastboot") { "fastboot".to_string() } else { "normal".to_string() },
                        confidence: 0.85,
                        timestamp: iso_now(),
                        display_name: uid.to_string(),
                        matched_tool_ids: vec![],
                    },
                );
            }

            // Disconnected
            for uid in seen.difference(&current) {
                emit_device_event(
                    &app,
                    DeviceHotplugEvent {
                        event_type: "disconnected".to_string(),
                        device_uid: uid.to_string(),
                        platform_hint: if uid.contains("ios") { "ios".to_string() } else if uid.contains("android") || uid.starts_with("adb:") || uid.starts_with("fastboot:") { "android".to_string() } else { "unknown".to_string() },
                        mode: if uid.contains("fastboot") { "fastboot".to_string() } else { "normal".to_string() },
                        confidence: 0.85,
                        timestamp: iso_now(),
                        display_name: uid.to_string(),
                        matched_tool_ids: vec![],
                    },
                );
            }

            seen = current;
            std::thread::sleep(std::time::Duration::from_millis(1500));
        }
    });
}

fn get_log_directory() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        // Windows: %LOCALAPPDATA%\BobbysWorkshop\logs
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("C:\\Users\\Public"))
            .join("BobbysWorkshop")
            .join("logs")
    }
    #[cfg(target_os = "macos")]
    {
        // macOS: ~/Library/Logs/BobbysWorkshop
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join("Library")
            .join("Logs")
            .join("BobbysWorkshop")
    }
    #[cfg(target_os = "linux")]
    {
        // Linux: ~/.local/share/bobbys-workshop/logs
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join("bobbys-workshop")
            .join("logs")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        // Fallback
        PathBuf::from("/tmp").join("bobbys-workshop").join("logs")
    }
}

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
        backend_server: Mutex::new(None),
        flash_jobs: Mutex::new(HashMap::new()),
        flash_history: Mutex::new(vec![]),
        job_counter: AtomicU64::new(0),
        device_monitor_started: Mutex::new(false),
        py_client: Mutex::new(None),
        py_backend_port: Mutex::new(None),
        fastapi_backend: Mutex::new(None),
    };

    tauri::Builder::default()
        .manage(app_state)
        .setup(|app| {
            let state = app.state::<AppState>();
            let handle = app.handle();

            // Start in-process device monitor (Tauri events)
            start_device_monitor_once(&handle, state.clone());

            // Launch Python backend service (legacy)
            if let Ok(resource_dir) = handle.path().resource_dir() {
                match launch_python_backend(&resource_dir) {
                    Ok(port) => {
                        println!("[Tauri] Python backend launched on port {}", port);
                        
                        // Create Python client and verify health
                        let client = PyWorkerClient::new(port);
                        let state_for_client = state.clone();
                        
                        // Spawn async task to check health
                        tokio::spawn(async move {
                            // Wait a moment for Python to start
                            tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                            
                            match client.health().await {
                                Ok(health) => {
                                    println!("[Tauri] Python backend healthy: {} (uptime: {}ms)", 
                                        health.version, health.uptime_ms);
                                    
                                    // Store client and port in state
                                    if let Ok(mut py_client_guard) = state_for_client.py_client.lock() {
                                        *py_client_guard = Some(client);
                                    }
                                    if let Ok(mut port_guard) = state_for_client.py_backend_port.lock() {
                                        *port_guard = Some(port);
                                    }
                                }
                                Err(e) => {
                                    eprintln!("[Tauri] Python backend health check failed: {}", e);
                                    eprintln!("[Tauri] Python backend may not be fully ready");
                                }
                            }
                        });
                    }
                    Err(e) => {
                        eprintln!("[Tauri] Failed to launch Python backend: {}", e);
                        eprintln!("[Tauri] Python backend is optional - continuing without it");
                    }
                }
            }
            
            // Launch FastAPI backend (Secret Rooms)
            match launch_fastapi_backend(&handle) {
                Ok(child) => {
                    println!("[Tauri] FastAPI backend started successfully");
                    // Store in state if needed
                }
                Err(e) => {
                    eprintln!("[Tauri] Failed to start FastAPI backend: {}", e);
                    eprintln!("[Tauri] FastAPI backend is optional - continuing without it");
                }
            }

            // Start legacy Node backend only when explicitly enabled.
            if should_start_node_backend() {
                match start_backend_server(&handle) {
                    Ok(child) => {
                        if let Ok(mut guard) = state.backend_server.lock() {
                            *guard = Some(child);
                        }
                        println!("[Tauri] Backend server started successfully");
                    }
                    Err(e) => {
                        eprintln!("[Tauri] Failed to start backend server: {}", e);
                        eprintln!("[Tauri] Node backend is required for full functionality");
                        eprintln!("[Tauri] Ensure Node.js is installed from https://nodejs.org/");
                        eprintln!("[Tauri] Or set BW_DISABLE_NODE_BACKEND=1 to use in-process backend only");
                    }
                }
            } else {
                println!("[Tauri] Node backend disabled by BW_DISABLE_NODE_BACKEND environment variable");
            }
            
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Clean shutdown: stop backends when the app is actually closing.
                stop_backend_server(&window.app_handle());
                shutdown_python_backend();
                
                // Shutdown FastAPI backend
                let state = window.app_handle().state::<AppState>();
                let fastapi_child = {
                    let mut guard = state.fastapi_backend.lock().unwrap();
                    guard.take()
                };
                shutdown_fastapi_backend(fastapi_child);
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_backend_status,
            get_app_version,
            bootforgeusb_scan,
            flash_start,
            flash_cancel,
            flash_status,
            flash_history,
            flash_active,
            bootforge_flash_history,
            bootforge_flash_active,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
