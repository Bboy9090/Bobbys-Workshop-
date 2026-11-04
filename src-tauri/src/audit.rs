use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    pub timestamp_ms: u64,
    pub category: String,
    pub action: String,
    pub risk: String,
    pub status: String,
    pub device_uid: Option<String>,
    pub detail: String,
    pub evidence: Vec<String>,
}

fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn audit_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".bobfwtools")
        .join("logs")
        .join("audit.jsonl")
}

pub fn record(
    category: impl Into<String>,
    action: impl Into<String>,
    risk: impl Into<String>,
    status: impl Into<String>,
    device_uid: Option<String>,
    detail: impl Into<String>,
    evidence: Vec<String>,
) -> Result<AuditEvent, String> {
    let event = AuditEvent {
        timestamp_ms: now_ms(),
        category: category.into(),
        action: action.into(),
        risk: risk.into(),
        status: status.into(),
        device_uid,
        detail: detail.into(),
        evidence,
    };

    let path = audit_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create audit log directory {}: {e}", parent.display()))?;
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Failed to open audit log {}: {e}", path.display()))?;

    let line = serde_json::to_string(&event)
        .map_err(|e| format!("Failed to serialize audit event: {e}"))?;
    writeln!(file, "{line}")
        .map_err(|e| format!("Failed to append audit event: {e}"))?;

    Ok(event)
}

#[tauri::command]
pub fn audit_recent(limit: Option<usize>) -> Result<Vec<AuditEvent>, String> {
    let path = audit_path();
    if !path.exists() {
        return Ok(Vec::new());
    }

    let file = std::fs::File::open(&path)
        .map_err(|e| format!("Failed to open audit log {}: {e}", path.display()))?;
    let reader = BufReader::new(file);

    let mut events = reader
        .lines()
        .filter_map(|line| line.ok())
        .filter_map(|line| serde_json::from_str::<AuditEvent>(&line).ok())
        .collect::<Vec<_>>();

    events.reverse();
    events.truncate(limit.unwrap_or(100).min(500));
    Ok(events)
}

#[tauri::command]
pub fn audit_log_path() -> String {
    audit_path().display().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_serializes() {
        let event = AuditEvent {
            timestamp_ms: 1,
            category: "Diagnostics".into(),
            action: "usb-scan".into(),
            risk: "read-only".into(),
            status: "completed".into(),
            device_uid: None,
            detail: "test".into(),
            evidence: vec!["unit-test".into()],
        };
        assert!(serde_json::to_string(&event).unwrap().contains("usb-scan"));
    }
}
