use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowJobRecord {
    pub id: String,
    pub workflow_id: String,
    pub serial: Option<String>,
    pub state: &'static str,
    pub started_at_ms: u64,
    pub finished_at_ms: Option<u64>,
    pub verified: bool,
    pub summary: String,
    pub evidence: Vec<String>,
    pub error: Option<String>,
}

static JOBS: OnceLock<Mutex<HashMap<String, WorkflowJobRecord>>> = OnceLock::new();
static COUNTER: OnceLock<Mutex<u64>> = OnceLock::new();

fn jobs() -> &'static Mutex<HashMap<String, WorkflowJobRecord>> {
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn next_id() -> String {
    let counter = COUNTER.get_or_init(|| Mutex::new(0));
    let mut value = counter.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    *value += 1;
    format!("job-{}-{}", now_ms(), *value)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn put(record: WorkflowJobRecord) {
    jobs()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .insert(record.id.clone(), record);
}

fn update_success(id: &str, summary: String, verified: bool, evidence: Vec<String>) -> Result<WorkflowJobRecord, String> {
    let mut map = jobs().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let job = map.get_mut(id).ok_or_else(|| format!("Workflow job {id} disappeared"))?;
    job.state = "completed";
    job.finished_at_ms = Some(now_ms());
    job.summary = summary;
    job.verified = verified;
    job.evidence = evidence;
    Ok(job.clone())
}

fn update_failure(id: &str, error: String) -> WorkflowJobRecord {
    let mut map = jobs().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let job = map.get_mut(id).expect("workflow job must exist before execution");
    job.state = "failed";
    job.finished_at_ms = Some(now_ms());
    job.error = Some(error.clone());
    job.summary = error;
    job.clone()
}

#[tauri::command]
pub fn workflow_job_list() -> Vec<WorkflowJobRecord> {
    let mut records = jobs()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .values()
        .cloned()
        .collect::<Vec<_>>();
    records.sort_by(|a, b| b.started_at_ms.cmp(&a.started_at_ms));
    records
}

#[tauri::command]
pub fn workflow_job_get(id: String) -> Result<WorkflowJobRecord, String> {
    jobs()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .get(&id)
        .cloned()
        .ok_or_else(|| format!("Workflow job {id} was not found"))
}

#[tauri::command]
pub async fn workflow_job_start(
    workflow_id: String,
    serial: Option<String>,
) -> Result<WorkflowJobRecord, String> {
    const ALLOWED: &[&str] = &[
        "diagnose-phone",
        "adb-device-info",
        "adb-battery-info",
        "adb-logcat",
        "adb-reboot-normal",
        "adb-reboot-recovery",
        "adb-reboot-bootloader",
        "adb-reboot-download",
        "adb-network-settings",
        "adb-factory-reset-settings",
    ];

    if !ALLOWED.contains(&workflow_id.as_str()) {
        return Err(format!("Workflow {workflow_id} is not exposed by the one-click job engine"));
    }

    let id = next_id();
    put(WorkflowJobRecord {
        id: id.clone(),
        workflow_id: workflow_id.clone(),
        serial: serial.clone(),
        state: "running",
        started_at_ms: now_ms(),
        finished_at_ms: None,
        verified: false,
        summary: "Workflow started".to_string(),
        evidence: Vec::new(),
        error: None,
    });

    let result: Result<(String, bool, Vec<String>), String> = match workflow_id.as_str() {
        "diagnose-phone" => crate::diagnostics::diagnose_phone().await.map(|report| (
            format!(
                "Diagnosis complete: {} workflow(s) ready; connection grade {}",
                report.available_workflows.len(),
                report.connection_grade
            ),
            true,
            report.evidence.into_iter().map(|e| format!("{}:{}", e.source, e.detail)).collect(),
        )),
        "adb-device-info" => match serial.clone() {
            Some(serial) => crate::adb_workflows::adb_device_info(serial).map(|r| (
                format!("Verified {} device properties", r.properties.len()),
                r.verified,
                vec![r.evidence_source.to_string()],
            )),
            None => Err("adb-device-info requires a selected serial".to_string()),
        }
        "adb-battery-info" => match serial.clone() {
            Some(serial) => crate::adb_workflows::adb_battery_info(serial).map(|r| (
                "Battery information captured".to_string(),
                r.verified,
                vec![r.evidence_source.to_string()],
            )),
            None => Err("adb-battery-info requires a selected serial".to_string()),
        }
        "adb-logcat" => match serial.clone() {
            Some(serial) => crate::adb_workflows::adb_logcat_snapshot(serial, Some(250)).map(|r| (
                "Logcat snapshot captured".to_string(),
                r.verified,
                vec![r.evidence_source.to_string()],
            )),
            None => Err("adb-logcat requires a selected serial".to_string()),
        }
        "adb-reboot-normal" | "adb-reboot-recovery" | "adb-reboot-bootloader" | "adb-reboot-download" => match serial.clone() {
            Some(serial) => {
                let mode = workflow_id.trim_start_matches("adb-reboot-").to_string();
                crate::adb_workflows::adb_reboot_mode(serial, mode).map(|r| (
                    r.message,
                    r.verified,
                    vec![r.evidence_source.to_string()],
                ))
            }
            None => Err("ADB reboot requires a selected serial".to_string()),
        }
        "adb-network-settings" => match serial.clone() {
            Some(serial) => crate::adb_workflows::adb_open_network_settings(serial).map(|r| (
                r.message,
                r.verified,
                vec![r.evidence_source.to_string()],
            )),
            None => Err("Network settings requires a selected serial".to_string()),
        }
        "adb-factory-reset-settings" => match serial.clone() {
            Some(serial) => crate::adb_workflows::adb_open_factory_reset_settings(serial).map(|r| (
                r.message,
                r.verified,
                vec![r.evidence_source.to_string()],
            )),
            None => Err("Factory reset settings requires a selected serial".to_string()),
        }
        _ => Err("Workflow dispatch mismatch".to_string()),
    };

    match result {
        Ok((summary, verified, evidence)) => update_success(&id, summary, verified, evidence),
        Err(error) => Ok(update_failure(&id, error)),
    }
}
