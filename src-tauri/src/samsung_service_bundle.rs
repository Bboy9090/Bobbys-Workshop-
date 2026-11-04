use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use crate::firmware_library::firmware_library_scan;

const SERVICE_SCHEMA: &str = "com.bobbyblanco.bobfwtools.samsung-service-bundle.v1";
const SERVICE_MANIFEST_NAME: &str = "bobfwtools-samsung-service.json";
const HASH_MANIFEST_NAME: &str = "hashes.sha256";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SamsungServiceBundleCreateInput {
    pub directory: String,
    pub model: String,
    pub build_version: String,
    pub bootloader_revision: String,
    pub pit_filename: String,
    pub transport_tool: String,
    pub transport_tool_sha256: String,
    pub evidence_reference: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SamsungServiceArtifact {
    role: String,
    relative_path: String,
    sha256: String,
    bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SamsungServicePolicy {
    purpose: &'static str,
    stock_only: bool,
    exact_model_required: bool,
    bootloader_rollback_blocked: bool,
    pit_identity_required: bool,
    clean_csc_required: bool,
    physical_device_confirmation_required: bool,
    account_lock_bypass_supported: bool,
    execution_authorized: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SamsungServiceTransport {
    protocol: &'static str,
    backend: &'static str,
    tool: String,
    tool_sha256: String,
    endpoint_reset_before_handshake: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SamsungServiceManifest {
    schema: &'static str,
    vendor: &'static str,
    model: String,
    build_version: String,
    bootloader_revision: String,
    pit_filename: String,
    transport: SamsungServiceTransport,
    policy: SamsungServicePolicy,
    evidence_reference: Option<String>,
    artifacts: Vec<SamsungServiceArtifact>,
    bundle_fingerprint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SamsungServiceBundleCreateResult {
    pub manifest_path: String,
    pub hashes_path: String,
    pub model: String,
    pub build_version: String,
    pub bootloader_revision: String,
    pub pit_filename: String,
    pub artifacts_bound: usize,
    pub bundle_fingerprint: String,
    pub execution_authorized: bool,
}

fn firmware_root() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".bobfwtools")
        .join("firmware")
}

fn safe_relative_directory(value: &str) -> Result<String, String> {
    let normalized = value.trim().replace('\\', "/");
    if normalized.is_empty()
        || normalized.starts_with('/')
        || normalized
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err(
            "Samsung service bundle directory must be a safe managed-library relative path".into(),
        );
    }
    Ok(normalized)
}

fn safe_basename(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty()
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed == "."
        || trimmed == ".."
    {
        return Err(format!(
            "{label} must be a filename inside the selected firmware bundle"
        ));
    }
    Ok(trimmed.to_string())
}

fn normalized_model(value: &str) -> Result<String, String> {
    let model = value.trim().to_ascii_uppercase();
    if model.is_empty()
        || !model.starts_with("SM-")
        || !model
            .bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'-')
    {
        return Err("Samsung service bundle requires an exact SM-* model identifier".into());
    }
    Ok(model)
}

fn revision_rank(value: &str) -> Option<u32> {
    let normalized = value.trim().to_ascii_uppercase();
    if normalized.chars().all(|c| c.is_ascii_digit()) && !normalized.is_empty() {
        return normalized.parse::<u32>().ok();
    }
    if normalized.len() == 1 {
        let c = normalized.as_bytes()[0];
        if c.is_ascii_uppercase() {
            return Some(10 + u32::from(c - b'A'));
        }
    }
    None
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|b| b.is_ascii_hexdigit())
}

fn prohibited_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    [
        "frp",
        "bypass",
        "unlock",
        "mdm-remove",
        "mdm_remove",
        "auth-bypass",
        "auth_bypass",
        "sla-bypass",
        "sla_bypass",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
}

fn classify_stock_artifact(name: &str, pit_filename: &str) -> Option<&'static str> {
    if name == pit_filename {
        return Some("pit");
    }
    let upper = name.to_ascii_uppercase();
    if upper.starts_with("BL_") && upper.ends_with(".TAR.MD5") {
        Some("bl")
    } else if upper.starts_with("AP_") && upper.ends_with(".TAR.MD5") {
        Some("ap")
    } else if upper.starts_with("CSC_")
        && !upper.starts_with("HOME_CSC_")
        && upper.ends_with(".TAR.MD5")
    {
        Some("csc")
    } else {
        None
    }
}

fn canonical_bundle_fingerprint(
    model: &str,
    build_version: &str,
    bootloader_revision: &str,
    pit_filename: &str,
    tool: &str,
    tool_sha256: &str,
    artifacts: &[SamsungServiceArtifact],
) -> Result<String, String> {
    let material = serde_json::json!({
        "schema": SERVICE_SCHEMA,
        "model": model,
        "buildVersion": build_version,
        "bootloaderRevision": bootloader_revision,
        "pitFilename": pit_filename,
        "transport": {
            "protocol": "odin/loke",
            "backend": "nusb",
            "tool": tool,
            "toolSha256": tool_sha256,
            "endpointResetBeforeHandshake": false
        },
        "policy": {
            "purpose": "stock-recovery-and-diagnostics",
            "stockOnly": true,
            "exactModelRequired": true,
            "bootloaderRollbackBlocked": true,
            "pitIdentityRequired": true,
            "cleanCscRequired": true,
            "physicalDeviceConfirmationRequired": true,
            "accountLockBypassSupported": false,
            "executionAuthorized": false
        },
        "artifacts": artifacts,
    });
    let bytes = serde_json::to_vec(&material)
        .map_err(|e| format!("failed canonicalizing Samsung service bundle evidence: {e}"))?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

#[tauri::command]
pub fn samsung_service_bundle_create(
    input: SamsungServiceBundleCreateInput,
) -> Result<SamsungServiceBundleCreateResult, String> {
    let directory = safe_relative_directory(&input.directory)?;
    let model = normalized_model(&input.model)?;
    let build_version = input.build_version.trim().to_ascii_uppercase();
    if build_version.is_empty() {
        return Err("Samsung service bundle requires an explicit stock build version".into());
    }
    let bootloader_revision = input.bootloader_revision.trim().to_ascii_uppercase();
    if revision_rank(&bootloader_revision).is_none() {
        return Err("Samsung service bundle requires a normalized bootloader revision".into());
    }
    let pit_filename = safe_basename(&input.pit_filename, "PIT filename")?;
    if !pit_filename.to_ascii_lowercase().ends_with(".pit") {
        return Err("Samsung service bundle PIT filename must end in .pit".into());
    }
    let transport_tool = input.transport_tool.trim().to_string();
    if transport_tool.is_empty() {
        return Err("Samsung service bundle requires an identified transport tool".into());
    }
    let tool_sha256 = input.transport_tool_sha256.trim().to_ascii_lowercase();
    if !valid_sha256(&tool_sha256) {
        return Err("Samsung service bundle transport tool must be bound by SHA-256".into());
    }

    let root = firmware_root();
    fs::create_dir_all(root.join("samsung"))
        .map_err(|e| format!("failed creating Samsung firmware directory: {e}"))?;
    let root = fs::canonicalize(&root)
        .map_err(|e| format!("failed canonicalizing managed firmware root: {e}"))?;
    let package = fs::canonicalize(root.join(&directory))
        .map_err(|e| format!("selected Samsung firmware bundle does not exist: {e}"))?;
    if !package.starts_with(&root) {
        return Err("selected Samsung service bundle escaped the managed firmware root".into());
    }

    let report = firmware_library_scan()?;
    let bundle = report
        .bundles
        .iter()
        .find(|bundle| bundle.directory.replace('\\', "/") == directory)
        .ok_or_else(|| {
            "selected Samsung firmware bundle is no longer present in the managed library"
                .to_string()
        })?;

    if bundle.vendor_hint != "samsung" {
        return Err("selected service bundle is not identified as Samsung firmware".into());
    }
    if !bundle.planning_ready || !bundle.provenance_valid || !bundle.exact_identity_present {
        return Err(format!(
            "Samsung service bundle requires planning-ready exact provenance: {}",
            bundle.warnings.join(" | ")
        ));
    }
    if bundle
        .model
        .as_deref()
        .map(normalized_model)
        .transpose()?
        .as_deref()
        != Some(model.as_str())
    {
        return Err(
            "Samsung service bundle model does not match managed firmware provenance".into(),
        );
    }
    if bundle
        .build_version
        .as_deref()
        .map(|v| v.trim().to_ascii_uppercase())
        .as_deref()
        != Some(build_version.as_str())
    {
        return Err(
            "Samsung service bundle build version does not match managed firmware provenance"
                .into(),
        );
    }
    if bundle
        .bootloader_revision
        .as_deref()
        .map(|v| v.trim().to_ascii_uppercase())
        .as_deref()
        != Some(bootloader_revision.as_str())
    {
        return Err(
            "Samsung service bundle bootloader revision does not match managed firmware provenance"
                .into(),
        );
    }

    let tool_entry = report
        .entries
        .iter()
        .find(|entry| {
            Path::new(&entry.relative_path)
                .parent()
                .map(|p| p.display().to_string().replace('\\', "/"))
                .as_deref()
                == Some(directory.as_str())
                && entry.name == transport_tool
        })
        .ok_or_else(|| {
            "Samsung service bundle transport tool is not present in the managed bundle".to_string()
        })?;
    if tool_entry.sha256.to_ascii_lowercase() != tool_sha256 {
        return Err(
            "Samsung service bundle transport tool hash does not match the managed artifact".into(),
        );
    }

    let mut artifacts = Vec::new();
    let mut roles = BTreeSet::new();
    for entry in report.entries.iter().filter(|entry| {
        Path::new(&entry.relative_path)
            .parent()
            .map(|p| p.display().to_string().replace('\\', "/"))
            .as_deref()
            == Some(directory.as_str())
    }) {
        if prohibited_name(&entry.name) || entry.blocked {
            return Err(format!(
                "Samsung service bundle refuses blocked or lock-bypass-labeled artifact '{}'",
                entry.name
            ));
        }
        let Some(role) = classify_stock_artifact(&entry.name, &pit_filename) else {
            continue;
        };
        roles.insert(role.to_string());
        artifacts.push(SamsungServiceArtifact {
            role: role.to_string(),
            relative_path: entry.name.clone(),
            sha256: entry.sha256.clone(),
            bytes: entry.bytes,
        });
    }

    for required in ["bl", "ap", "csc", "pit"] {
        if !roles.contains(required) {
            return Err(format!(
                "Samsung service bundle is incomplete: missing required stock artifact role '{required}'"
            ));
        }
    }
    if artifacts.iter().filter(|a| a.role == "pit").count() != 1 {
        return Err("Samsung service bundle requires exactly one selected PIT artifact".into());
    }

    artifacts.sort_by(|a, b| {
        a.role
            .cmp(&b.role)
            .then_with(|| a.relative_path.cmp(&b.relative_path))
    });

    let fingerprint = canonical_bundle_fingerprint(
        &model,
        &build_version,
        &bootloader_revision,
        &pit_filename,
        &transport_tool,
        &tool_sha256,
        &artifacts,
    )?;

    let manifest = SamsungServiceManifest {
        schema: SERVICE_SCHEMA,
        vendor: "samsung",
        model: model.clone(),
        build_version: build_version.clone(),
        bootloader_revision: bootloader_revision.clone(),
        pit_filename: pit_filename.clone(),
        transport: SamsungServiceTransport {
            protocol: "odin/loke",
            backend: "nusb",
            tool: transport_tool,
            tool_sha256,
            endpoint_reset_before_handshake: false,
        },
        policy: SamsungServicePolicy {
            purpose: "stock-recovery-and-diagnostics",
            stock_only: true,
            exact_model_required: true,
            bootloader_rollback_blocked: true,
            pit_identity_required: true,
            clean_csc_required: true,
            physical_device_confirmation_required: true,
            account_lock_bypass_supported: false,
            execution_authorized: false,
        },
        evidence_reference: input
            .evidence_reference
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty()),
        artifacts,
        bundle_fingerprint: fingerprint.clone(),
    };

    let manifest_bytes = serde_json::to_vec_pretty(&manifest)
        .map_err(|e| format!("failed serializing Samsung service manifest: {e}"))?;
    let manifest_path = package.join(SERVICE_MANIFEST_NAME);
    fs::write(&manifest_path, manifest_bytes)
        .map_err(|e| format!("failed writing Samsung service manifest: {e}"))?;

    let mut hash_lines = manifest
        .artifacts
        .iter()
        .map(|artifact| format!("{}  {}", artifact.sha256, artifact.relative_path))
        .collect::<Vec<_>>();
    let manifest_hash = format!(
        "{:x}",
        Sha256::digest(
            fs::read(&manifest_path)
                .map_err(|e| format!("failed reading generated service manifest: {e}"))?
        )
    );
    hash_lines.push(format!("{manifest_hash}  {SERVICE_MANIFEST_NAME}"));
    hash_lines.sort();
    hash_lines.push(String::new());
    let hashes_path = package.join(HASH_MANIFEST_NAME);
    fs::write(&hashes_path, hash_lines.join("\n"))
        .map_err(|e| format!("failed writing Samsung service hash manifest: {e}"))?;

    Ok(SamsungServiceBundleCreateResult {
        manifest_path: manifest_path.display().to_string(),
        hashes_path: hashes_path.display().to_string(),
        model,
        build_version,
        bootloader_revision,
        pit_filename,
        artifacts_bound: manifest.artifacts.len(),
        bundle_fingerprint: fingerprint,
        execution_authorized: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stock_classifier_requires_clean_csc() {
        assert_eq!(
            classify_stock_artifact("CSC_OXM_T500.tar.md5", "GTA4LWIFI_EUR_OPEN.pit"),
            Some("csc")
        );
        assert_eq!(
            classify_stock_artifact("HOME_CSC_OXM_T500.tar.md5", "GTA4LWIFI_EUR_OPEN.pit"),
            None
        );
    }

    #[test]
    fn prohibited_names_cover_lock_bypass_material() {
        assert!(prohibited_name("SM-T500_U8_FRP_Bypass.tar"));
        assert!(prohibited_name("mdm-remove-debug.bin"));
        assert!(!prohibited_name("AP_T500XXS8CXG1.tar.md5"));
    }

    #[test]
    fn model_and_revision_validation_fail_closed() {
        assert_eq!(normalized_model(" sm-t500 ").unwrap(), "SM-T500");
        assert!(normalized_model("T500").is_err());
        assert_eq!(revision_rank("8"), Some(8));
        assert_eq!(revision_rank("A"), Some(10));
        assert_eq!(revision_rank("T500XXS8CXG1"), None);
    }

    #[test]
    fn bundle_fingerprint_is_deterministic() {
        let artifacts = vec![SamsungServiceArtifact {
            role: "pit".into(),
            relative_path: "GTA4LWIFI_EUR_OPEN.pit".into(),
            sha256: "a".repeat(64),
            bytes: 11628,
        }];
        let a = canonical_bundle_fingerprint(
            "SM-T500",
            "T500XXS8CXG1",
            "8",
            "GTA4LWIFI_EUR_OPEN.pit",
            "samloader",
            &"b".repeat(64),
            &artifacts,
        )
        .unwrap();
        let b = canonical_bundle_fingerprint(
            "SM-T500",
            "T500XXS8CXG1",
            "8",
            "GTA4LWIFI_EUR_OPEN.pit",
            "samloader",
            &"b".repeat(64),
            &artifacts,
        )
        .unwrap();
        assert_eq!(a, b);
        assert!(valid_sha256(&a));
    }
}
