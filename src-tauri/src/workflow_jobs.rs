use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowJobRecord {
    pub id: String,
    pub workflow_id: String,
    pub serial: Option<String>,
    pub state: String,
    pub retry_of: Option<String>,
    pub started_at_ms: u64,
    pub finished_at_ms: Option<u64>,
    pub verified: bool,
    pub summary: String,
    pub evidence: Vec<String>,
    pub error: Option<String>,
}

static JOBS: OnceLock<Mutex<HashMap<String, WorkflowJobRecord>>> = OnceLock::new();
static COUNTER: OnceLock<Mutex<u64>> = OnceLock::new();

fn history_path() -> Option<PathBuf> {
    dirs::data_local_dir().map(|base| base.join("BobFWTools").join("workflow-jobs.jsonl"))
}

fn load_persisted_jobs() -> HashMap<String, WorkflowJobRecord> {
    let Some(path) = history_path() else { return HashMap::new() };
    let Ok(file) = fs::File::open(path) else { return HashMap::new() };
    let mut map = HashMap::new();
    for line in BufReader::new(file).lines().map_while(Result::ok) {
        if let Ok(record) = serde_json::from_str::<WorkflowJobRecord>(&line) {
            map.insert(record.id.clone(), record);
        }
    }
    map
}

fn persist_terminal_job(record: &WorkflowJobRecord) {
    if !matches!(record.state.as_str(), "completed" | "failed") {
        return;
    }
    let Some(path) = history_path() else { return };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) else { return };
    if let Ok(line) = serde_json::to_string(record) {
        let _ = writeln!(file, "{line}");
    }
}

fn jobs() -> &'static Mutex<HashMap<String, WorkflowJobRecord>> {
    JOBS.get_or_init(|| Mutex::new(load_persisted_jobs()))
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
    job.state = "completed".to_string();
    job.finished_at_ms = Some(now_ms());
    job.summary = summary;
    job.verified = verified;
    job.evidence = evidence;
    let record = job.clone();
    persist_terminal_job(&record);
    Ok(record)
}

fn update_failure(id: &str, error: String) -> WorkflowJobRecord {
    let mut map = jobs().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let job = map.get_mut(id).expect("workflow job must exist before execution");
    job.state = "failed".to_string();
    job.finished_at_ms = Some(now_ms());
    job.error = Some(error.clone());
    job.summary = error;
    let record = job.clone();
    persist_terminal_job(&record);
    record
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

async fn start_job_internal(
    workflow_id: String,
    serial: Option<String>,
    retry_of: Option<String>,
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
        state: "running".to_string(),
        retry_of,
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
        },
        "adb-battery-info" => match serial.clone() {
            Some(serial) => crate::adb_workflows::adb_battery_info(serial).map(|r| (
                "Battery information captured".to_string(),
                r.verified,
                vec![r.evidence_source.to_string()],
            )),
            None => Err("adb-battery-info requires a selected serial".to_string()),
        },
        "adb-logcat" => match serial.clone() {
            Some(serial) => crate::adb_workflows::adb_logcat_snapshot(serial, Some(250)).map(|r| (
                "Logcat snapshot captured".to_string(),
                r.verified,
                vec![r.evidence_source.to_string()],
            )),
            None => Err("adb-logcat requires a selected serial".to_string()),
        },
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
        },
        "adb-network-settings" => match serial.clone() {
            Some(serial) => crate::adb_workflows::adb_open_network_settings(serial).map(|r| (
                r.message,
                r.verified,
                vec![r.evidence_source.to_string()],
            )),
            None => Err("Network settings requires a selected serial".to_string()),
        },
        "adb-factory-reset-settings" => match serial.clone() {
            Some(serial) => crate::adb_workflows::adb_open_factory_reset_settings(serial).map(|r| (
                r.message,
                r.verified,
                vec![r.evidence_source.to_string()],
            )),
            None => Err("Factory reset settings requires a selected serial".to_string()),
        },
        _ => Err("Workflow dispatch mismatch".to_string()),
    };

    match result {
        Ok((summary, verified, evidence)) => update_success(&id, summary, verified, evidence),
        Err(error) => Ok(update_failure(&id, error)),
    }
}


#[tauri::command]
pub async fn workflow_job_start(
    workflow_id: String,
    serial: Option<String>,
) -> Result<WorkflowJobRecord, String> {
    start_job_internal(workflow_id, serial, None).await
}

#[tauri::command]
pub async fn workflow_job_retry(id: String) -> Result<WorkflowJobRecord, String> {
    let previous = workflow_job_get(id.clone())?;
    if previous.state == "running" {
        return Err("A running workflow job cannot be retried".to_string());
    }
    start_job_internal(previous.workflow_id, previous.serial, Some(id)).await
}
