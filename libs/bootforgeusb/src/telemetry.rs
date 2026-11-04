use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationTelemetry {
    pub workflow_id: String,
    pub device_uid: String,
    pub started_at_unix_ms: u64,
    pub finished_at_unix_ms: Option<u64>,
    pub exit_code: Option<i32>,
    pub state_before: Option<String>,
    pub state_after: Option<String>,
    pub stdout_log_path: Option<String>,
    pub stderr_log_path: Option<String>,
    pub success_markers: Vec<String>,
    pub failure_markers: Vec<String>,
    pub verified: bool,
}

impl OperationTelemetry {
    pub fn clean_exit(&self) -> bool {
        self.exit_code == Some(0)
            && self.failure_markers.is_empty()
            && self.finished_at_unix_ms.is_some()
    }

    pub fn post_state_transition_verified(&self) -> bool {
        self.clean_exit()
            && self.state_before.is_some()
            && self.state_after.is_some()
            && self.state_before != self.state_after
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_exit_requires_zero_code_and_finished_state() {
        let t = OperationTelemetry {
            workflow_id: "test".into(),
            device_uid: "usb:test".into(),
            started_at_unix_ms: 1,
            finished_at_unix_ms: Some(2),
            exit_code: Some(0),
            state_before: Some("download".into()),
            state_after: Some("android".into()),
            stdout_log_path: None,
            stderr_log_path: None,
            success_markers: vec!["ok".into()],
            failure_markers: vec![],
            verified: true,
        };
        assert!(t.clean_exit());
        assert!(t.post_state_transition_verified());
    }
}
