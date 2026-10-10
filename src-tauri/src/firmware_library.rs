use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use bootforgeusb::firmware_catalog::{chipset_catalog, match_chipsets, ChipsetProfile};

const MAX_LIBRARY_FILES: usize = 10_000;
const MAX_SCAN_DEPTH: usize = 8;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareLibraryEntry {
    pub path: String,
    pub relative_path: String,
    pub name: String,
    pub bytes: u64,
    pub sha256: String,
    pub modified_unix_ms: Option<u64>,
    pub vendor_hint: String,
    pub artifact_kind: String,
    pub chipset_matches: Vec<String>,
    pub blocked: bool,
    pub eligible_for_planning: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareLibraryReport {
    pub root: String,
    pub entries: Vec<FirmwareLibraryEntry>,
    pub vendor_counts: BTreeMap<String, usize>,
    pub artifact_counts: BTreeMap<String, usize>,
    pub blocked_count: usize,
    pub warnings: Vec<String>,
}

fn firmware_root() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".bobfwtools")
        .join("firmware")
}

fn hash_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path)
        .map_err(|e| format!("failed opening firmware artifact {}: {e}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1024 * 1024];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| format!("failed reading firmware artifact {}: {e}", path.display()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn blocked_marker(text: &str) -> Option<&'static str> {
    let lower = text.to_ascii_lowercase();
    [
        "auth-bypass",
        "auth_bypass",
        "sla-bypass",
        "sla_bypass",
        "daa-bypass",
        "daa_bypass",
        "brom-bypass",
        "brom_bypass",
        "edl-bypass",
        "edl_bypass",
        "sahara-bypass",
        "sahara_bypass",
        "firehose-patched",
        "firehose_patched",
        "patched-firehose",
        "patched_firehose",
        "exploit",
    ]
    .into_iter()
    .find(|marker| lower.contains(marker))
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn classify(path: &Path) -> (String, String) {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let full = path.to_string_lossy().to_ascii_lowercase();
    let ext = extension(path);

    if (ext == "elf" || ext == "mbn")
        && (name.contains("firehose") || name.starts_with("prog_"))
    {
        return ("qualcomm".into(), "firehose-programmer".into());
    }
    if ext == "xml" && name.starts_with("rawprogram") {
        return ("qualcomm".into(), "rawprogram-manifest".into());
    }
    if ext == "xml" && name.starts_with("patch") {
        return ("qualcomm".into(), "patch-manifest".into());
    }
    if ext == "xml" && (name.contains("contents") || name.contains("partition")) {
        return ("qualcomm".into(), "qualcomm-manifest".into());
    }

    if ext == "txt" && name.contains("scatter") {
        return ("mediatek".into(), "scatter-manifest".into());
    }
    if ext == "bin" && name.starts_with("preloader") {
        return ("mediatek".into(), "preloader".into());
    }
    if ext == "bin"
        && (name.contains("download_agent")
            || name.starts_with("mtk_allinone_da")
            || name.starts_with("da_"))
    {
        return ("mediatek".into(), "download-agent".into());
    }
    if ext == "auth" || (name.contains("auth") && matches!(ext.as_str(), "bin" | "dat")) {
        return ("mediatek".into(), "authentication".into());
    }

    if matches!(ext.as_str(), "img" | "bin" | "mbn" | "elf") {
        let vendor = if full.contains("qualcomm")
            || full.contains("qcom")
            || full.contains("firehose")
            || full.contains("rawprogram")
        {
            "qualcomm"
        } else if full.contains("mediatek")
            || full.contains("mtk")
            || full.contains("scatter")
            || full.contains("preloader")
        {
            "mediatek"
        } else {
            "unknown"
        };
        return (vendor.into(), "partition-image".into());
    }

    if matches!(ext.as_str(), "zip" | "7z" | "rar" | "tgz" | "gz" | "xz") {
        let vendor = if full.contains("qualcomm") || full.contains("qcom") {
            "qualcomm"
        } else if full.contains("mediatek") || full.contains("mtk") {
            "mediatek"
        } else {
            "unknown"
        };
        return (vendor.into(), "firmware-archive".into());
    }

    ("unknown".into(), "other".into())
}

fn collect_files(root: &Path, dir: &Path, depth: usize, files: &mut Vec<PathBuf>) -> Result<(), String> {
    if depth > MAX_SCAN_DEPTH || files.len() >= MAX_LIBRARY_FILES {
        return Ok(());
    }

    let entries = fs::read_dir(dir)
        .map_err(|e| format!("failed reading firmware library {}: {e}", dir.display()))?;

    for entry in entries {
        if files.len() >= MAX_LIBRARY_FILES {
            break;
        }
        let entry = entry.map_err(|e| format!("failed reading firmware directory entry: {e}"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|e| format!("failed reading file type {}: {e}", path.display()))?;

        // Do not follow symlinks out of the managed library.
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            collect_files(root, &path, depth + 1, files)?;
        } else if file_type.is_file() && path.starts_with(root) {
            files.push(path);
        }
    }
    Ok(())
}

fn inspect_entry(root: &Path, path: &Path) -> Result<FirmwareLibraryEntry, String> {
    let metadata = fs::metadata(path)
        .map_err(|e| format!("failed stating firmware artifact {}: {e}", path.display()))?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("unknown")
        .to_string();
    let relative_path = path
        .strip_prefix(root)
        .unwrap_or(path)
        .display()
        .to_string();
    let search_text = format!("{} {}", relative_path, name);
    let matches = match_chipsets(&search_text);
    let chipset_matches = matches
        .iter()
        .take(8)
        .map(|profile| format!("{}:{}", profile.vendor, profile.family))
        .collect::<Vec<_>>();
    let (vendor_hint, artifact_kind) = classify(path);
    let blocked_reason = blocked_marker(&search_text);
    let blocked = blocked_reason.is_some();

    let mut warnings = Vec::new();
    if let Some(marker) = blocked_reason {
        warnings.push(format!(
            "Blocked from planning because the artifact path contains prohibited bypass/exploit marker: {marker}"
        ));
    }
    if vendor_hint == "unknown" {
        warnings.push("Vendor could not be established from filename/path metadata.".into());
    }
    if chipset_matches.is_empty() {
        warnings.push("No chipset match found in path/name metadata; exact model/package identity is still required.".into());
    } else {
        warnings.push("Chipset match is advisory only and does not establish exact device/package compatibility.".into());
    }
    if matches!(artifact_kind.as_str(), "firehose-programmer" | "download-agent" | "authentication") {
        warnings.push("Service loader/auth artifact requires separate OEM/service authorization evidence before use.".into());
    }

    let modified_unix_ms = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64);

    Ok(FirmwareLibraryEntry {
        path: path.display().to_string(),
        relative_path,
        name,
        bytes: metadata.len(),
        sha256: hash_file(path)?,
        modified_unix_ms,
        vendor_hint,
        artifact_kind: artifact_kind.clone(),
        chipset_matches,
        blocked,
        eligible_for_planning: !blocked && artifact_kind != "other",
        warnings,
    })
}

#[tauri::command]
pub fn firmware_chipset_catalog() -> Vec<ChipsetProfile> {
    chipset_catalog()
}

#[tauri::command]
pub fn firmware_chipset_lookup(query: String) -> Vec<ChipsetProfile> {
    match_chipsets(&query)
}

#[tauri::command]
pub fn firmware_library_scan() -> Result<FirmwareLibraryReport, String> {
    let root = firmware_root();
    fs::create_dir_all(root.join("inbox"))
        .map_err(|e| format!("failed creating firmware inbox: {e}"))?;
    fs::create_dir_all(root.join("qualcomm"))
        .map_err(|e| format!("failed creating Qualcomm firmware directory: {e}"))?;
    fs::create_dir_all(root.join("mediatek"))
        .map_err(|e| format!("failed creating MediaTek firmware directory: {e}"))?;
    fs::create_dir_all(root.join("quarantine"))
        .map_err(|e| format!("failed creating firmware quarantine directory: {e}"))?;

    let mut files = Vec::new();
    collect_files(&root, &root, 0, &mut files)?;
    files.sort();

    let mut entries = Vec::new();
    let mut warnings = Vec::new();
    for path in files {
        match inspect_entry(&root, &path) {
            Ok(entry) => entries.push(entry),
            Err(error) => warnings.push(error),
        }
    }

    if entries.len() >= MAX_LIBRARY_FILES {
        warnings.push(format!(
            "Firmware library scan hit the safety limit of {MAX_LIBRARY_FILES} files; split large archives into model/chipset folders."
        ));
    }

    let mut vendor_counts = BTreeMap::new();
    let mut artifact_counts = BTreeMap::new();
    for entry in &entries {
        *vendor_counts.entry(entry.vendor_hint.clone()).or_insert(0) += 1;
        *artifact_counts.entry(entry.artifact_kind.clone()).or_insert(0) += 1;
    }
    let blocked_count = entries.iter().filter(|entry| entry.blocked).count();

    Ok(FirmwareLibraryReport {
        root: root.display().to_string(),
        entries,
        vendor_counts,
        artifact_counts,
        blocked_count,
        warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_qualcomm_firehose() {
        let (vendor, kind) = classify(Path::new("SM8550/prog_ufs_firehose_sm8550.elf"));
        assert_eq!(vendor, "qualcomm");
        assert_eq!(kind, "firehose-programmer");
    }

    #[test]
    fn classifies_mediatek_scatter_and_da() {
        let (vendor, kind) = classify(Path::new("MT6989/MT6989_Android_scatter.txt"));
        assert_eq!(vendor, "mediatek");
        assert_eq!(kind, "scatter-manifest");

        let (vendor, kind) = classify(Path::new("MTK_AllInOne_DA.bin"));
        assert_eq!(vendor, "mediatek");
        assert_eq!(kind, "download-agent");
    }

    #[test]
    fn blocks_bypass_markers() {
        assert!(blocked_marker("prog_firehose_auth-bypass.elf").is_some());
        assert!(blocked_marker("mtk_sla_bypass.bin").is_some());
        assert!(blocked_marker("stock_prog_firehose.elf").is_none());
    }
}
