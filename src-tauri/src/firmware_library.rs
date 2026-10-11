use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use bootforgeusb::firmware_catalog::{chipset_catalog, match_chipsets, ChipsetProfile};

const MAX_LIBRARY_FILES: usize = 10_000;
const MAX_SCAN_DEPTH: usize = 8;
const PROVENANCE_MANIFEST_NAME: &str = "bobfwtools-firmware-manifest.json";
const PROVENANCE_SCHEMA: &str = "com.bobbyblanco.bobfwtools.firmware-provenance.v1";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct FirmwareProvenanceArtifact {
    relative_path: String,
    sha256: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct FirmwareProvenanceManifest {
    schema: String,
    vendor: String,
    chipset_family: String,
    oem: String,
    model: String,
    board: String,
    sku: String,
    region: Option<String>,
    carrier: Option<String>,
    build_version: String,
    bootloader_revision: Option<String>,
    storage: Option<String>,
    source_category: String,
    source_reference: String,
    artifacts: Vec<FirmwareProvenanceArtifact>,
}

#[derive(Debug, Clone, Default)]
struct ProvenanceAssessment {
    present: bool,
    valid: bool,
    exact_identity_present: bool,
    model: Option<String>,
    board: Option<String>,
    sku: Option<String>,
    source_category: Option<String>,
    source_reference: Option<String>,
    warnings: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareProvenanceWriteInput {
    pub directory: String,
    pub vendor: String,
    pub chipset_family: String,
    pub oem: String,
    pub model: String,
    pub board: String,
    pub sku: String,
    pub region: Option<String>,
    pub carrier: Option<String>,
    pub build_version: String,
    pub bootloader_revision: Option<String>,
    pub storage: Option<String>,
    pub source_category: String,
    pub source_reference: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareProvenanceWriteResult {
    pub path: String,
    pub artifacts_bound: usize,
}

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
pub struct FirmwareBundleSummary {
    pub directory: String,
    pub vendor_hint: String,
    pub chipset_matches: Vec<String>,
    pub artifact_kinds: Vec<String>,
    pub files: usize,
    pub bytes: u64,
    pub blocked: bool,
    pub planning_ready: bool,
    pub missing_required: Vec<String>,
    pub provenance_present: bool,
    pub provenance_valid: bool,
    pub exact_identity_present: bool,
    pub model: Option<String>,
    pub board: Option<String>,
    pub sku: Option<String>,
    pub source_category: Option<String>,
    pub source_reference: Option<String>,
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
    pub bundles: Vec<FirmwareBundleSummary>,
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

    if name == PROVENANCE_MANIFEST_NAME {
        return ("unknown".into(), "provenance-manifest".into());
    }

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

fn assess_provenance(root: &Path, directory: &str, entries: &[FirmwareLibraryEntry]) -> ProvenanceAssessment {
    let manifest_relative = if directory == "." {
        PROVENANCE_MANIFEST_NAME.to_string()
    } else {
        format!("{directory}/{PROVENANCE_MANIFEST_NAME}")
    };
    let manifest_entry = entries.iter().find(|entry| entry.relative_path == manifest_relative);
    let Some(manifest_entry) = manifest_entry else {
        return ProvenanceAssessment {
            warnings: vec![
                "No BobFWTools provenance manifest found. Exact model/board/SKU identity and package-source binding are required before planning.".into(),
            ],
            ..Default::default()
        };
    };

    let mut assessment = ProvenanceAssessment {
        present: true,
        ..Default::default()
    };
    let manifest_path = root.join(&manifest_entry.relative_path);
    let bytes = match fs::read(&manifest_path) {
        Ok(bytes) => bytes,
        Err(error) => {
            assessment.warnings.push(format!("Failed reading provenance manifest: {error}"));
            return assessment;
        }
    };
    let manifest: FirmwareProvenanceManifest = match serde_json::from_slice(&bytes) {
        Ok(manifest) => manifest,
        Err(error) => {
            assessment.warnings.push(format!("Invalid provenance manifest JSON: {error}"));
            return assessment;
        }
    };

    assessment.model = Some(manifest.model.trim().to_string()).filter(|value| !value.is_empty());
    assessment.board = Some(manifest.board.trim().to_string()).filter(|value| !value.is_empty());
    assessment.sku = Some(manifest.sku.trim().to_string()).filter(|value| !value.is_empty());
    assessment.source_category = Some(manifest.source_category.trim().to_string()).filter(|value| !value.is_empty());
    assessment.source_reference = Some(manifest.source_reference.trim().to_string()).filter(|value| !value.is_empty());
    assessment.exact_identity_present =
        assessment.model.is_some() && assessment.board.is_some() && assessment.sku.is_some();

    if manifest.schema != PROVENANCE_SCHEMA {
        assessment.warnings.push(format!(
            "Unsupported provenance schema '{}'; expected '{}'.",
            manifest.schema, PROVENANCE_SCHEMA
        ));
    }
    if !matches!(manifest.vendor.trim().to_ascii_lowercase().as_str(), "qualcomm" | "mediatek") {
        assessment.warnings.push("Provenance vendor must be qualcomm or mediatek.".into());
    }
    if manifest.chipset_family.trim().is_empty()
        || manifest.oem.trim().is_empty()
        || manifest.build_version.trim().is_empty()
        || !assessment.exact_identity_present
    {
        assessment.warnings.push(
            "Provenance manifest must include chipsetFamily, OEM, exact model, board, SKU, and buildVersion.".into(),
        );
    }
    if !matches!(
        manifest.source_category.trim().to_ascii_lowercase().as_str(),
        "official-oem" | "authorized-service"
    ) {
        assessment.warnings.push(
            "sourceCategory must be official-oem or authorized-service for planning readiness.".into(),
        );
    }
    if manifest.source_reference.trim().len() < 3 {
        assessment.warnings.push("sourceReference must identify the package source.".into());
    }
    if manifest.artifacts.is_empty() {
        assessment.warnings.push("Provenance manifest must hash-bind at least one package artifact.".into());
    }

    let expected_chipset = format!(
        "{}:{}",
        manifest.vendor.trim().to_ascii_lowercase(),
        manifest.chipset_family.trim()
    );
    let observed_chipsets = entries
        .iter()
        .filter(|entry| {
            let parent = Path::new(&entry.relative_path)
                .parent()
                .map(|path| path.display().to_string())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| ".".into());
            parent == directory && entry.artifact_kind != "provenance-manifest"
        })
        .flat_map(|entry| entry.chipset_matches.iter())
        .cloned()
        .collect::<BTreeSet<_>>();
    if !observed_chipsets.is_empty() && !observed_chipsets.contains(&expected_chipset) {
        assessment.warnings.push(format!(
            "Provenance chipset {} does not match observed package chipset evidence ({}).",
            expected_chipset,
            observed_chipsets.into_iter().collect::<Vec<_>>().join(", ")
        ));
    }

    let manifest_vendor = manifest.vendor.trim().to_ascii_lowercase();
    let observed_vendors = entries
        .iter()
        .filter(|entry| {
            let parent = Path::new(&entry.relative_path)
                .parent()
                .map(|path| path.display().to_string())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| ".".into());
            parent == directory && entry.vendor_hint != "unknown"
        })
        .map(|entry| entry.vendor_hint.clone())
        .collect::<BTreeSet<_>>();
    if !observed_vendors.is_empty() && !observed_vendors.contains(&manifest_vendor) {
        assessment.warnings.push(format!(
            "Provenance vendor {} does not match observed package vendor evidence ({}).",
            manifest_vendor,
            observed_vendors.into_iter().collect::<Vec<_>>().join(", ")
        ));
    }

    let declared_paths = manifest
        .artifacts
        .iter()
        .map(|artifact| artifact.relative_path.trim().replace('\\', "/"))
        .collect::<BTreeSet<_>>();
    for entry in entries.iter().filter(|entry| {
        let parent = Path::new(&entry.relative_path)
            .parent()
            .map(|path| path.display().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| ".".into());
        parent == directory
            && entry.artifact_kind != "provenance-manifest"
            && entry.artifact_kind != "other"
    }) {
        let file_name = Path::new(&entry.relative_path)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("");
        if !declared_paths.contains(file_name) {
            assessment.warnings.push(format!(
                "Planning-relevant artifact '{}' is not hash-bound by the provenance manifest.",
                file_name
            ));
        }
    }

    for artifact in &manifest.artifacts {
        let relative = artifact.relative_path.trim().replace('\\', "/");
        if relative.is_empty() || relative.starts_with('/') || relative.split('/').any(|part| part == "..") {
            assessment.warnings.push(format!(
                "Unsafe provenance artifact path '{}'; paths must stay inside the package directory.",
                artifact.relative_path
            ));
            continue;
        }
        let expected_path = if directory == "." {
            relative.clone()
        } else {
            format!("{directory}/{relative}")
        };
        match entries.iter().find(|entry| entry.relative_path.replace('\\', "/") == expected_path) {
            Some(entry) if entry.sha256.eq_ignore_ascii_case(artifact.sha256.trim()) => {}
            Some(_) => assessment.warnings.push(format!(
                "Provenance hash mismatch for '{}'. Re-import the authoritative package instead of overriding the hash.",
                artifact.relative_path
            )),
            None => assessment.warnings.push(format!(
                "Provenance artifact '{}' is missing from the package directory.",
                artifact.relative_path
            )),
        }
    }

    let _informational = (
        manifest.region.as_deref(),
        manifest.carrier.as_deref(),
        manifest.bootloader_revision.as_deref(),
        manifest.storage.as_deref(),
    );

    assessment.valid = assessment.warnings.is_empty();
    assessment
}

fn summarize_bundles(root: &Path, entries: &[FirmwareLibraryEntry]) -> Vec<FirmwareBundleSummary> {
    #[derive(Default)]
    struct Acc {
        vendors: BTreeSet<String>,
        chipsets: BTreeSet<String>,
        kinds: BTreeSet<String>,
        files: usize,
        bytes: u64,
        blocked: bool,
    }

    let mut grouped: BTreeMap<String, Acc> = BTreeMap::new();

    for entry in entries {
        let directory = Path::new(&entry.relative_path)
            .parent()
            .map(|path| path.display().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| ".".to_string());

        let acc = grouped.entry(directory).or_default();
        if entry.vendor_hint != "unknown" {
            acc.vendors.insert(entry.vendor_hint.clone());
        }
        acc.chipsets.extend(entry.chipset_matches.iter().cloned());
        acc.kinds.insert(entry.artifact_kind.clone());
        acc.files += 1;
        acc.bytes = acc.bytes.saturating_add(entry.bytes);
        acc.blocked |= entry.blocked;
    }

    let mut bundles = grouped
        .into_iter()
        .map(|(directory, acc)| {
            let vendor_hint = if acc.vendors.len() == 1 {
                acc.vendors.iter().next().cloned().unwrap_or_else(|| "unknown".into())
            } else if acc.vendors.is_empty() {
                "unknown".into()
            } else {
                "mixed".into()
            };

            let required: &[&str] = match vendor_hint.as_str() {
                "qualcomm" => &["firehose-programmer", "rawprogram-manifest"],
                "mediatek" => &["scatter-manifest", "download-agent"],
                _ => &[],
            };

            let missing_required = required
                .iter()
                .filter(|kind| !acc.kinds.contains(**kind))
                .map(|kind| (*kind).to_string())
                .collect::<Vec<_>>();

            let vendor_chipsets = acc
                .chipsets
                .iter()
                .filter(|chipset| chipset.starts_with(&format!("{vendor_hint}:")))
                .cloned()
                .collect::<BTreeSet<_>>();
            let chipset_conflict = matches!(vendor_hint.as_str(), "qualcomm" | "mediatek")
                && vendor_chipsets.len() > 1;

            let provenance = assess_provenance(root, &directory, entries);
            let mut warnings = provenance.warnings.clone();
            if chipset_conflict {
                warnings.push(format!(
                    "Package directory resolves to multiple {vendor_hint} chipset families ({}) and is excluded from planning until the package identity is unambiguous.",
                    vendor_chipsets.into_iter().collect::<Vec<_>>().join(", ")
                ));
            }
            if vendor_hint == "qualcomm" && !acc.kinds.contains("patch-manifest") {
                warnings.push("No Qualcomm patch manifest found; some stock packages legitimately omit it, so verify OEM package structure.".into());
            }
            if vendor_hint == "mediatek" && !acc.kinds.contains("preloader") {
                warnings.push("No MediaTek preloader found. That can be valid for preservation-first service, but exact stock package completeness is not proven.".into());
            }
            if vendor_hint == "mediatek" && !acc.kinds.contains("authentication") {
                warnings.push("No MediaTek auth artifact found. Some devices do not require one; secure devices may require OEM authentication.".into());
            }
            if acc.blocked {
                warnings.push("Bundle contains blocked bypass/exploit-marked artifacts and is excluded from planning.".into());
            }
            if vendor_hint == "mixed" {
                warnings.push("Directory mixes Qualcomm and MediaTek artifacts; split it into vendor/model-specific folders before planning.".into());
            }

            FirmwareBundleSummary {
                directory,
                vendor_hint: vendor_hint.clone(),
                chipset_matches: acc.chipsets.into_iter().take(8).collect(),
                artifact_kinds: acc.kinds.into_iter().collect(),
                files: acc.files,
                bytes: acc.bytes,
                blocked: acc.blocked,
                planning_ready: !acc.blocked
                    && !chipset_conflict
                    && matches!(vendor_hint.as_str(), "qualcomm" | "mediatek")
                    && missing_required.is_empty()
                    && provenance.present
                    && provenance.valid
                    && provenance.exact_identity_present,
                missing_required,
                provenance_present: provenance.present,
                provenance_valid: provenance.valid,
                exact_identity_present: provenance.exact_identity_present,
                model: provenance.model,
                board: provenance.board,
                sku: provenance.sku,
                source_category: provenance.source_category,
                source_reference: provenance.source_reference,
                warnings,
            }
        })
        .collect::<Vec<_>>();

    bundles.sort_by(|a, b| {
        b.planning_ready
            .cmp(&a.planning_ready)
            .then_with(|| a.directory.cmp(&b.directory))
    });
    bundles
}

#[tauri::command]
pub fn firmware_provenance_write(input: FirmwareProvenanceWriteInput) -> Result<FirmwareProvenanceWriteResult, String> {
    let directory = input.directory.trim().replace('\\', "/");
    if directory.is_empty()
        || directory.starts_with('/')
        || directory.split('/').any(|part| part == ".." || part.is_empty())
    {
        return Err("firmware package directory must be a safe managed-library relative path".into());
    }

    let vendor = input.vendor.trim().to_ascii_lowercase();
    if !matches!(vendor.as_str(), "qualcomm" | "mediatek") {
        return Err("vendor must be qualcomm or mediatek".into());
    }
    let source_category = input.source_category.trim().to_ascii_lowercase();
    if !matches!(source_category.as_str(), "official-oem" | "authorized-service") {
        return Err("sourceCategory must be official-oem or authorized-service".into());
    }
    for (label, value) in [
        ("chipsetFamily", input.chipset_family.trim()),
        ("oem", input.oem.trim()),
        ("model", input.model.trim()),
        ("board", input.board.trim()),
        ("sku", input.sku.trim()),
        ("buildVersion", input.build_version.trim()),
        ("sourceReference", input.source_reference.trim()),
    ] {
        if value.is_empty() {
            return Err(format!("{label} is required to create an exact package provenance manifest"));
        }
    }

    let root = firmware_root();
    let package_dir = root.join(&directory);
    let root_canonical = fs::canonicalize(&root)
        .map_err(|e| format!("firmware library is unavailable: {e}"))?;
    let package_canonical = fs::canonicalize(&package_dir)
        .map_err(|e| format!("firmware package directory does not exist: {e}"))?;
    if !package_canonical.starts_with(&root_canonical) || !package_canonical.is_dir() {
        return Err("firmware package directory must remain inside the managed firmware library".into());
    }

    let mut artifacts = Vec::new();
    let mut observed_vendors = BTreeSet::new();
    let mut observed_chipsets = BTreeSet::new();
    for item in fs::read_dir(&package_canonical)
        .map_err(|e| format!("failed reading firmware package directory: {e}"))?
    {
        let item = item.map_err(|e| format!("failed reading firmware package entry: {e}"))?;
        let file_type = item
            .file_type()
            .map_err(|e| format!("failed reading firmware package file type: {e}"))?;
        if file_type.is_symlink() || !file_type.is_file() {
            continue;
        }
        let path = item.path();
        if path.file_name().and_then(|value| value.to_str()) == Some(PROVENANCE_MANIFEST_NAME) {
            continue;
        }
        let entry = inspect_entry(&root_canonical, &path)?;
        if entry.blocked {
            return Err(format!(
                "blocked firmware artifact '{}' cannot be included in provenance",
                entry.name
            ));
        }
        if entry.artifact_kind == "other" {
            continue;
        }
        if entry.vendor_hint != "unknown" {
            observed_vendors.insert(entry.vendor_hint.clone());
        }
        observed_chipsets.extend(entry.chipset_matches.iter().cloned());
        artifacts.push(FirmwareProvenanceArtifact {
            relative_path: entry.name,
            sha256: entry.sha256,
        });
    }

    if artifacts.is_empty() {
        return Err("no planning-relevant firmware artifacts were found in this package directory".into());
    }
    if !observed_vendors.is_empty() && !observed_vendors.contains(&vendor) {
        return Err(format!(
            "declared vendor {} conflicts with observed package vendor evidence ({})",
            vendor,
            observed_vendors.into_iter().collect::<Vec<_>>().join(", ")
        ));
    }
    let expected_chipset = format!("{}:{}", vendor, input.chipset_family.trim());
    if !observed_chipsets.is_empty() && !observed_chipsets.contains(&expected_chipset) {
        return Err(format!(
            "declared chipset {} conflicts with observed package chipset evidence ({})",
            expected_chipset,
            observed_chipsets.into_iter().collect::<Vec<_>>().join(", ")
        ));
    }

    artifacts.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    let manifest = FirmwareProvenanceManifest {
        schema: PROVENANCE_SCHEMA.into(),
        vendor,
        chipset_family: input.chipset_family.trim().to_string(),
        oem: input.oem.trim().to_string(),
        model: input.model.trim().to_string(),
        board: input.board.trim().to_string(),
        sku: input.sku.trim().to_string(),
        region: input.region.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()),
        carrier: input.carrier.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()),
        build_version: input.build_version.trim().to_string(),
        bootloader_revision: input.bootloader_revision.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()),
        storage: input.storage.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()),
        source_category,
        source_reference: input.source_reference.trim().to_string(),
        artifacts,
    };
    let bytes = serde_json::to_vec_pretty(&manifest)
        .map_err(|e| format!("failed serializing provenance manifest: {e}"))?;
    let manifest_path = package_canonical.join(PROVENANCE_MANIFEST_NAME);
    fs::write(&manifest_path, bytes)
        .map_err(|e| format!("failed writing provenance manifest: {e}"))?;

    Ok(FirmwareProvenanceWriteResult {
        path: manifest_path.display().to_string(),
        artifacts_bound: manifest.artifacts.len(),
    })
}

#[tauri::command]
pub fn firmware_bundle_planning_artifacts(directory: String) -> Result<Vec<String>, String> {
    let requested = directory.trim().replace('\\', "/");
    if requested.is_empty()
        || requested.starts_with('/')
        || requested.split('/').any(|part| part == ".." || part.is_empty())
    {
        return Err("firmware bundle directory must be a safe managed-library relative path".into());
    }

    let report = firmware_library_scan()?;
    let bundle = report
        .bundles
        .iter()
        .find(|bundle| bundle.directory.replace('\\', "/") == requested)
        .ok_or_else(|| "selected firmware bundle is no longer present in the managed library".to_string())?;

    if !bundle.planning_ready {
        return Err(format!(
            "selected firmware bundle is not planning-ready; resolve provenance, identity, hash, chipset, and package-completeness warnings first: {}",
            bundle.warnings.join(" | ")
        ));
    }

    let mut paths = report
        .entries
        .iter()
        .filter(|entry| {
            let parent = Path::new(&entry.relative_path)
                .parent()
                .map(|path| path.display().to_string().replace('\\', "/"))
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| ".".into());
            parent == requested
                && entry.eligible_for_planning
                && entry.artifact_kind != "provenance-manifest"
                && entry.artifact_kind != "other"
        })
        .map(|entry| entry.path.clone())
        .collect::<Vec<_>>();

    paths.sort();
    paths.dedup();
    if paths.is_empty() {
        return Err("planning-ready bundle contains no eligible planning artifacts".into());
    }
    Ok(paths)
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

    let mut hashes: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for entry in &entries {
        hashes
            .entry(entry.sha256.clone())
            .or_default()
            .push(entry.relative_path.clone());
    }
    for (sha256, paths) in hashes.into_iter().filter(|(_, paths)| paths.len() > 1) {
        warnings.push(format!(
            "Duplicate firmware content detected (sha256 {}): {}. Keep one authoritative copy per package to reduce operator ambiguity.",
            sha256,
            paths.join(", ")
        ));
    }

    let bundles = summarize_bundles(&root, &entries);

    Ok(FirmwareLibraryReport {
        root: root.display().to_string(),
        entries,
        vendor_counts,
        artifact_counts,
        blocked_count,
        bundles,
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
    fn qualcomm_bundle_requires_programmer_and_rawprogram() {
        let entries = vec![
            FirmwareLibraryEntry {
                path: "/tmp/q/prog.elf".into(),
                relative_path: "qualcomm/SM8550/model/prog.elf".into(),
                name: "prog.elf".into(),
                bytes: 1,
                sha256: "a".repeat(64),
                modified_unix_ms: None,
                vendor_hint: "qualcomm".into(),
                artifact_kind: "firehose-programmer".into(),
                chipset_matches: vec!["qualcomm:SM8550".into()],
                blocked: false,
                eligible_for_planning: true,
                warnings: vec![],
            },
            FirmwareLibraryEntry {
                path: "/tmp/q/rawprogram0.xml".into(),
                relative_path: "qualcomm/SM8550/model/rawprogram0.xml".into(),
                name: "rawprogram0.xml".into(),
                bytes: 1,
                sha256: "b".repeat(64),
                modified_unix_ms: None,
                vendor_hint: "qualcomm".into(),
                artifact_kind: "rawprogram-manifest".into(),
                chipset_matches: vec!["qualcomm:SM8550".into()],
                blocked: false,
                eligible_for_planning: true,
                warnings: vec![],
            },
        ];

        let bundles = summarize_bundles(Path::new("/tmp"), &entries);
        assert_eq!(bundles.len(), 1);
        assert!(!bundles[0].planning_ready);
        assert!(bundles[0].missing_required.is_empty());
        assert!(!bundles[0].provenance_present);
    }

    #[test]
    fn exact_provenance_and_hash_binding_unlocks_planning_readiness() {
        let root = std::env::temp_dir().join(format!(
            "bobfwtools-provenance-test-{}",
            std::process::id()
        ));
        let directory = root.join("qualcomm/SM8550/model");
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join(PROVENANCE_MANIFEST_NAME),
            r#"{
              "schema":"com.bobbyblanco.bobfwtools.firmware-provenance.v1",
              "vendor":"qualcomm",
              "chipsetFamily":"SM8550",
              "oem":"ExampleOEM",
              "model":"MODEL-1",
              "board":"BOARD-1",
              "sku":"SKU-1",
              "region":"US",
              "carrier":"unlocked",
              "buildVersion":"BUILD-1",
              "bootloaderRevision":"1",
              "storage":"ufs",
              "sourceCategory":"official-oem",
              "sourceReference":"OEM support package",
              "artifacts":[
                {"relativePath":"prog_ufs_firehose_sm8550.elf","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
                {"relativePath":"rawprogram0.xml","sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}
              ]
            }"#,
        )
        .unwrap();

        let entries = vec![
            FirmwareLibraryEntry {
                path: directory.join("prog_ufs_firehose_sm8550.elf").display().to_string(),
                relative_path: "qualcomm/SM8550/model/prog_ufs_firehose_sm8550.elf".into(),
                name: "prog_ufs_firehose_sm8550.elf".into(),
                bytes: 1,
                sha256: "a".repeat(64),
                modified_unix_ms: None,
                vendor_hint: "qualcomm".into(),
                artifact_kind: "firehose-programmer".into(),
                chipset_matches: vec!["qualcomm:SM8550".into()],
                blocked: false,
                eligible_for_planning: true,
                warnings: vec![],
            },
            FirmwareLibraryEntry {
                path: directory.join("rawprogram0.xml").display().to_string(),
                relative_path: "qualcomm/SM8550/model/rawprogram0.xml".into(),
                name: "rawprogram0.xml".into(),
                bytes: 1,
                sha256: "b".repeat(64),
                modified_unix_ms: None,
                vendor_hint: "qualcomm".into(),
                artifact_kind: "rawprogram-manifest".into(),
                chipset_matches: vec!["qualcomm:SM8550".into()],
                blocked: false,
                eligible_for_planning: true,
                warnings: vec![],
            },
            FirmwareLibraryEntry {
                path: directory.join(PROVENANCE_MANIFEST_NAME).display().to_string(),
                relative_path: format!("qualcomm/SM8550/model/{PROVENANCE_MANIFEST_NAME}"),
                name: PROVENANCE_MANIFEST_NAME.into(),
                bytes: 1,
                sha256: "c".repeat(64),
                modified_unix_ms: None,
                vendor_hint: "unknown".into(),
                artifact_kind: "provenance-manifest".into(),
                chipset_matches: vec![],
                blocked: false,
                eligible_for_planning: true,
                warnings: vec![],
            },
        ];

        let bundles = summarize_bundles(&root, &entries);
        assert_eq!(bundles.len(), 1);
        assert!(bundles[0].planning_ready);
        assert!(bundles[0].provenance_valid);
        assert!(bundles[0].exact_identity_present);
        assert_eq!(bundles[0].model.as_deref(), Some("MODEL-1"));
        assert_eq!(bundles[0].board.as_deref(), Some("BOARD-1"));
        assert_eq!(bundles[0].sku.as_deref(), Some("SKU-1"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn conflicting_chipset_evidence_blocks_bundle_readiness() {
        let entries = vec![
            FirmwareLibraryEntry {
                path: "/tmp/q/prog.elf".into(),
                relative_path: "qualcomm/mixed/prog.elf".into(),
                name: "prog.elf".into(),
                bytes: 1,
                sha256: "a".repeat(64),
                modified_unix_ms: None,
                vendor_hint: "qualcomm".into(),
                artifact_kind: "firehose-programmer".into(),
                chipset_matches: vec!["qualcomm:SM8550".into()],
                blocked: false,
                eligible_for_planning: true,
                warnings: vec![],
            },
            FirmwareLibraryEntry {
                path: "/tmp/q/rawprogram0.xml".into(),
                relative_path: "qualcomm/mixed/rawprogram0.xml".into(),
                name: "rawprogram0.xml".into(),
                bytes: 1,
                sha256: "b".repeat(64),
                modified_unix_ms: None,
                vendor_hint: "qualcomm".into(),
                artifact_kind: "rawprogram-manifest".into(),
                chipset_matches: vec!["qualcomm:SM8650".into()],
                blocked: false,
                eligible_for_planning: true,
                warnings: vec![],
            },
        ];

        let bundles = summarize_bundles(Path::new("/tmp"), &entries);
        assert_eq!(bundles.len(), 1);
        assert!(!bundles[0].planning_ready);
        assert!(bundles[0]
            .warnings
            .iter()
            .any(|warning| warning.contains("multiple qualcomm chipset families")));
    }

    #[test]
    fn blocks_bypass_markers() {
        assert!(blocked_marker("prog_firehose_auth-bypass.elf").is_some());
        assert!(blocked_marker("mtk_sla_bypass.bin").is_some());
        assert!(blocked_marker("stock_prog_firehose.elf").is_none());
    }
}
