use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EdlProgrammerRecord {
    pub path: String,
    pub sha256: String,
    pub bytes: u64,
    pub device_family: Option<String>,
    pub authorized: bool,
    pub authorization_source: Option<String>,
    pub enrolled_at_unix_ms: Option<u64>,
}

fn hash_file(path: &Path) -> Result<(u64, String), String> {
    let mut file = File::open(path).map_err(|e| format!("failed to open programmer: {e}"))?;
    let size = file.metadata().map_err(|e| format!("failed to stat programmer: {e}"))?.len();
    if size == 0 {
        return Err("programmer file is empty".to_string());
    }
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1024 * 1024];
    loop {
        let n = file.read(&mut buf).map_err(|e| format!("failed reading programmer: {e}"))?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Ok((size, format!("{:x}", hasher.finalize())))
}

fn validate_programmer_extension(path: &Path) -> Result<(), String> {
    let ext = path.extension().and_then(|v| v.to_str()).unwrap_or("").to_ascii_lowercase();
    if !matches!(ext.as_str(), "elf" | "mbn") {
        return Err("EDL programmer must be an .elf or .mbn file".to_string());
    }
    let name = path.file_name().and_then(|v| v.to_str()).unwrap_or("").to_ascii_lowercase();
    for blocked in ["bypass", "exploit", "patched", "unsigned", "auth-bypass", "sahara-bypass"] {
        if name.contains(blocked) {
            return Err(format!("programmer filename contains blocked security-bypass marker: {blocked}"));
        }
    }
    Ok(())
}

fn vault_path() -> Result<PathBuf, String> {
    let base = dirs::data_local_dir().ok_or_else(|| "could not resolve local app data directory".to_string())?;
    Ok(base.join("BobFWTools").join("edl_programmers.json"))
}

fn load_vault() -> Result<Vec<EdlProgrammerRecord>, String> {
    let path = vault_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let bytes = fs::read(&path).map_err(|e| format!("failed reading EDL programmer vault: {e}"))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("failed parsing EDL programmer vault: {e}"))
}

fn save_vault(records: &[EdlProgrammerRecord]) -> Result<(), String> {
    let path = vault_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("failed creating vault directory: {e}"))?;
    }
    let bytes = serde_json::to_vec_pretty(records).map_err(|e| format!("failed serializing vault: {e}"))?;
    fs::write(path, bytes).map_err(|e| format!("failed writing EDL programmer vault: {e}"))
}

#[tauri::command]
pub fn edl_inspect_programmer(
    path: String,
    device_family: Option<String>,
) -> Result<EdlProgrammerRecord, String> {
    let pathbuf = PathBuf::from(&path);
    if !pathbuf.is_file() {
        return Err("programmer file does not exist".to_string());
    }
    validate_programmer_extension(&pathbuf)?;
    let (bytes, sha256) = hash_file(&pathbuf)?;
    let canonical = fs::canonicalize(&pathbuf).map_err(|e| format!("failed resolving programmer path: {e}"))?;
    Ok(EdlProgrammerRecord {
        path: canonical.display().to_string(),
        sha256,
        bytes,
        device_family: device_family.filter(|v| !v.trim().is_empty()),
        authorized: false,
        authorization_source: None,
        enrolled_at_unix_ms: None,
    })
}

#[tauri::command]
pub fn edl_enroll_programmer(
    mut record: EdlProgrammerRecord,
    authorization_source: String,
    confirmation: String,
) -> Result<EdlProgrammerRecord, String> {
    if confirmation != "I CONFIRM OEM OR SERVICE AUTHORIZATION" {
        return Err("explicit OEM/service authorization confirmation is required".to_string());
    }
    let source = authorization_source.trim();
    if source.len() < 3 {
        return Err("authorization source must identify the OEM/service source".to_string());
    }

    let current = edl_inspect_programmer(record.path.clone(), record.device_family.clone())?;
    if current.sha256 != record.sha256 || current.bytes != record.bytes {
        return Err("programmer changed since inspection".to_string());
    }

    let qualification = bootforgeusb::edl::EdlProgrammerQualification {
        path: current.path.clone(),
        sha256: current.sha256.clone(),
        bytes: current.bytes,
        enrolled_as_authorized: true,
        device_family: current.device_family.clone(),
        notes: vec![format!("authorization source: {source}")],
    };
    bootforgeusb::edl::programmer_upload_permitted(&qualification)?;

    record = current;
    record.authorized = true;
    record.authorization_source = Some(source.to_string());
    record.enrolled_at_unix_ms = Some(crate::now_ms());

    let mut records = load_vault()?;
    records.retain(|existing| existing.sha256 != record.sha256);
    records.push(record.clone());
    save_vault(&records)?;
    Ok(record)
}

#[tauri::command]
pub fn edl_list_programmers() -> Result<Vec<EdlProgrammerRecord>, String> {
    let mut records = load_vault()?;
    for record in &mut records {
        let path = PathBuf::from(&record.path);
        if !path.is_file() {
            record.authorized = false;
            record.authorization_source = Some("file missing; enrollment suspended".to_string());
            continue;
        }
        let Ok((bytes, sha256)) = hash_file(&path) else {
            record.authorized = false;
            record.authorization_source = Some("file unreadable; enrollment suspended".to_string());
            continue;
        };
        if bytes != record.bytes || sha256 != record.sha256 {
            record.authorized = false;
            record.authorization_source = Some("file changed; enrollment suspended".to_string());
        }
    }
    Ok(records)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_programmer_extension() {
        let path = PathBuf::from("loader.bin");
        assert!(validate_programmer_extension(&path).is_err());
    }

    #[test]
    fn rejects_bypass_named_loader() {
        let path = PathBuf::from("prog_firehose_auth-bypass.elf");
        assert!(validate_programmer_extension(&path).is_err());
    }
}
