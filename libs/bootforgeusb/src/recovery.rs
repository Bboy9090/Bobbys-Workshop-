use crate::transport::TransportDevice;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum RecoveryError {
    #[error("unsupported recovery workflow: {0}")]
    UnsupportedWorkflow(String),
    #[error("artifact does not exist: {0}")]
    MissingArtifact(String),
    #[error("artifact is blocked by the repair safety policy: {0}")]
    BlockedArtifact(String),
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum RecoveryKind {
    QualcommEdl,
    MediatekDownload,
}

impl RecoveryKind {
    pub fn parse(input: &str) -> Result<Self, RecoveryError> {
        match input.to_ascii_lowercase().as_str() {
            "edl" | "qualcomm-edl" | "qualcomm" => Ok(Self::QualcommEdl),
            "mtk" | "mediatek" | "download" | "preloader" | "mediatek-download" => {
                Ok(Self::MediatekDownload)
            }
            other => Err(RecoveryError::UnsupportedWorkflow(other.to_string())),
        }
    }

    pub fn protocol(self) -> &'static str {
        match self {
            Self::QualcommEdl => "qualcomm-sahara-firehose",
            Self::MediatekDownload => "mediatek-download-agent",
        }
    }

    pub fn required_mode(self) -> &'static str {
        match self {
            Self::QualcommEdl => "qualcomm-edl",
            Self::MediatekDownload => "mediatek-brom-or-preloader",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryCandidate {
    pub device_uid: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub detected_mode: String,
    pub workflow: RecoveryKind,
    pub product_name: Option<String>,
    pub serial_number: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryArtifact {
    pub path: String,
    pub role: String,
    pub size: u64,
    pub structurally_valid: bool,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryPlan {
    pub workflow: RecoveryKind,
    pub protocol: String,
    pub mode_required: String,
    pub execution_enabled: bool,
    pub destructive: bool,
    pub requires_explicit_approval: bool,
    pub requires_vendor_authentication: bool,
    pub artifacts: Vec<RecoveryArtifact>,
    pub prerequisites_met: bool,
    pub missing_prerequisites: Vec<String>,
    pub safety_checks: Vec<String>,
    pub warnings: Vec<String>,
}

fn blocked_name(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    [
        "bypass",
        "exploit",
        "checkm8",
        "bootrom-pwn",
        "auth-bypass",
        "sla-bypass",
        "daa-bypass",
    ]
    .iter()
    .any(|needle| name.contains(needle))
}

fn classify_edl(path: &Path) -> String {
    let name = path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if name.starts_with("rawprogram") && name.ends_with(".xml") {
        "rawprogram"
    } else if name.starts_with("patch") && name.ends_with(".xml") {
        "patch"
    } else if name.contains("firehose")
        || name.contains("prog_emmc")
        || name.contains("prog_ufs")
        || name.ends_with(".mbn")
        || name.ends_with(".elf")
    {
        "signed-programmer"
    } else {
        "supporting"
    }
    .to_string()
}

fn classify_mtk(path: &Path) -> String {
    let name = path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if name.contains("scatter") && name.ends_with(".txt") {
        "scatter"
    } else if name.contains("download_agent") || name.starts_with("da_") || name == "da.bin" {
        "download-agent"
    } else if name.ends_with(".auth") || name.contains("auth_sv5") {
        "auth-file"
    } else {
        "supporting"
    }
    .to_string()
}

fn inspect_artifact(kind: RecoveryKind, path: PathBuf) -> Result<RecoveryArtifact, RecoveryError> {
    if !path.exists() {
        return Err(RecoveryError::MissingArtifact(path.display().to_string()));
    }
    if blocked_name(&path) {
        return Err(RecoveryError::BlockedArtifact(path.display().to_string()));
    }
    let size = path
        .metadata()
        .map_err(|_| RecoveryError::MissingArtifact(path.display().to_string()))?
        .len();
    match kind {
        RecoveryKind::QualcommEdl => Ok(RecoveryArtifact {
            path: path.display().to_string(),
            role: classify_edl(&path),
            size,
            structurally_valid: size > 0,
            notes: vec!["Programmer authenticity/signature must be accepted by the target device during the authenticated EDL session.".to_string()],
        }),
        RecoveryKind::MediatekDownload => Ok(RecoveryArtifact {
            path: path.display().to_string(),
            role: classify_mtk(&path),
            size,
            structurally_valid: size > 0,
            notes: vec!["DA/auth compatibility must be verified against the target chipset and security policy before execution.".to_string()],
        }),
    }
}

pub fn scan_recovery_candidates(devices: &[TransportDevice]) -> Vec<RecoveryCandidate> {
    devices
        .iter()
        .filter_map(|d| {
            let workflow = match d.mode.as_str() {
                "qualcomm-edl" => RecoveryKind::QualcommEdl,
                "mediatek-brom" | "mediatek-preloader" => RecoveryKind::MediatekDownload,
                _ => return None,
            };
            Some(RecoveryCandidate {
                device_uid: d.device_uid.clone(),
                vendor_id: d.vendor_id,
                product_id: d.product_id,
                detected_mode: d.mode.clone(),
                workflow,
                product_name: d.product_name.clone(),
                serial_number: d.serial_number.clone(),
            })
        })
        .collect()
}

pub fn build_recovery_plan(
    kind: RecoveryKind,
    paths: Vec<PathBuf>,
) -> Result<RecoveryPlan, RecoveryError> {
    let artifacts: Vec<RecoveryArtifact> = paths
        .into_iter()
        .map(|p| inspect_artifact(kind, p))
        .collect::<Result<_, _>>()?;
    let roles: Vec<&str> = artifacts.iter().map(|a| a.role.as_str()).collect();
    let mut missing = Vec::new();
    let mut warnings = Vec::new();
    let requires_vendor_authentication = matches!(
        kind,
        RecoveryKind::QualcommEdl | RecoveryKind::MediatekDownload
    );

    match kind {
        RecoveryKind::QualcommEdl => {
            if !roles.contains(&"signed-programmer") {
                missing.push("OEM-authorized/signed Firehose programmer".to_string());
            }
            if !roles.contains(&"rawprogram") {
                missing.push("rawprogram XML".to_string());
            }
            if !roles.contains(&"patch") {
                warnings.push(
                    "No patch XML supplied; some OEM packages do not require one.".to_string(),
                );
            }
        }
        RecoveryKind::MediatekDownload => {
            if !roles.contains(&"scatter") {
                missing.push("chipset/device-matched scatter file".to_string());
            }
            if !roles.contains(&"download-agent") {
                missing.push("vendor-compatible Download Agent".to_string());
            }
            if !roles.contains(&"auth-file") {
                warnings.push("No auth file supplied; authenticated devices must use the OEM/service authentication path.".to_string());
            }
        }
    }

    Ok(RecoveryPlan {
        workflow: kind,
        protocol: kind.protocol().to_string(),
        mode_required: kind.required_mode().to_string(),
        execution_enabled: false,
        destructive: true,
        requires_explicit_approval: true,
        requires_vendor_authentication,
        artifacts,
        prerequisites_met: missing.is_empty(),
        missing_prerequisites: missing,
        safety_checks: vec![
            "Re-enumerate and re-identify the exact physical device immediately before any write.".to_string(),
            "Record USB VID/PID, serial/evidence, chipset mode, and selected artifact hashes in the job ledger.".to_string(),
            "Reject arbitrary unsigned loaders, authentication bypasses, BootROM exploits, and security-state bypass attempts.".to_string(),
            "Validate target-specific partition/layout metadata before destructive writes.".to_string(),
            "Require explicit operator approval after the final device/artifact preflight.".to_string(),
            "Stop on transport reset, identity drift, unexpected security response, or partition mismatch.".to_string(),
        ],
        warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn edl_plan_requires_signed_programmer_and_rawprogram() {
        let dir = tempfile::tempdir().unwrap();
        let programmer = dir.path().join("prog_firehose_test.elf");
        let rawprogram = dir.path().join("rawprogram0.xml");
        std::fs::write(&programmer, b"signed-placeholder-for-structure-test").unwrap();
        std::fs::write(&rawprogram, b"<data/>").unwrap();
        let plan =
            build_recovery_plan(RecoveryKind::QualcommEdl, vec![programmer, rawprogram]).unwrap();
        assert!(plan.prerequisites_met);
        assert!(!plan.execution_enabled);
        assert!(plan.requires_vendor_authentication);
    }

    #[test]
    fn blocks_bypass_named_artifacts() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("auth-bypass.bin");
        std::fs::write(&file, b"x").unwrap();
        assert!(matches!(
            build_recovery_plan(RecoveryKind::MediatekDownload, vec![file]),
            Err(RecoveryError::BlockedArtifact(_))
        ));
    }
}
