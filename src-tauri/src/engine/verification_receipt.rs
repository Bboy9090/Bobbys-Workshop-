//! Immutable-in-memory report of independently parsed Android package-manager evidence.
//! This is transport-level observation, never cryptographic APK attestation.
use super::package_verifier::PackageMetadata;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssuranceLevel {
    TransportObservedMetadata,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VerificationOutcome {
    MetadataMatch,
    MetadataMismatch,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PackageVerificationReceipt {
    pub receipt_id: String,
    pub collection_timestamp_epoch_ms: u64,
    pub target_device_serial: String,
    pub package_identity_queried: String,
    pub expected_version_code: u64,
    pub observed_version_code: u64,
    pub optional_installation_path: Option<String>,
    pub assurance_level: AssuranceLevel,
    pub verification_outcome_status: VerificationOutcome,
    pub compliance_disclaimer: String,
}

impl PackageVerificationReceipt {
    /// Only accepts metadata from the independent parser; no caller-provided observed version.
    pub fn from_metadata(serial: &str, expected_version: u64, metadata: &PackageMetadata) -> Result<Self, String> {
        if serial.is_empty() || serial.starts_with('-') || serial.len() > 128 || serial.chars().any(char::is_whitespace) {
            return Err("Invalid target serial for receipt".into());
        }
        if metadata.package_name.is_empty() {
            return Err("Missing parsed package identity".into());
        }
        if metadata.is_verified != (metadata.version_code == expected_version) {
            return Err("Inconsistent parsed metadata verification flag".into());
        }
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH)
            .map_err(|e| format!("System clock precedes Unix epoch: {e}"))?;
        let epoch_ms = u64::try_from(timestamp.as_millis())
            .map_err(|_| "System clock timestamp exceeds u64 range".to_string())?;
        Ok(Self {
            receipt_id: uuid::Uuid::new_v4().to_string(),
            collection_timestamp_epoch_ms: epoch_ms,
            target_device_serial: serial.to_owned(),
            package_identity_queried: metadata.package_name.clone(),
            expected_version_code: expected_version,
            observed_version_code: metadata.version_code,
            optional_installation_path: metadata.code_path.clone(),
            assurance_level: AssuranceLevel::TransportObservedMetadata,
            verification_outcome_status: if metadata.version_code == expected_version {
                VerificationOutcome::MetadataMatch
            } else {
                VerificationOutcome::MetadataMismatch
            },
            compliance_disclaimer: "Read-only Android package-manager metadata observed over an ADB transport. A matching package identity and version code do not establish cryptographic APK integrity, hardware-backed attestation, or successful application launch.".to_owned(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::package_verifier::parse_package_dump;
    const DUMP: &str = "Package [com.example.app] (abc):\n codePath=/data/app/com.example.app/base.apk\n versionCode=9005 minSdk=26\n";

    #[test]
    fn matching_evidence_generates_transport_only_receipt() {
        let metadata = parse_package_dump(DUMP, "com.example.app", 9005).unwrap();
        let receipt = PackageVerificationReceipt::from_metadata("SERIAL_123", 9005, &metadata).unwrap();
        assert_eq!(receipt.verification_outcome_status, VerificationOutcome::MetadataMatch);
        assert_eq!(receipt.assurance_level, AssuranceLevel::TransportObservedMetadata);
        assert_eq!(receipt.observed_version_code, 9005);
        assert!(receipt.collection_timestamp_epoch_ms > 0);
        assert!(receipt.compliance_disclaimer.contains("do not establish cryptographic"));
        let json = serde_json::to_string(&receipt).unwrap();
        assert!(json.contains("transport_observed_metadata"));
        assert!(json.contains("metadata_match"));
    }

    #[test]
    fn mismatch_is_recorded_as_mismatch() {
        let metadata = parse_package_dump(DUMP, "com.example.app", 1002).unwrap();
        let receipt = PackageVerificationReceipt::from_metadata("SERIAL_123", 1002, &metadata).unwrap();
        assert_eq!(receipt.verification_outcome_status, VerificationOutcome::MetadataMismatch);
        assert_eq!(receipt.expected_version_code, 1002);
        assert_eq!(receipt.observed_version_code, 9005);
    }

    #[test]
    fn rejects_inconsistent_metadata_and_invalid_serial() {
        let mut metadata = parse_package_dump(DUMP, "com.example.app", 9005).unwrap();
        metadata.is_verified = false;
        assert!(PackageVerificationReceipt::from_metadata("SERIAL_123", 9005, &metadata).is_err());
        metadata.is_verified = true;
        assert!(PackageVerificationReceipt::from_metadata("-unsafe", 9005, &metadata).is_err());
    }

    #[test]
    fn handles_u64_versions_without_narrowing() {
        let large = u32::MAX as u64 + 1;
        let dump = format!("Package [com.example.app] (abc):\n versionCode={large}\n");
        let metadata = parse_package_dump(&dump, "com.example.app", large).unwrap();
        let receipt = PackageVerificationReceipt::from_metadata("SERIAL_123", large, &metadata).unwrap();
        assert_eq!(receipt.observed_version_code, large);
        assert_eq!(receipt.optional_installation_path, None);
    }
}
