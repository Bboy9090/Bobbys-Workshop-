use crate::calibration::{is_allowlisted_partition, CalibrationPartition};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationBackupPlan {
    pub device_uid: String,
    pub authorized: bool,
    pub root_or_service_access_verified: bool,
    pub dry_run: bool,
    pub partitions: Vec<CalibrationPartition>,
    pub blocked: Vec<String>,
    pub warnings: Vec<String>,
}

pub fn build_backup_plan(
    device_uid: String,
    authorized: bool,
    root_or_service_access_verified: bool,
    dry_run: bool,
    partitions: Vec<CalibrationPartition>,
) -> CalibrationBackupPlan {
    let mut blocked = Vec::new();
    let mut warnings = Vec::new();

    if !authorized {
        blocked.push("operator/device authorization is required".to_string());
    }
    if !root_or_service_access_verified {
        blocked.push(
            "verified root, recovery, or OEM/service block-read access is required".to_string(),
        );
    }
    if partitions.is_empty() {
        blocked.push("at least one calibration partition must be selected".to_string());
    }

    for partition in &partitions {
        if !is_allowlisted_partition(&partition.name) {
            blocked.push(format!(
                "{} is not in the calibration backup allowlist",
                partition.name
            ));
        }
        if partition.expected_bytes.is_none() {
            warnings.push(format!(
                "{} has no expected byte length yet; size must be recorded before backup completes",
                partition.name
            ));
        }
    }

    CalibrationBackupPlan {
        device_uid,
        authorized,
        root_or_service_access_verified,
        dry_run,
        partitions,
        blocked,
        warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_fails_without_authorization() {
        let plan = build_backup_plan(
            "usb:test".into(),
            false,
            true,
            true,
            vec![CalibrationPartition {
                name: "efs".into(),
                resolved_block_path: "/dev/block/by-name/efs".into(),
                expected_bytes: Some(4096),
            }],
        );
        assert!(!plan.blocked.is_empty());
    }
}
