use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFirmwareIdentity {
    pub model: String,
    pub bootloader_revision: Option<u32>,
    pub partition_layout_id: Option<String>,
    pub region_or_csc: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareTargetIdentity {
    pub model: String,
    pub bootloader_revision: Option<u32>,
    pub partition_layout_id: Option<String>,
    pub region_or_csc: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightResult {
    pub allowed: bool,
    pub destructive: bool,
    pub reasons: Vec<String>,
    pub warnings: Vec<String>,
}

pub fn validate_target_match(
    device: &DeviceFirmwareIdentity,
    firmware: &FirmwareTargetIdentity,
    destructive: bool,
) -> PreflightResult {
    let mut reasons = Vec::new();
    let mut warnings = Vec::new();

    if !device.model.eq_ignore_ascii_case(&firmware.model) {
        reasons.push(format!(
            "model mismatch: connected device is {}, firmware targets {}",
            device.model, firmware.model
        ));
    }

    if let (Some(current), Some(target)) = (device.bootloader_revision, firmware.bootloader_revision) {
        if target < current {
            reasons.push(format!(
                "bootloader rollback blocked: current revision {}, target revision {}",
                current, target
            ));
        }
    } else {
        warnings.push("bootloader revision could not be fully compared".to_string());
    }

    if let (Some(current), Some(target)) = (
        device.partition_layout_id.as_ref(),
        firmware.partition_layout_id.as_ref(),
    ) {
        if current != target {
            reasons.push(format!(
                "partition layout mismatch: device {}, firmware {}",
                current, target
            ));
        }
    } else if destructive {
        reasons.push(
            "destructive flash requires both device and firmware partition-layout identifiers"
                .to_string(),
        );
    }

    if let (Some(current), Some(target)) = (
        device.region_or_csc.as_ref(),
        firmware.region_or_csc.as_ref(),
    ) {
        if current != target {
            warnings.push(format!(
                "region/CSC differs: device {}, firmware {}",
                current, target
            ));
        }
    }

    PreflightResult {
        allowed: reasons.is_empty(),
        destructive,
        reasons,
        warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_cross_model_flash() {
        let device = DeviceFirmwareIdentity {
            model: "SM-T500".into(),
            bootloader_revision: Some(4),
            partition_layout_id: Some("PIT-A".into()),
            region_or_csc: None,
        };
        let firmware = FirmwareTargetIdentity {
            model: "SM-T510".into(),
            bootloader_revision: Some(8),
            partition_layout_id: Some("PIT-A".into()),
            region_or_csc: None,
        };
        assert!(!validate_target_match(&device, &firmware, true).allowed);
    }

    #[test]
    fn blocks_bootloader_rollback() {
        let device = DeviceFirmwareIdentity {
            model: "SM-T500".into(),
            bootloader_revision: Some(8),
            partition_layout_id: Some("PIT-A".into()),
            region_or_csc: None,
        };
        let firmware = FirmwareTargetIdentity {
            model: "SM-T500".into(),
            bootloader_revision: Some(4),
            partition_layout_id: Some("PIT-A".into()),
            region_or_csc: None,
        };
        assert!(!validate_target_match(&device, &firmware, false).allowed);
    }
}
