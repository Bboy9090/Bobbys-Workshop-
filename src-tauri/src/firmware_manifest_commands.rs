use bootforgeusb::firmware_manifest::{
    compare_manifest_to_device, validate_manifest, DeviceFirmwareIdentity, FirmwareCompatibilityReport,
    FirmwareManifest,
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestArtifactVerification {
    pub path: String,
    pub exists: bool,
    pub expected_sha256: String,
    pub actual_sha256: Option<String>,
    pub bytes: Option<u64>,
    pub hash_match: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareManifestInspection {
    pub manifest_path: String,
    pub manifest: FirmwareManifest,
    pub validation_errors: Vec<String>,
    pub artifacts: Vec<ManifestArtifactVerification>,
    pub all_artifacts_present: bool,
    pub all_hashes_match: bool,
    pub metadata_valid: bool,
    pub package_verified: bool,
}

fn hash_file(path: &Path) -> Result<(u64, String), String> {
    let mut file = File::open(path)
        .map_err(|e| format!("failed opening firmware artifact {}: {e}", path.display()))?;
    let bytes = file
        .metadata()
        .map_err(|e| format!("failed stating firmware artifact {}: {e}", path.display()))?
        .len();
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1024 * 1024];
    loop {
        let n = file
            .read(&mut buffer)
            .map_err(|e| format!("failed reading firmware artifact {}: {e}", path.display()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok((bytes, format!("{:x}", hasher.finalize())))
}

fn read_manifest(path: &Path) -> Result<FirmwareManifest, String> {
    let bytes = fs::read(path)
        .map_err(|e| format!("failed reading firmware manifest {}: {e}", path.display()))?;
    serde_json::from_slice(&bytes)
        .map_err(|e| format!("failed parsing firmware manifest {}: {e}", path.display()))
}

fn canonical_parent(path: &Path) -> Result<PathBuf, String> {
    let parent = path
        .parent()
        .ok_or_else(|| "firmware manifest has no parent directory".to_string())?;
    fs::canonicalize(parent)
        .map_err(|e| format!("failed resolving firmware package directory {}: {e}", parent.display()))
}

fn inspect_manifest(path: &Path) -> Result<FirmwareManifestInspection, String> {
    if !path.is_file() {
        return Err("firmware manifest does not exist".into());
    }

    let manifest = read_manifest(path)?;
    let validation_errors = validate_manifest(&manifest).err().unwrap_or_default();
    let metadata_valid = validation_errors.is_empty();

    let package_root = canonical_parent(path)?;
    let mut artifacts = Vec::new();

    if metadata_valid {
        for artifact in &manifest.artifacts {
            let candidate = package_root.join(&artifact.path);
            let canonical = if candidate.exists() {
                fs::canonicalize(&candidate).ok()
            } else {
                None
            };

            let within_root = canonical
                .as_ref()
                .map(|resolved| resolved.starts_with(&package_root))
                .unwrap_or(false);

            if !within_root {
                artifacts.push(ManifestArtifactVerification {
                    path: artifact.path.clone(),
                    exists: false,
                    expected_sha256: artifact.sha256.clone(),
                    actual_sha256: None,
                    bytes: None,
                    hash_match: false,
                });
                continue;
            }

            match hash_file(canonical.as_ref().unwrap()) {
                Ok((bytes, actual_sha256)) => {
                    let size_match = artifact.bytes.map(|expected| expected == bytes).unwrap_or(true);
                    let hash_match = actual_sha256.eq_ignore_ascii_case(&artifact.sha256) && size_match;
                    artifacts.push(ManifestArtifactVerification {
                        path: artifact.path.clone(),
                        exists: true,
                        expected_sha256: artifact.sha256.clone(),
                        actual_sha256: Some(actual_sha256),
                        bytes: Some(bytes),
                        hash_match,
                    });
                }
                Err(_) => {
                    artifacts.push(ManifestArtifactVerification {
                        path: artifact.path.clone(),
                        exists: true,
                        expected_sha256: artifact.sha256.clone(),
                        actual_sha256: None,
                        bytes: None,
                        hash_match: false,
                    });
                }
            }
        }
    }

    let all_artifacts_present = metadata_valid
        && artifacts.len() == manifest.artifacts.len()
        && artifacts.iter().all(|artifact| artifact.exists);
    let all_hashes_match = all_artifacts_present && artifacts.iter().all(|artifact| artifact.hash_match);
    let package_verified = metadata_valid && all_artifacts_present && all_hashes_match;

    Ok(FirmwareManifestInspection {
        manifest_path: path.display().to_string(),
        manifest,
        validation_errors,
        artifacts,
        all_artifacts_present,
        all_hashes_match,
        metadata_valid,
        package_verified,
    })
}

#[tauri::command]
pub fn firmware_manifest_inspect(path: String) -> Result<FirmwareManifestInspection, String> {
    inspect_manifest(Path::new(&path))
}

#[tauri::command]
pub fn firmware_manifest_compare(
    path: String,
    device: DeviceFirmwareIdentity,
) -> Result<FirmwareCompatibilityReport, String> {
    let inspection = inspect_manifest(Path::new(&path))?;
    if !inspection.package_verified {
        return Ok(FirmwareCompatibilityReport {
            manifest_valid: inspection.metadata_valid,
            identity_complete: false,
            candidate_compatible: false,
            execution_authorized: false,
            matched_fields: Vec::new(),
            blockers: vec![
                "firmware package manifest or artifact hashes are not fully verified".into(),
            ],
            warnings: inspection.validation_errors,
        });
    }
    Ok(compare_manifest_to_device(&inspection.manifest, &device))
}

#[cfg(test)]
mod tests {
    use super::*;
    use bootforgeusb::firmware_manifest::{
        FirmwareManifestArtifact, FIRMWARE_MANIFEST_SCHEMA,
    };

    #[test]
    fn missing_manifest_fails_closed() {
        assert!(firmware_manifest_inspect("/definitely/missing/bobfwtools-firmware.json".into()).is_err());
    }

    #[test]
    fn verified_manifest_hashes_declared_artifacts() {
        let dir = tempfile::tempdir().unwrap();
        let artifact_path = dir.path().join("rawprogram0.xml");
        fs::write(&artifact_path, b"<data/>").unwrap();
        let (_, sha256) = hash_file(&artifact_path).unwrap();

        let manifest = FirmwareManifest {
            schema: FIRMWARE_MANIFEST_SCHEMA.into(),
            vendor: "qualcomm".into(),
            chipset: "SM8550".into(),
            oem: "ExampleOEM".into(),
            models: vec!["EX-100".into()],
            variants: vec![],
            regions: vec![],
            build_id: "EX100_TEST".into(),
            bootloader_revision: None,
            source_kind: "official-oem".into(),
            source_reference: "test fixture".into(),
            artifacts: vec![FirmwareManifestArtifact {
                path: "rawprogram0.xml".into(),
                sha256,
                role: "rawprogram".into(),
                bytes: Some(7),
            }],
        };

        let manifest_path = dir.path().join("bobfwtools-firmware.json");
        fs::write(&manifest_path, serde_json::to_vec_pretty(&manifest).unwrap()).unwrap();

        let inspection = inspect_manifest(&manifest_path).unwrap();
        assert!(inspection.package_verified);
        assert!(inspection.all_hashes_match);
    }
}
