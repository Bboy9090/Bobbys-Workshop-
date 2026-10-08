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
    pub job_fingerprint: String,
    pub identity: DeviceIdentitySnapshot,
    pub artifact_digests: Vec<ArtifactDigest>,
    pub payload_digests: Vec<ArtifactDigest>,
    pub operations: Vec<PartitionOperation>,
    pub integrity_checks_passed: bool,
    pub integrity_findings: Vec<String>,
    pub high_risk_partitions: Vec<String>,
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

fn resolve_payload_path(layout_path: &Path, filename: &str) -> Result<PathBuf, RecoveryJobError> {
    if !safe_relative_path(filename) {
        return Err(RecoveryJobError::UnsafePath(filename.to_string()));
    }
    let base = layout_path.parent().unwrap_or_else(|| Path::new("."));
    let candidate = base.join(filename);
    if !candidate.is_file() {
        return Err(RecoveryJobError::Io {
            path: candidate.display().to_string(),
            message: "referenced recovery payload does not exist as a regular file".to_string(),
        });
    }
    Ok(candidate)
}

fn same_storage_domain(a: &PartitionOperation, b: &PartitionOperation) -> bool {
    match (a.physical_partition, b.physical_partition) {
        (Some(x), Some(y)) => x == y,
        (None, None) => a.region == b.region,
        _ => false,
    }
}

fn overlapping_operation_pairs(operations: &[PartitionOperation]) -> Vec<String> {
    let mut issues = Vec::new();
    for (i, a) in operations.iter().enumerate() {
        let (Some(a_start), Some(a_len)) = (a.start, a.length) else {
            continue;
        };
        let Some(a_end) = a_start.checked_add(a_len) else {
            issues.push(format!("operation {} range overflows u64", a.filename));
            continue;
        };
        for b in operations.iter().skip(i + 1) {
            if !same_storage_domain(a, b) {
                continue;
            }
            let (Some(b_start), Some(b_len)) = (b.start, b.length) else {
                continue;
            };
            let Some(b_end) = b_start.checked_add(b_len) else {
                issues.push(format!("operation {} range overflows u64", b.filename));
                continue;
            };
            if a_start < b_end && b_start < a_end {
                issues.push(format!(
                    "overlapping recovery ranges: {} [{:#x},{:#x}) and {} [{:#x},{:#x})",
                    a.filename, a_start, a_end, b.filename, b_start, b_end
                ));
            }
        }
    }
    issues
}

fn collect_high_risk_partitions(operations: &[PartitionOperation]) -> Vec<String> {
    let high_risk = [
        "xbl",
        "xbl_config",
        "abl",
        "sbl1",
        "tz",
        "hyp",
        "rpm",
        "devcfg",
        "uefisecapp",
        "bootloader",
        "lk",
        "lk2",
        "preloader",
        "pgpt",
        "gpt",
        "persist",
        "modem",
        "modemst1",
        "modemst2",
        "fsg",
        "fsc",
        "efs",
    ];
    let mut out = Vec::new();
    for op in operations {
        let Some(name) = op.partition_name.as_ref() else {
            continue;
        };
        if high_risk.iter().any(|risk| name.eq_ignore_ascii_case(risk))
            && !out
                .iter()
                .any(|seen: &String| seen.eq_ignore_ascii_case(name))
        {
            out.push(name.clone());
        }
    }
    out
}

fn hash_referenced_payloads(
    layout_path: &Path,
    operations: &[PartitionOperation],
    seen: &mut BTreeMap<String, ArtifactDigest>,
) -> Result<(), RecoveryJobError> {
    for op in operations {
        let payload = resolve_payload_path(layout_path, &op.filename)?;
        let digest = hash_artifact(&payload, "recovery-payload")?;
        if digest.size == 0 {
            return Err(RecoveryJobError::InvalidLayout {
                path: payload.display().to_string(),
                message: "referenced recovery payload is empty".to_string(),
            });
        }
        seen.entry(payload.display().to_string()).or_insert(digest);
    }
    Ok(())
}


pub fn recovery_job_fingerprint(job: &RecoveryJob) -> String {
    fn push_field(hasher: &mut Sha256, key: &str, value: &str) {
        hasher.update(key.as_bytes());
        hasher.update(b"=");
        hasher.update(value.as_bytes());
        hasher.update(b"
");
    }

    let mut hasher = Sha256::new();
    push_field(&mut hasher, "schema", "bobfwtools-recovery-job-core-v1");
    push_field(&mut hasher, "workflow", &format!("{:?}", job.workflow));
    push_field(&mut hasher, "protocol", &job.protocol);
    push_field(&mut hasher, "device_uid", &job.identity.device_uid);
    push_field(&mut hasher, "vendor_id", &format!("{:04x}", job.identity.vendor_id));
    push_field(&mut hasher, "product_id", &format!("{:04x}", job.identity.product_id));
    push_field(&mut hasher, "mode", &job.identity.mode);
    push_field(
        &mut hasher,
        "serial",
        job.identity.serial_number.as_deref().unwrap_or("<none>"),
    );
    push_field(&mut hasher, "destructive", &job.destructive.to_string());
    push_field(
        &mut hasher,
        "requires_explicit_approval",
        &job.requires_explicit_approval.to_string(),
    );
    push_field(
        &mut hasher,
        "prerequisites_met",
        &job.prerequisites_met.to_string(),
    );
    push_field(
        &mut hasher,
        "integrity_checks_passed",
        &job.integrity_checks_passed.to_string(),
    );

    let mut artifacts = job
        .artifact_digests
        .iter()
        .map(|a| format!("{}|{}|{}|{}", a.role, a.path, a.size, a.sha256))
        .collect::<Vec<_>>();
    artifacts.sort();
    for value in artifacts {
        push_field(&mut hasher, "artifact", &value);
    }

    let mut payloads = job
        .payload_digests
        .iter()
        .map(|a| format!("{}|{}|{}|{}", a.role, a.path, a.size, a.sha256))
        .collect::<Vec<_>>();
    payloads.sort();
    for value in payloads {
        push_field(&mut hasher, "payload", &value);
    }

    let mut operations = job
        .operations
        .iter()
        .map(|op| {
            format!(
                "{}|{}|{:?}|{:?}|{:?}|{:?}|{}",
                op.partition_name.as_deref().unwrap_or("<none>"),
                op.filename,
                op.start,
                op.length,
                op.physical_partition,
                op.region,
                op.operation
            )
        })
        .collect::<Vec<_>>();
    operations.sort();
    for value in operations {
        push_field(&mut hasher, "operation", &value);
    }

    let mut high_risk = job.high_risk_partitions.clone();
    high_risk.sort();
    for value in high_risk {
        push_field(&mut hasher, "high_risk_partition", &value);
    }

    format!("{:x}", hasher.finalize())
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
    let mut payload_digest_map: BTreeMap<String, ArtifactDigest> = BTreeMap::new();
    let mut operations = Vec::new();
    for artifact in &plan.artifacts {
        let path = PathBuf::from(&artifact.path);
        artifact_digests.push(hash_artifact(&path, &artifact.role)?);
        match (plan.workflow, artifact.role.as_str()) {
            (RecoveryKind::QualcommEdl, "rawprogram") => {
                let parsed = parse_qualcomm_rawprogram(&path)?;
                hash_referenced_payloads(&path, &parsed, &mut payload_digest_map)?;
                operations.extend(parsed);
            }
            (RecoveryKind::MediatekDownload, "scatter") => {
                let parsed = parse_mtk_scatter(&path)?;
                hash_referenced_payloads(&path, &parsed, &mut payload_digest_map)?;
                operations.extend(parsed);
            }
            _ => {}
        }
    }
    let payload_digests = payload_digest_map.into_values().collect::<Vec<_>>();
    let overlap_issues = overlapping_operation_pairs(&operations);
    let integrity_findings = overlap_issues.clone();
    let high_risk_partitions = collect_high_risk_partitions(&operations);
    let integrity_checks_passed =
        !operations.is_empty() && !payload_digests.is_empty() && overlap_issues.is_empty();

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
    blockers.extend(overlap_issues);
    if !high_risk_partitions.is_empty() {
        blockers.push(format!(
            "High-risk partitions require elevated explicit approval and designated-device evidence: {}",
            high_risk_partitions.join(", ")
        ));
    }

    let mut job = RecoveryJob {
        workflow: plan.workflow,
        protocol: plan.protocol.clone(),
        job_fingerprint: String::new(),
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
        payload_digests,
        operations,
        integrity_checks_passed,
        integrity_findings,
        high_risk_partitions,
        destructive: plan.destructive,
        requires_explicit_approval: plan.requires_explicit_approval,
        prerequisites_met: plan.prerequisites_met,
        identity_revalidated: false,
        executor_qualified: false,
        execution_ready: false,
        blockers,
    };
    job.job_fingerprint = recovery_job_fingerprint(&job);
    Ok(job)
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
    fn hashes_referenced_payloads_and_rejects_missing_files() {
        let dir = tempfile::tempdir().unwrap();
        let layout = dir.path().join("rawprogram0.xml");
        std::fs::write(
            &layout,
            r#"<data><program filename="boot.img" label="boot" num_partition_sectors="8" start_sector="0" physical_partition_number="0" /></data>"#,
        ).unwrap();
        let ops = parse_qualcomm_rawprogram(&layout).unwrap();
        let mut seen = BTreeMap::new();
        assert!(hash_referenced_payloads(&layout, &ops, &mut seen).is_err());

        std::fs::write(dir.path().join("boot.img"), vec![0x5au8; 1024]).unwrap();
        hash_referenced_payloads(&layout, &ops, &mut seen).unwrap();
        assert_eq!(seen.len(), 1);
        let digest = seen.values().next().unwrap();
        assert_eq!(digest.size, 1024);
        assert_eq!(digest.sha256.len(), 64);
    }

    #[test]
    fn detects_overlapping_partition_ranges() {
        let ops = vec![
            PartitionOperation {
                partition_name: Some("a".into()),
                filename: "a.bin".into(),
                start: Some(0x1000),
                length: Some(0x1000),
                physical_partition: Some(0),
                region: None,
                operation: "program".into(),
            },
            PartitionOperation {
                partition_name: Some("b".into()),
                filename: "b.bin".into(),
                start: Some(0x1800),
                length: Some(0x1000),
                physical_partition: Some(0),
                region: None,
                operation: "program".into(),
            },
        ];
        let issues = overlapping_operation_pairs(&ops);
        assert_eq!(issues.len(), 1);
        assert!(issues[0].contains("overlapping recovery ranges"));
    }

    #[test]
    fn identity_revalidation_never_unlocks_unqualified_executor() {
        let mut job = RecoveryJob {
            workflow: RecoveryKind::QualcommEdl,
            protocol: "qualcomm-sahara-firehose".into(),
            job_fingerprint: String::new(),
            identity: DeviceIdentitySnapshot {
                device_uid: "usb:05c6:9008:SERIAL".into(),
                vendor_id: 0x05c6,
                product_id: 0x9008,
                mode: "qualcomm-edl".into(),
                serial_number: Some("SERIAL".into()),
                bus_number: None,
                device_address: None,
            },
            artifact_digests: vec![],
            payload_digests: vec![],
            operations: vec![PartitionOperation {
                partition_name: Some("boot".into()),
                filename: "boot.img".into(),
                start: Some(0),
                length: Some(4096),
                physical_partition: Some(0),
                region: None,
                operation: "program".into(),
            }],
            integrity_checks_passed: true,
            integrity_findings: vec![],
            high_risk_partitions: vec![],
            destructive: true,
            requires_explicit_approval: true,
            prerequisites_met: true,
            identity_revalidated: false,
            executor_qualified: false,
            execution_ready: false,
            blockers: vec!["Protocol executor has not yet passed physical-device qualification for this workflow.".into()],
        };
        let current = TransportDevice {
            device_uid: job.identity.device_uid.clone(),
            vendor_id: job.identity.vendor_id,
            product_id: job.identity.product_id,
            bus_number: 1,
            device_address: 2,
            manufacturer: Some("Qualcomm".into()),
            product_name: Some("QDLoader 9008".into()),
            serial_number: job.identity.serial_number.clone(),
            mode: job.identity.mode.clone(),
            endpoints: vec![],
            bulk_in: vec![0x81],
            bulk_out: vec![0x01],
        };

        revalidate_job_identity(&mut job, &current).unwrap();
        assert!(job.identity_revalidated);
        assert!(!job.executor_qualified);
        assert!(!job.execution_ready);
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
    #[test]
    fn flags_high_risk_partitions() {
        let ops = vec![
            PartitionOperation {
                partition_name: Some("preloader".into()),
                filename: "preloader.bin".into(),
                start: Some(0),
                length: Some(4096),
                physical_partition: None,
                region: Some("EMMC_BOOT_1".into()),
                operation: "download".into(),
            },
            PartitionOperation {
                partition_name: Some("system_a".into()),
                filename: "system.img".into(),
                start: Some(8192),
                length: Some(4096),
                physical_partition: None,
                region: Some("EMMC_USER".into()),
                operation: "download".into(),
            },
        ];
        assert_eq!(
            collect_high_risk_partitions(&ops),
            vec!["preloader".to_string()]
        );
    }
    #[test]
    fn fingerprint_binds_core_job_but_not_live_gate_state() {
        let mut job = RecoveryJob {
            workflow: RecoveryKind::QualcommEdl,
            protocol: "qualcomm-sahara-firehose".into(),
            job_fingerprint: String::new(),
            identity: DeviceIdentitySnapshot {
                device_uid: "usb:05c6:9008:SERIAL".into(),
                vendor_id: 0x05c6,
                product_id: 0x9008,
                mode: "qualcomm-edl".into(),
                serial_number: Some("SERIAL".into()),
                bus_number: None,
                device_address: None,
            },
            artifact_digests: vec![ArtifactDigest {
                path: "/approved/rawprogram0.xml".into(),
                role: "rawprogram".into(),
                size: 123,
                sha256: "a".repeat(64),
            }],
            payload_digests: vec![ArtifactDigest {
                path: "/approved/boot.img".into(),
                role: "recovery-payload".into(),
                size: 4096,
                sha256: "b".repeat(64),
            }],
            operations: vec![PartitionOperation {
                partition_name: Some("boot".into()),
                filename: "boot.img".into(),
                start: Some(0),
                length: Some(4096),
                physical_partition: Some(0),
                region: None,
                operation: "program".into(),
            }],
            integrity_checks_passed: true,
            integrity_findings: vec![],
            high_risk_partitions: vec![],
            destructive: true,
            requires_explicit_approval: true,
            prerequisites_met: true,
            identity_revalidated: false,
            executor_qualified: false,
            execution_ready: false,
            blockers: vec!["qualification pending".into()],
        };
        let first = recovery_job_fingerprint(&job);
        job.identity_revalidated = true;
        job.blockers.push("operator note".into());
        let second = recovery_job_fingerprint(&job);
        assert_eq!(first, second);

        job.payload_digests[0].sha256 = "c".repeat(64);
        let changed = recovery_job_fingerprint(&job);
        assert_ne!(first, changed);
    }

}
