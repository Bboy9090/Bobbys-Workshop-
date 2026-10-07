use serde::{Deserialize, Serialize};
use std::path::{Component, Path};

pub const CALIBRATION_ALLOWLIST: &[&str] = &[
    "efs",
    "modemst1",
    "modemst2",
    "fsg",
    "fsc",
    "persist",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationPartition {
    pub name: String,
    pub resolved_block_path: String,
    pub expected_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationBackupManifest {
    pub device_uid: String,
    pub model: Option<String>,
    pub serial: Option<String>,
    pub partition: String,
    pub source_block_path: String,
    pub bytes: u64,
    pub sha256: String,
    pub created_at_unix_ms: u64,
}

pub fn is_allowlisted_partition(name: &str) -> bool {
    CALIBRATION_ALLOWLIST.iter().any(|p| p.eq_ignore_ascii_case(name.trim()))
}

pub fn validate_block_path(path: &str) -> bool {
    let p = Path::new(path);
    if !p.is_absolute() {
        return false;
    }
    !p.components().any(|c| matches!(c, Component::ParentDir))
        && path.starts_with("/dev/block/")
}

pub fn validate_restore_binding(
    manifest: &CalibrationBackupManifest,
    current_device_uid: &str,
    partition: &str,
    actual_bytes: u64,
    actual_sha256: &str,
) -> Result<(), String> {
    if !is_allowlisted_partition(partition) {
        return Err("partition is not in the calibration restore allowlist".to_string());
    }
    if manifest.device_uid != current_device_uid {
        return Err("backup belongs to a different physical device".to_string());
    }
    if !manifest.partition.eq_ignore_ascii_case(partition) {
        return Err("backup partition does not match requested restore target".to_string());
    }
    if manifest.bytes != actual_bytes {
        return Err("backup byte length does not match manifest".to_string());
    }
    if !manifest.sha256.eq_ignore_ascii_case(actual_sha256) {
        return Err("backup SHA-256 does not match manifest".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_calibration_partition() {
        assert!(!is_allowlisted_partition("userdata"));
        assert!(is_allowlisted_partition("efs"));
    }

    #[test]
    fn same_device_binding_is_required() {
        let m = CalibrationBackupManifest {
            device_uid: "usb:one".into(),
            model: Some("TEST".into()),
            serial: None,
            partition: "efs".into(),
            source_block_path: "/dev/block/by-name/efs".into(),
            bytes: 4096,
            sha256: "abc".into(),
            created_at_unix_ms: 0,
        };
        assert!(validate_restore_binding(&m, "usb:two", "efs", 4096, "abc").is_err());
    }
}
