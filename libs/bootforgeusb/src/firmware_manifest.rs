use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

use crate::firmware_catalog::match_chipsets;

pub const FIRMWARE_MANIFEST_SCHEMA: &str = "bobfwtools-firmware-v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareManifestArtifact {
    pub path: String,
    pub sha256: String,
    pub role: String,
    pub bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareManifest {
    pub schema: String,
    pub vendor: String,
    pub chipset: String,
    pub oem: String,
    pub models: Vec<String>,
    pub variants: Vec<String>,
    pub regions: Vec<String>,
    pub build_id: String,
    pub bootloader_revision: Option<String>,
    pub source_kind: String,
    pub source_reference: String,
    pub artifacts: Vec<FirmwareManifestArtifact>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFirmwareIdentity {
    pub vendor: Option<String>,
    pub chipset: Option<String>,
    pub oem: Option<String>,
    pub model: Option<String>,
    pub variant: Option<String>,
    pub region: Option<String>,
    pub bootloader_revision: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareCompatibilityReport {
    pub manifest_valid: bool,
    pub identity_complete: bool,
    pub candidate_compatible: bool,
    pub execution_authorized: bool,
    pub matched_fields: Vec<String>,
    pub blockers: Vec<String>,
    pub warnings: Vec<String>,
}

fn normalize(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

fn contains_normalized(values: &[String], needle: &str) -> bool {
    let needle = normalize(needle);
    values.iter().any(|value| normalize(value) == needle)
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn safe_relative_path(value: &str) -> bool {
    let path = std::path::Path::new(value);
    !path.is_absolute()
        && !value.trim().is_empty()
        && !path.components().any(|component| {
            matches!(
                component,
                std::path::Component::ParentDir
                    | std::path::Component::RootDir
                    | std::path::Component::Prefix(_)
            )
        })
}

pub fn validate_manifest(manifest: &FirmwareManifest) -> Result<(), Vec<String>> {
    let mut errors = Vec::new();

    if manifest.schema != FIRMWARE_MANIFEST_SCHEMA {
        errors.push(format!(
            "unsupported firmware manifest schema: {}",
            manifest.schema
        ));
    }

    let vendor = normalize(&manifest.vendor);
    if !matches!(vendor.as_str(), "qualcomm" | "mediatek") {
        errors.push("vendor must be qualcomm or mediatek".into());
    }

    if manifest.oem.trim().len() < 2 {
        errors.push("OEM identity is required".into());
    }
    if manifest.models.is_empty() || manifest.models.iter().all(|model| model.trim().is_empty()) {
        errors.push("at least one exact commercial model is required".into());
    }
    if manifest.build_id.trim().is_empty() {
        errors.push("firmware build ID is required".into());
    }
    if manifest.source_reference.trim().len() < 3 {
        errors.push("firmware provenance/source reference is required".into());
    }

    let source_kind = normalize(&manifest.source_kind);
    if !matches!(
        source_kind.as_str(),
        "officialoem" | "authorizedservice" | "operatorimport" | "userarchive"
    ) {
        errors.push(
            "sourceKind must be official-oem, authorized-service, operator-import, or user-archive"
                .into(),
        );
    }

    let chipset_matches = match_chipsets(&manifest.chipset);
    if chipset_matches.is_empty() {
        errors.push(format!("unknown chipset alias: {}", manifest.chipset));
    } else if !chipset_matches
        .iter()
        .any(|profile| normalize(&profile.vendor) == vendor)
    {
        errors.push("chipset resolves to a different vendor than manifest.vendor".into());
    }

    if manifest.artifacts.is_empty() {
        errors.push("manifest must list at least one firmware artifact".into());
    }

    let mut seen_paths = BTreeSet::new();
    for artifact in &manifest.artifacts {
        if !safe_relative_path(&artifact.path) {
            errors.push(format!(
                "artifact path must be safe and relative: {}",
                artifact.path
            ));
        }
        if !seen_paths.insert(normalize(&artifact.path)) {
            errors.push(format!("duplicate artifact path: {}", artifact.path));
        }
        if !is_sha256(&artifact.sha256) {
            errors.push(format!(
                "artifact SHA-256 must contain 64 hex characters: {}",
                artifact.path
            ));
        }
        if artifact.role.trim().is_empty() {
            errors.push(format!("artifact role is missing: {}", artifact.path));
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

pub fn compare_manifest_to_device(
    manifest: &FirmwareManifest,
    device: &DeviceFirmwareIdentity,
) -> FirmwareCompatibilityReport {
    let mut matched_fields = Vec::new();
    let mut blockers = Vec::new();
    let mut warnings = Vec::new();

    let manifest_valid = validate_manifest(manifest).is_ok();
    if !manifest_valid {
        blockers.push("firmware manifest is invalid".into());
    }

    let identity_complete = device.oem.as_deref().map(str::trim).filter(|v| !v.is_empty()).is_some()
        && device.model.as_deref().map(str::trim).filter(|v| !v.is_empty()).is_some()
        && device.chipset.as_deref().map(str::trim).filter(|v| !v.is_empty()).is_some();

    if !identity_complete {
        blockers.push("device identity is incomplete; OEM, model, and chipset are required".into());
    }

    if let Some(vendor) = device.vendor.as_deref() {
        if normalize(vendor) == normalize(&manifest.vendor) {
            matched_fields.push("vendor".into());
        } else {
            blockers.push(format!(
                "vendor mismatch: device={} package={}",
                vendor, manifest.vendor
            ));
        }
    }

    if let Some(oem) = device.oem.as_deref() {
        if normalize(oem) == normalize(&manifest.oem) {
            matched_fields.push("oem".into());
        } else {
            blockers.push(format!(
                "OEM mismatch: device={} package={}",
                oem, manifest.oem
            ));
        }
    }

    if let Some(model) = device.model.as_deref() {
        if contains_normalized(&manifest.models, model) {
            matched_fields.push("model".into());
        } else {
            blockers.push(format!(
                "exact model mismatch: device={} package models={}",
                model,
                manifest.models.join(", ")
            ));
        }
    }

    if let Some(chipset) = device.chipset.as_deref() {
        let package_matches = match_chipsets(&manifest.chipset);
        let device_matches = match_chipsets(chipset);
        let compatible = package_matches.iter().any(|package| {
            device_matches.iter().any(|device_profile| {
                normalize(&package.vendor) == normalize(&device_profile.vendor)
                    && normalize(&package.family) == normalize(&device_profile.family)
            })
        });
        if compatible {
            matched_fields.push("chipset".into());
        } else {
            blockers.push(format!(
                "chipset mismatch: device={} package={}",
                chipset, manifest.chipset
            ));
        }
    }

    if let Some(variant) = device.variant.as_deref().filter(|value| !value.trim().is_empty()) {
        if manifest.variants.is_empty() {
            warnings.push("device variant is known but package manifest does not constrain variants".into());
        } else if contains_normalized(&manifest.variants, variant) {
            matched_fields.push("variant".into());
        } else {
            blockers.push(format!(
                "variant mismatch: device={} package variants={}",
                variant,
                manifest.variants.join(", ")
            ));
        }
    }

    if let Some(region) = device.region.as_deref().filter(|value| !value.trim().is_empty()) {
        if manifest.regions.is_empty() {
            warnings.push("device region is known but package manifest does not constrain regions".into());
        } else if contains_normalized(&manifest.regions, region) {
            matched_fields.push("region".into());
        } else {
            blockers.push(format!(
                "region mismatch: device={} package regions={}",
                region,
                manifest.regions.join(", ")
            ));
        }
    }

    if let Some(device_revision) = device
        .bootloader_revision
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        match manifest.bootloader_revision.as_deref() {
            Some(package_revision)
                if normalize(package_revision) == normalize(device_revision) =>
            {
                matched_fields.push("bootloaderRevision".into());
            }
            Some(package_revision) => blockers.push(format!(
                "bootloader revision mismatch: device={} package={}",
                device_revision, package_revision
            )),
            None => warnings.push(
                "device bootloader revision is known but package manifest does not declare one"
                    .into(),
            ),
        }
    }

    let candidate_compatible = manifest_valid && identity_complete && blockers.is_empty();

    // A package manifest proves identity/provenance metadata only. Loader/DA
    // authorization, backup readiness, physical qualification, and explicit
    // approval remain independent release gates.
    let execution_authorized = false;
    if candidate_compatible {
        warnings.push(
            "identity compatibility does not authorize execution; service-loader authorization and physical qualification still apply"
                .into(),
        );
    }

    FirmwareCompatibilityReport {
        manifest_valid,
        identity_complete,
        candidate_compatible,
        execution_authorized,
        matched_fields,
        blockers,
        warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manifest() -> FirmwareManifest {
        FirmwareManifest {
            schema: FIRMWARE_MANIFEST_SCHEMA.into(),
            vendor: "qualcomm".into(),
            chipset: "SM8550".into(),
            oem: "ExampleOEM".into(),
            models: vec!["EX-100".into()],
            variants: vec!["global".into()],
            regions: vec!["US".into()],
            build_id: "EX100_14.0.1".into(),
            bootloader_revision: Some("5".into()),
            source_kind: "official-oem".into(),
            source_reference: "OEM support package EX100_14.0.1".into(),
            artifacts: vec![FirmwareManifestArtifact {
                path: "rawprogram0.xml".into(),
                sha256: "a".repeat(64),
                role: "rawprogram".into(),
                bytes: Some(123),
            }],
        }
    }

    #[test]
    fn validates_exact_manifest_contract() {
        assert!(validate_manifest(&manifest()).is_ok());
    }

    #[test]
    fn rejects_parent_directory_artifact_paths() {
        let mut value = manifest();
        value.artifacts[0].path = "../outside.img".into();
        assert!(validate_manifest(&value).is_err());
    }

    #[test]
    fn exact_device_match_is_candidate_only_not_execution_authority() {
        let report = compare_manifest_to_device(
            &manifest(),
            &DeviceFirmwareIdentity {
                vendor: Some("Qualcomm".into()),
                chipset: Some("Snapdragon 8 Gen 2".into()),
                oem: Some("ExampleOEM".into()),
                model: Some("EX-100".into()),
                variant: Some("global".into()),
                region: Some("US".into()),
                bootloader_revision: Some("5".into()),
            },
        );
        assert!(report.candidate_compatible);
        assert!(!report.execution_authorized);
    }

    #[test]
    fn wrong_model_blocks_candidate() {
        let report = compare_manifest_to_device(
            &manifest(),
            &DeviceFirmwareIdentity {
                vendor: Some("qualcomm".into()),
                chipset: Some("SM8550".into()),
                oem: Some("ExampleOEM".into()),
                model: Some("EX-200".into()),
                variant: None,
                region: None,
                bootloader_revision: None,
            },
        );
        assert!(!report.candidate_compatible);
        assert!(report.blockers.iter().any(|value| value.contains("model mismatch")));
    }
}
