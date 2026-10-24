use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{fs::File, io::{Read, BufReader, Seek, SeekFrom}, path::Path};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareInspection {
    filename: String,
    bytes: u64,
    sha256: String,
    detected_format: &'static str,
    model_verified: bool,
    signature_verified: bool,
    rollback_verified: bool,
    executable: bool,
    evidence: Vec<String>,
    blockers: Vec<String>,
    archive_entries: Vec<String>,
    partition_candidates: Vec<String>,
}

#[tauri::command]
pub async fn inspect_firmware_artifact(path: String) -> Result<FirmwareInspection, String> {
    tauri::async_runtime::spawn_blocking(move || inspect(&path))
        .await.map_err(|e| format!("Inspection task failed: {e}"))?
}

fn inspect(path: &str) -> Result<FirmwareInspection, String> {
    let candidate = Path::new(path);
    let meta = std::fs::symlink_metadata(candidate).map_err(|e| format!("Cannot inspect artifact: {e}"))?;
    if !meta.file_type().is_file() { return Err("Firmware artifact must be a regular file, not a folder or symlink".into()); }
    if meta.len() == 0 || meta.len() > 32 * 1024 * 1024 * 1024 {
        return Err("Artifact must be nonempty and at most 32 GiB".into());
    }
    let name = candidate.file_name().and_then(|n| n.to_str()).unwrap_or("artifact").to_string();
    let mut reader = BufReader::new(File::open(candidate).map_err(|e| e.to_string())?);
    let mut head = [0u8; 512];
    let length = reader.read(&mut head).map_err(|e| e.to_string())?;
    let ext = name.to_ascii_lowercase();
    let format = if length >= 4 && &head[..4] == b"PK\x03\x04" {
        if ext.ends_with(".ipsw") { "ipsw-zip" } else { "zip" }
    } else if length >= 262 && &head[257..262] == b"ustar" { "tar" }
    else if length >= 2 && head[..2] == [0x1f, 0x8b] { "gzip" }
    else if length >= 4 && head[..4] == [0x3a,0xff,0x26,0xed] { "android-sparse" }
    else { "unknown" };
    let mut hash = Sha256::new();
    hash.update(&head[..length]);
    let mut buffer = [0u8; 1024 * 1024];
    loop {
        let n = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        hash.update(&buffer[..n]);
    }
    let (archive_entries, partition_candidates) = if format == "tar" {
        inspect_tar_entries(candidate)?
    } else if format == "ipsw-zip" {
        inspect_ipsw_manifest(candidate)?
    } else { (vec![], vec![]) };
    let mut blockers = vec![
        "Exact hardware model and regional SKU not authenticated".to_string(),
        "OEM package signature not cryptographically validated".to_string(),
        "Bootloader binary and anti-rollback compatibility not validated".to_string(),
        "Device partition mapping and recovery plan not qualified".to_string(),
    ];
    if format == "unknown" { blockers.push("Unrecognized artifact header".into()); }
    Ok(FirmwareInspection {
        filename: name,
        bytes: meta.len(),
        sha256: format!("{:x}", hash.finalize()),
        detected_format: format,
        model_verified: false,
        signature_verified: false,
        rollback_verified: false,
        executable: false,
        evidence: vec![format!("file header: {format}"), "SHA-256 computed from the entire file".into()],
        blockers,
        archive_entries,
        partition_candidates,
    })
}

// Strict bounded TAR manifest scan. No extraction, no shell execution, no device writes.
fn inspect_tar_entries(path: &Path) -> Result<(Vec<String>, Vec<String>), String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut entries = Vec::new();
    let mut partitions = Vec::new();
    let total = file.metadata().map_err(|e| e.to_string())?.len();
    let mut offset: u64 = 0;
    while offset + 512 <= total && entries.len() < 4096 {
        file.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
        let mut header = [0u8; 512];
        file.read_exact(&mut header).map_err(|e| e.to_string())?;
        if header.iter().all(|byte| *byte == 0) { break; }
        let declared = std::str::from_utf8(&header[148..156]).map_err(|_| "Invalid TAR header checksum".to_string())?;
        let checksum = u64::from_str_radix(declared.trim_matches(|c:char| c == '\0' || c == ' ').trim(), 8)
            .map_err(|_| "Invalid TAR header checksum".to_string())?;
        let actual: u64 = header.iter().enumerate().map(|(i,b)| if (148..156).contains(&i) { 32u64 } else { *b as u64 }).sum();
        if checksum != actual { return Err("TAR header checksum mismatch; no package qualification".into()); }
        let name = String::from_utf8_lossy(&header[..100]).trim_end_matches('\0').to_string();
        if name.is_empty() || name.contains("..") || name.starts_with('/') || name.contains(char::from(92)) {
            return Err("Unsafe or malformed TAR entry path".into());
        }
        let size_text = std::str::from_utf8(&header[124..136]).map_err(|_| "Invalid TAR entry size".to_string())?;
        let size = u64::from_str_radix(size_text.trim_matches(|c:char| c == '\0' || c == ' ').trim(), 8)
            .map_err(|_| "Invalid TAR entry size".to_string())?;
        let file_type = header[156];
        if file_type == b'0' || file_type == 0 {
            if name.to_ascii_lowercase().ends_with(".img") || name.to_ascii_lowercase().ends_with(".img.lz4") ||
               name.to_ascii_lowercase().ends_with(".bin") { partitions.push(name.clone()); }
        } else if file_type != b'5' {
            return Err("TAR special entry type unsupported for firmware inspection".into());
        }
        entries.push(name);
        let padded = size.checked_add(511).ok_or("Archive entry size overflow")? / 512 * 512;
        offset = offset.checked_add(512).and_then(|v| v.checked_add(padded)).ok_or("Archive offset overflow")?;
        if offset > total { return Err("Truncated TAR archive".into()); }
    }
    if entries.len() >= 4096 { return Err("Firmware archive exceeds inspection entry limit".into()); }
    Ok((entries, partitions))
}


// Inspect ZIP central-directory metadata only: no decompression, extraction, or execution.
// Limits bound entry count, total advertised expanded size, and path length.
fn inspect_ipsw_manifest(path: &Path) -> Result<(Vec<String>, Vec<String>), String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Invalid IPSW ZIP: {e}"))?;
    if zip.len() > 4096 { return Err("IPSW entry limit exceeded".into()); }
    let mut entries = Vec::with_capacity(zip.len());
    let mut total = 0u64;
    for i in 0..zip.len() {
        let entry = zip.by_index_raw(i).map_err(|e| format!("Invalid IPSW entry: {e}"))?;
        let name = entry.name();
        if name.len() > 1024 || name.starts_with('/') || name.contains('\\') ||
            name.split('/').any(|part| part == ".." || part == ".") {
            return Err("Unsafe IPSW entry path".into());
        }
        if entry.is_symlink() { return Err("IPSW symlink entries are unsupported".into()); }
        total = total.checked_add(entry.size()).ok_or("IPSW expanded size overflow")?;
        if total > 128 * 1024 * 1024 * 1024 { return Err("IPSW expanded size limit exceeded".into()); }
        entries.push(name.to_string());
    }
    Ok((entries, vec![]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn archive_with_entry(name: &str, corrupted_checksum: bool, truncate: bool) -> std::path::PathBuf {
        let mut header = [0u8; 512];
        header[..name.len()].copy_from_slice(name.as_bytes());
        header[124..136].copy_from_slice(b"00000001000\0");
        header[156] = b'0';
        header[257..263].copy_from_slice(b"ustar\0");
        let checksum: u64 = header.iter().enumerate()
            .map(|(i, byte)| if (148..156).contains(&i) { 32u64 } else { *byte as u64 })
            .sum();
        let formatted = format!("{:06o}\0 ", checksum + if corrupted_checksum { 1 } else { 0 });
        header[148..156].copy_from_slice(formatted.as_bytes());
        let location = std::env::temp_dir().join(format!("bobfw-fixture-{}.tar", uuid::Uuid::new_v4()));
        let mut file = File::create(&location).unwrap();
        file.write_all(&header).unwrap();
        if !truncate { file.write_all(&[0u8; 512]).unwrap(); }
        location
    }

    #[test]
    fn ipsw_manifest_is_read_only_and_lists_entries() {
        let path = std::env::temp_dir().join(format!("bobfw-{}.ipsw", uuid::Uuid::new_v4()));
        {
            let file = File::create(&path).unwrap();
            let mut writer = zip::ZipWriter::new(file);
            writer.start_file("Firmware/dfu/iBSS.img4", zip::write::SimpleFileOptions::default()).unwrap();
            writer.write_all(b"fixture").unwrap();
            writer.finish().unwrap();
        }
        let result = inspect(path.to_str().unwrap()).unwrap();
        std::fs::remove_file(path).unwrap();
        assert_eq!(result.detected_format, "ipsw-zip");
        assert_eq!(result.archive_entries, vec!["Firmware/dfu/iBSS.img4"]);
        assert!(!result.executable);
    }

    #[test]
    fn valid_tar_lists_partition_candidate_without_authorizing_flash() {
        let path = archive_with_entry("boot.img", false, false);
        let result = inspect(path.to_str().unwrap()).unwrap();
        std::fs::remove_file(path).unwrap();
        assert_eq!(result.detected_format, "tar");
        assert_eq!(result.partition_candidates, vec!["boot.img"]);
        assert_eq!(result.sha256.len(), 64);
        assert!(!result.executable);
        assert!(!result.signature_verified);
    }

    #[test]
    fn traversal_path_is_rejected() {
        let path = archive_with_entry("../bad.img", false, false);
        let result = inspect(path.to_str().unwrap());
        std::fs::remove_file(path).unwrap();
        assert!(result.unwrap_err().contains("Unsafe"));
    }

    #[test]
    fn corrupt_checksum_is_rejected() {
        let path = archive_with_entry("boot.img", true, false);
        let result = inspect(path.to_str().unwrap());
        std::fs::remove_file(path).unwrap();
        assert!(result.unwrap_err().contains("checksum mismatch"));
    }

    #[test]
    fn truncated_partition_image_is_rejected() {
        let path = archive_with_entry("boot.img", false, true);
        let result = inspect(path.to_str().unwrap());
        std::fs::remove_file(path).unwrap();
        assert!(result.unwrap_err().contains("Truncated"));
    }
}
