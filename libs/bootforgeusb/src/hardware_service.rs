use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum StorageTechnology {
    Emmc,
    Ufs,
    Unknown,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum HardwareAccessMethod {
    Isp,
    Jtag,
    ChipOff,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareServiceProfile {
    pub profile_id: String,
    pub manufacturer: Option<String>,
    pub model: String,
    pub board_revision: Option<String>,
    pub storage: StorageTechnology,
    pub access_method: HardwareAccessMethod,
    pub expected_capacity_bytes: Option<u64>,
    pub requires_microsoldering: bool,
    pub read_only_first: bool,
    pub authorized: bool,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareServiceValidation {
    pub allowed_to_plan: bool,
    pub destructive_risk: bool,
    pub blockers: Vec<String>,
    pub warnings: Vec<String>,
}

pub fn validate_profile(profile: &HardwareServiceProfile) -> HardwareServiceValidation {
    let mut blockers = Vec::new();
    let mut warnings = Vec::new();

    if profile.profile_id.trim().is_empty() {
        blockers.push("profile ID is required".to_string());
    }
    if profile.model.trim().is_empty() {
        blockers.push("device model is required".to_string());
    }
    if !profile.authorized {
        blockers.push("operator/device authorization is required".to_string());
    }
    if !profile.read_only_first {
        blockers.push("hardware service workflows must begin with read-only identification/verification".to_string());
    }
    if profile.expected_capacity_bytes.is_none() {
        warnings.push("expected storage capacity is not recorded yet".to_string());
    }
    if matches!(profile.storage, StorageTechnology::Unknown) {
        warnings.push("storage technology is unknown".to_string());
    }

    let destructive_risk = matches!(profile.access_method, HardwareAccessMethod::ChipOff)
        || profile.requires_microsoldering;

    HardwareServiceValidation {
        allowed_to_plan: blockers.is_empty(),
        destructive_risk,
        blockers,
        warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chip_off_is_flagged_destructive() {
        let profile = HardwareServiceProfile {
            profile_id: "test".into(),
            manufacturer: None,
            model: "Example".into(),
            board_revision: None,
            storage: StorageTechnology::Ufs,
            access_method: HardwareAccessMethod::ChipOff,
            expected_capacity_bytes: Some(128 * 1024 * 1024),
            requires_microsoldering: true,
            read_only_first: true,
            authorized: true,
            notes: vec![],
        };
        let result = validate_profile(&profile);
        assert!(result.allowed_to_plan);
        assert!(result.destructive_risk);
    }

    #[test]
    fn refuses_unapproved_service_profile() {
        let profile = HardwareServiceProfile {
            profile_id: "test".into(),
            manufacturer: None,
            model: "Example".into(),
            board_revision: None,
            storage: StorageTechnology::Emmc,
            access_method: HardwareAccessMethod::Isp,
            expected_capacity_bytes: None,
            requires_microsoldering: true,
            read_only_first: true,
            authorized: false,
            notes: vec![],
        };
        assert!(!validate_profile(&profile).allowed_to_plan);
    }
}
