use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum RiskLevel {
    ReadOnly,
    Low,
    Elevated,
    Destructive,
    Restricted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowPolicy {
    pub id: &'static str,
    pub category: &'static str,
    pub platform: &'static str,
    pub risk: RiskLevel,
    pub authorization_required: bool,
    pub device_identity_verification: bool,
    pub dry_run_supported: bool,
    pub backup_or_rollback_required: bool,
    pub audit_logging_required: bool,
    pub explicit_confirmation_required: bool,
    pub physically_qualified: bool,
    pub active_in_bobfwtools: bool,
    pub notes: &'static str,
}

pub fn workflow_catalog() -> Vec<WorkflowPolicy> {
    vec![
        WorkflowPolicy {
            id: "diagnostics.usb-scan",
            category: "Diagnostics",
            platform: "cross-platform",
            risk: RiskLevel::ReadOnly,
            authorization_required: false,
            device_identity_verification: true,
            dry_run_supported: true,
            backup_or_rollback_required: false,
            audit_logging_required: true,
            explicit_confirmation_required: false,
            physically_qualified: true,
            active_in_bobfwtools: true,
            notes: "Read-only USB enumeration and evidence capture.",
        },
        WorkflowPolicy {
            id: "android.adb-authorized",
            category: "Android/ADB",
            platform: "android",
            risk: RiskLevel::Low,
            authorization_required: true,
            device_identity_verification: true,
            dry_run_supported: true,
            backup_or_rollback_required: false,
            audit_logging_required: true,
            explicit_confirmation_required: false,
            physically_qualified: true,
            active_in_bobfwtools: true,
            notes: "Only authorized ADB devices may execute ADB workflows.",
        },
        WorkflowPolicy {
            id: "samsung.odin-plan",
            category: "Samsung Download Mode",
            platform: "samsung",
            risk: RiskLevel::Elevated,
            authorization_required: true,
            device_identity_verification: true,
            dry_run_supported: true,
            backup_or_rollback_required: true,
            audit_logging_required: true,
            explicit_confirmation_required: true,
            physically_qualified: true,
            active_in_bobfwtools: true,
            notes: "Stock signed Samsung recovery planning; destructive writes require approval.",
        },
        WorkflowPolicy {
            id: "qualcomm.edl-plan",
            category: "Qualcomm EDL",
            platform: "qualcomm",
            risk: RiskLevel::Elevated,
            authorization_required: true,
            device_identity_verification: true,
            dry_run_supported: true,
            backup_or_rollback_required: true,
            audit_logging_required: true,
            explicit_confirmation_required: true,
            physically_qualified: false,
            active_in_bobfwtools: true,
            notes: "OEM/service-authorized Sahara/Firehose path only; no auth bypass or arbitrary unsigned loaders.",
        },
        WorkflowPolicy {
            id: "mediatek.brom-plan",
            category: "MediaTek BROM",
            platform: "mediatek",
            risk: RiskLevel::Elevated,
            authorization_required: true,
            device_identity_verification: true,
            dry_run_supported: true,
            backup_or_rollback_required: true,
            audit_logging_required: true,
            explicit_confirmation_required: true,
            physically_qualified: false,
            active_in_bobfwtools: true,
            notes: "Legitimate Download Agent/authentication path only; no SLA/DAA or BootROM bypass.",
        },
        WorkflowPolicy {
            id: "calibration.backup",
            category: "Recovery",
            platform: "android",
            risk: RiskLevel::Elevated,
            authorization_required: true,
            device_identity_verification: true,
            dry_run_supported: true,
            backup_or_rollback_required: true,
            audit_logging_required: true,
            explicit_confirmation_required: false,
            physically_qualified: false,
            active_in_bobfwtools: true,
            notes: "Read-only backup of allowlisted calibration partitions when legitimate block access exists.",
        },
        WorkflowPolicy {
            id: "calibration.restore",
            category: "Destructive/admin actions",
            platform: "android",
            risk: RiskLevel::Destructive,
            authorization_required: true,
            device_identity_verification: true,
            dry_run_supported: true,
            backup_or_rollback_required: true,
            audit_logging_required: true,
            explicit_confirmation_required: true,
            physically_qualified: false,
            active_in_bobfwtools: true,
            notes: "Same-device restore only. No IMEI editing, identity rewriting, or calibration fabrication.",
        },
        WorkflowPolicy {
            id: "hardware.storage-identify",
            category: "Recovery",
            platform: "hardware-service",
            risk: RiskLevel::Elevated,
            authorization_required: true,
            device_identity_verification: true,
            dry_run_supported: true,
            backup_or_rollback_required: true,
            audit_logging_required: true,
            explicit_confirmation_required: true,
            physically_qualified: false,
            active_in_bobfwtools: true,
            notes: "ISP/JTAG/eMMC/UFS service planning begins read-only and records board/storage evidence before bench work.",
        },
        WorkflowPolicy {
            id: "hardware.chip-off-plan",
            category: "Destructive/admin actions",
            platform: "hardware-service",
            risk: RiskLevel::Destructive,
            authorization_required: true,
            device_identity_verification: true,
            dry_run_supported: true,
            backup_or_rollback_required: true,
            audit_logging_required: true,
            explicit_confirmation_required: true,
            physically_qualified: false,
            active_in_bobfwtools: true,
            notes: "Chip-off/reball planning only; execution requires designated bench procedures and physical qualification.",
        },
        WorkflowPolicy {
            id: "apple.dfu",
            category: "Apple DFU",
            platform: "apple",
            risk: RiskLevel::Elevated,
            authorization_required: true,
            device_identity_verification: true,
            dry_run_supported: true,
            backup_or_rollback_required: true,
            audit_logging_required: true,
            explicit_confirmation_required: true,
            physically_qualified: false,
            active_in_bobfwtools: false,
            notes: "Reserved for future B.U.Tools signed Apple restore lane.",
        },
        WorkflowPolicy {
            id: "bootforge.media",
            category: "BootForge",
            platform: "cross-platform",
            risk: RiskLevel::Destructive,
            authorization_required: true,
            device_identity_verification: true,
            dry_run_supported: true,
            backup_or_rollback_required: true,
            audit_logging_required: true,
            explicit_confirmation_required: true,
            physically_qualified: false,
            active_in_bobfwtools: true,
            notes: "Removable-media provisioning requires target re-identification immediately before each destructive step.",
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_destructive_workflow_requires_confirmation_and_audit() {
        for workflow in workflow_catalog() {
            if matches!(workflow.risk, RiskLevel::Destructive | RiskLevel::Restricted) {
                assert!(workflow.explicit_confirmation_required);
                assert!(workflow.audit_logging_required);
                assert!(workflow.device_identity_verification);
            }
        }
    }

    #[test]
    fn apple_dfu_is_reserved_for_butools() {
        let apple = workflow_catalog().into_iter().find(|w| w.id == "apple.dfu").unwrap();
        assert!(!apple.active_in_bobfwtools);
    }
}
