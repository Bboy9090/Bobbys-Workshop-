use crate::recovery::{RecoveryCandidate, RecoveryKind, RecoveryPlan};
use crate::transport::TransportDevice;
use quick_xml::events::Event;
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::{Component, Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum RecoveryJobError {
    #[error("failed to read {path}: {message}")]
    Io { path: String, message: String },
    #[error("invalid recovery layout in {path}: {message}")]
    InvalidLayout { path: String, message: String },
    #[error("unsafe payload path in recovery layout: {0}")]
    UnsafePath(String),
    #[error("recovery candidate workflow does not match the requested plan")]
    WorkflowMismatch,
    #[error("device identity changed after recovery planning")]
    IdentityChanged,
    #[error("recovery plan prerequisites are not satisfied")]
    PrerequisitesMissing,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceIdentitySnapshot {
    pub device_uid: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub mode: String,
    pub serial_number: Option<String>,
    pub bus_number: Option<u8>,
    pub device_address: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactDigest {
    pub path: String,
    pub role: String,
    pub size: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartitionOperation {
    pub partition_name: Option<String>,
    pub filename: String,
    pub start: Option<u64>,
    pub length: Option<u64>,
    pub physical_partition: Option<u32>,
    pub region: Option<String>,
    pub operation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryJob {
    pub workflow: RecoveryKind,
    pub protocol: String,
    pub identity: DeviceIdentitySnapshot,
    pub artifact_digests: Vec<ArtifactDigest>,
    pub operations: Vec<PartitionOperation>,
    pub destructive: bool,
    pub requires_explicit_approval: bool,
    pub prerequisites_met: bool,
    pub identity_revalidated: bool,
    pub executor_qualified: bool,
    pub execution_ready: bool,
    pub blockers: Vec<String>,
}

fn safe_relative_path(value: &str) -> bool {
    if value.trim().is_empty() || value == "NONE" {
        return true;
    }
    let path = Path::new(value);
    if path.is_absolute() {
        return false;
    }
    !path.components().any(|c| {
        matches!(
            c,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    })
}

fn parse_u64(value: &str) -> Option<u64> {
    let v = value.trim();
    if let Some(hex) = v.strip_prefix("0x").or_else(|| v.strip_prefix("0X")) {
        u64::from_str_radix(hex, 16).ok()
    } else {
        v.parse().ok()
    }
}

fn parse_u32(value: &str) -> Option<u32> {
    parse_u64(value).and_then(|v| u32::try_from(v).ok())
}

pub fn hash_artifact(path: &Path, role: &str) -> Result<ArtifactDigest, RecoveryJobError> {
    let mut file = File::open(path).map_err(|e| RecoveryJobError::Io {
        path: path.display().to_string(),
        message: e.to_string(),
    })?;
    let size = file
        .metadata()
        .map_err(|e| RecoveryJobError::Io {
            path: path.display().to_string(),
            message: e.to_string(),
        })?
        .len();
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1024 * 1024];
    loop {
        let n = file.read(&mut buf).map_err(|e| RecoveryJobError::Io {
            path: path.display().to_string(),
            message: e.to_string(),
        })?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(ArtifactDigest {
        path: path.display().to_string(),
        role: role.to_string(),
        size,
        sha256: format!("{:x}", hasher.finalize()),
    })
}

pub fn parse_qualcomm_rawprogram(path: &Path) -> Result<Vec<PartitionOperation>, RecoveryJobError> {
    let mut reader = Reader::from_file(path).map_err(|e| RecoveryJobError::Io {
        path: path.display().to_string(),
        message: e.to_string(),
    })?;
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut out = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(e)) | Ok(Event::Start(e)) if e.name().as_ref() == b"program" => {
                let mut attrs = BTreeMap::new();
                for attr in e.attributes().with_checks(false) {
                    let attr = attr.map_err(|e| RecoveryJobError::InvalidLayout {
                        path: path.display().to_string(),
                        message: e.to_string(),
                    })?;
                    let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                    let val = attr
                        .unescape_value()
                        .map_err(|e| RecoveryJobError::InvalidLayout {
                            path: path.display().to_string(),
                            message: e.to_string(),
                        })?
                        .into_owned();
                    attrs.insert(key, val);
                }
                let filename = attrs.get("filename").cloned().unwrap_or_default();
                if filename.trim().is_empty() {
                    buf.clear();
                    continue;
                }
                if !safe_relative_path(&filename) {
                    return Err(RecoveryJobError::UnsafePath(filename));
                }
                let start_sector = attrs.get("start_sector").and_then(|v| parse_u64(v));
                let sectors = attrs
                    .get("num_partition_sectors")
                    .and_then(|v| parse_u64(v));
                let sector_size = attrs
                    .get("SECTOR_SIZE_IN_BYTES")
                    .and_then(|v| parse_u64(v))
                    .unwrap_or(512);
                let start = start_sector.map(|v| v.saturating_mul(sector_size));
                let length = sectors.map(|v| v.saturating_mul(sector_size));
                out.push(PartitionOperation {
                    partition_name: attrs.get("label").cloned().filter(|v| !v.is_empty()),
                    filename,
                    start,
                    length,
                    physical_partition: attrs
                        .get("physical_partition_number")
                        .and_then(|v| parse_u32(v)),
                    region: None,
                    operation: "program".to_string(),
                });
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(RecoveryJobError::InvalidLayout {
                    path: path.display().to_string(),
                    message: e.to_string(),
                })
            }
            _ => {}
        }
        buf.clear();
    }
    if out.is_empty() {
        return Err(RecoveryJobError::InvalidLayout {
            path: path.display().to_string(),
            message: "no program entries found".to_string(),
        });
    }
    Ok(out)
}

pub fn parse_mtk_scatter(path: &Path) -> Result<Vec<PartitionOperation>, RecoveryJobError> {
    let file = File::open(path).map_err(|e| RecoveryJobError::Io {
        path: path.display().to_string(),
        message: e.to_string(),
    })?;
    let reader = BufReader::new(file);
    let mut blocks: Vec<BTreeMap<String, String>> = Vec::new();
    let mut current = BTreeMap::new();

    for line in reader.lines() {
        let line = line.map_err(|e| RecoveryJobError::Io {
            path: path.display().to_string(),
            message: e.to_string(),
        })?;
        let trimmed = line.trim();
        if trimmed.starts_with("- partition_index:") && !current.is_empty() {
            blocks.push(std::mem::take(&mut current));
        }
        let clean = trimmed.strip_prefix('-').unwrap_or(trimmed).trim();
        if let Some((k, v)) = clean.split_once(':') {
            current.insert(k.trim().to_string(), v.trim().trim_matches('"').to_string());
        }
    }
    if !current.is_empty() {
        blocks.push(current);
    }

    let mut out = Vec::new();
    for b in blocks {
        let enabled = b
            .get("is_download")
            .map(|v| v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);
        if !enabled {
            continue;
        }
        let filename = b.get("file_name").cloned().unwrap_or_default();
        if filename.is_empty() || filename.eq_ignore_ascii_case("NONE") {
            continue;
        }
        if !safe_relative_path(&filename) {
            return Err(RecoveryJobError::UnsafePath(filename));
        }
        out.push(PartitionOperation {
            partition_name: b.get("partition_name").cloned(),
            filename,
            start: b
                .get("linear_start_addr")
                .or_else(|| b.get("physical_start_addr"))
                .and_then(|v| parse_u64(v)),
            length: b.get("partition_size").and_then(|v| parse_u64(v)),
            physical_partition: None,
            region: b
                .get("region")
                .cloned()
                .or_else(|| b.get("storage").cloned()),
            operation: "download".to_string(),
        });
    }
    if out.is_empty() {
        return Err(RecoveryJobError::InvalidLayout {
            path: path.display().to_string(),
            message: "no downloadable partitions found".to_string(),
        });
    }
    Ok(out)
}

pub fn identity_from_candidate(
    candidate: &RecoveryCandidate,
    transport: Option<&TransportDevice>,
) -> DeviceIdentitySnapshot {
    DeviceIdentitySnapshot {
        device_uid: candidate.device_uid.clone(),
        vendor_id: candidate.vendor_id,
        product_id: candidate.product_id,
        mode: candidate.detected_mode.clone(),
        serial_number: candidate.serial_number.clone(),
        bus_number: transport.map(|d| d.bus_number),
        device_address: transport.map(|d| d.device_address),
    }
}

pub fn same_identity(snapshot: &DeviceIdentitySnapshot, current: &TransportDevice) -> bool {
    snapshot.device_uid == current.device_uid
        && snapshot.vendor_id == current.vendor_id
        && snapshot.product_id == current.product_id
        && snapshot.mode == current.mode
        && snapshot.serial_number == current.serial_number
}

pub fn build_job(
    candidate: &RecoveryCandidate,
    plan: &RecoveryPlan,
) -> Result<RecoveryJob, RecoveryJobError> {
    if candidate.workflow != plan.workflow {
        return Err(RecoveryJobError::WorkflowMismatch);
    }
    if !plan.prerequisites_met {
        return Err(RecoveryJobError::PrerequisitesMissing);
    }

    let mut artifact_digests = Vec::new();
    let mut operations = Vec::new();
    for artifact in &plan.artifacts {
        let path = PathBuf::from(&artifact.path);
        artifact_digests.push(hash_artifact(&path, &artifact.role)?);
        match (plan.workflow, artifact.role.as_str()) {
            (RecoveryKind::QualcommEdl, "rawprogram") => {
                operations.extend(parse_qualcomm_rawprogram(&path)?)
            }
            (RecoveryKind::MediatekDownload, "scatter") => {
                operations.extend(parse_mtk_scatter(&path)?)
            }
            _ => {}
        }
    }

    let mut blockers = Vec::new();
    blockers.push(
        "Protocol executor has not yet passed physical-device qualification for this workflow."
            .to_string(),
    );
    if operations.is_empty() {
        blockers.push(
            "No normalized partition operations were produced from the selected recovery layout."
                .to_string(),
        );
    }

    Ok(RecoveryJob {
        workflow: plan.workflow,
        protocol: plan.protocol.clone(),
        identity: DeviceIdentitySnapshot {
            device_uid: candidate.device_uid.clone(),
            vendor_id: candidate.vendor_id,
            product_id: candidate.product_id,
            mode: candidate.detected_mode.clone(),
            serial_number: candidate.serial_number.clone(),
            bus_number: None,
            device_address: None,
        },
        artifact_digests,
        operations,
        destructive: plan.destructive,
        requires_explicit_approval: plan.requires_explicit_approval,
        prerequisites_met: plan.prerequisites_met,
        identity_revalidated: false,
        executor_qualified: false,
        execution_ready: false,
        blockers,
    })
}

pub fn revalidate_job_identity(
    job: &mut RecoveryJob,
    current: &TransportDevice,
) -> Result<(), RecoveryJobError> {
    if !same_identity(&job.identity, current) {
        return Err(RecoveryJobError::IdentityChanged);
    }
    job.identity_revalidated = true;
    job.execution_ready =
        job.prerequisites_met && job.executor_qualified && job.blockers.is_empty();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_rawprogram_into_byte_ranges() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("rawprogram0.xml");
        std::fs::write(&p, r#"<data><program SECTOR_SIZE_IN_BYTES="512" file_sector_offset="0" filename="boot.img" label="boot" num_partition_sectors="16" physical_partition_number="0" start_sector="2048" /></data>"#).unwrap();
        let ops = parse_qualcomm_rawprogram(&p).unwrap();
        assert_eq!(ops.len(), 1);
        assert_eq!(ops[0].start, Some(2048 * 512));
        assert_eq!(ops[0].length, Some(16 * 512));
    }

    #[test]
    fn parses_mtk_scatter_download_entries() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("scatter.txt");
        std::fs::write(&p, "- partition_index: SYS0\n  partition_name: preloader\n  file_name: preloader.bin\n  is_download: true\n  linear_start_addr: 0x0\n  partition_size: 0x40000\n  region: EMMC_BOOT_1\n- partition_index: SYS1\n  partition_name: cache\n  file_name: NONE\n  is_download: false\n").unwrap();
        let ops = parse_mtk_scatter(&p).unwrap();
        assert_eq!(ops.len(), 1);
        assert_eq!(ops[0].partition_name.as_deref(), Some("preloader"));
        assert_eq!(ops[0].length, Some(0x40000));
    }


    #[test]
    fn identity_revalidation_requires_same_bound_device() {
        let snapshot = DeviceIdentitySnapshot {
            device_uid: "usb:05c6:9008:SERIAL".into(),
            vendor_id: 0x05c6,
            product_id: 0x9008,
            mode: "qualcomm-edl".into(),
            serial_number: Some("SERIAL".into()),
            bus_number: None,
            device_address: None,
        };
        let current = TransportDevice {
            device_uid: snapshot.device_uid.clone(),
            vendor_id: snapshot.vendor_id,
            product_id: snapshot.product_id,
            bus_number: 1,
            device_address: 2,
            manufacturer: Some("Qualcomm".into()),
            product_name: Some("QDLoader 9008".into()),
            serial_number: snapshot.serial_number.clone(),
            mode: snapshot.mode.clone(),
            endpoints: vec![],
            bulk_in: vec![0x81],
            bulk_out: vec![0x01],
        };
        assert!(same_identity(&snapshot, &current));

        let mut swapped = current.clone();
        swapped.device_uid = "usb:05c6:9008:OTHER".into();
        swapped.serial_number = Some("OTHER".into());
        assert!(!same_identity(&snapshot, &swapped));
    }

    #[test]
    fn rejects_parent_directory_payload_paths() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("rawprogram0.xml");
        std::fs::write(&p, r#"<data><program filename="../secret.bin" num_partition_sectors="1" start_sector="0" /></data>"#).unwrap();
        assert!(matches!(
            parse_qualcomm_rawprogram(&p),
            Err(RecoveryJobError::UnsafePath(_))
        ));
    }
}
