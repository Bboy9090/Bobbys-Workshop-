use md5::{Digest, Md5};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom};
use std::path::Path;
use tar::Archive;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum FirmwareError {
    #[error("failed to open firmware package {path}: {source}")]
    Open { path: String, source: io::Error },
    #[error("invalid .tar.md5 footer in {0}")]
    InvalidMd5Footer(String),
    #[error("MD5 verification failed for {0}")]
    Md5Mismatch(String),
    #[error("failed to read firmware archive {path}: {source}")]
    Archive { path: String, source: io::Error },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareEntry {
    pub path: String,
    pub size: u64,
    pub kind: String,
    pub candidate_partition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareArchiveReport {
    pub path: String,
    pub role: String,
    pub file_size: u64,
    pub md5_verified: Option<bool>,
    pub embedded_md5: Option<String>,
    pub calculated_md5: Option<String>,
    pub contains_pit: bool,
    pub contains_userdata: bool,
    pub contains_metadata: bool,
    pub download_list: Vec<String>,
    pub entries: Vec<FirmwareEntry>,
    pub warnings: Vec<String>,
}

fn role_from_name(path: &Path) -> String {
    let name = path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or_default()
        .to_ascii_uppercase();
    if name.starts_with("HOME_CSC_") {
        "HOME_CSC"
    } else if name.starts_with("CSC_") {
        "CSC"
    } else if name.starts_with("BL_") {
        "BL"
    } else if name.starts_with("AP_") {
        "AP"
    } else if name.starts_with("CP_") {
        "CP"
    } else {
        "UNKNOWN"
    }
    .to_string()
}

fn entry_kind(path: &str) -> String {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".pit") {
        "pit"
    } else if lower.ends_with(".img.lz4") || lower.ends_with(".img") {
        "image"
    } else if lower.ends_with(".bin.lz4") || lower.ends_with(".bin") {
        "binary"
    } else if lower.ends_with(".elf.lz4") || lower.ends_with(".elf") {
        "elf"
    } else if lower.ends_with(".mbn.lz4") || lower.ends_with(".mbn") {
        "mbn"
    } else if lower.ends_with("download-list.txt") {
        "manifest"
    } else {
        "other"
    }
    .to_string()
}

fn candidate_partition(path: &str) -> Option<String> {
    let base = Path::new(path).file_name()?.to_str()?;
    let mut name = base.to_string();
    for suffix in [".lz4", ".img", ".bin", ".elf", ".mbn"] {
        if name.to_ascii_lowercase().ends_with(suffix) {
            let len = name.len() - suffix.len();
            name.truncate(len);
        }
    }
    if name.is_empty() || name.eq_ignore_ascii_case("download-list") {
        None
    } else {
        Some(name.to_ascii_uppercase())
    }
}

fn locate_md5_footer(file: &mut File, file_size: u64) -> io::Result<Option<(u64, String)>> {
    if file_size < 34 {
        return Ok(None);
    }
    let tail_len = file_size.min(512) as usize;
    file.seek(SeekFrom::End(-(tail_len as i64)))?;
    let mut tail = vec![0u8; tail_len];
    file.read_exact(&mut tail)?;

    // Samsung Odin packages append an md5sum-style line after the TAR zero blocks:
    // <32 hex chars><two spaces><original .tar filename>\n
    // The final NUL byte marks the exact end of the TAR payload.
    let Some(last_nul) = tail.iter().rposition(|b| *b == 0) else {
        return Ok(None);
    };
    let footer = &tail[last_nul + 1..];
    let footer_text = String::from_utf8_lossy(footer);
    let Some(line) = footer_text.lines().find(|line| !line.trim().is_empty()) else {
        return Ok(None);
    };
    if line.len() < 32 || !line.as_bytes()[..32].iter().all(|b| b.is_ascii_hexdigit()) {
        return Ok(None);
    }

    let expected = line[..32].to_ascii_lowercase();
    let payload_end = file_size - tail_len as u64 + last_nul as u64 + 1;
    Ok(Some((payload_end, expected)))
}

fn verify_md5(path: &Path) -> Result<(bool, String, String, u64), FirmwareError> {
    let mut file = File::open(path).map_err(|source| FirmwareError::Open {
        path: path.display().to_string(),
        source,
    })?;
    let size = file
        .metadata()
        .map_err(|source| FirmwareError::Open {
            path: path.display().to_string(),
            source,
        })?
        .len();
    let Some((payload_len, expected)) =
        locate_md5_footer(&mut file, size).map_err(|source| FirmwareError::Archive {
            path: path.display().to_string(),
            source,
        })?
    else {
        return Err(FirmwareError::InvalidMd5Footer(path.display().to_string()));
    };

    file.seek(SeekFrom::Start(0))
        .map_err(|source| FirmwareError::Archive {
            path: path.display().to_string(),
            source,
        })?;
    let mut hasher = Md5::new();
    let mut remaining = payload_len;
    let mut buf = vec![0u8; 1024 * 1024];
    while remaining > 0 {
        let take = std::cmp::min(remaining, buf.len() as u64) as usize;
        file.read_exact(&mut buf[..take])
            .map_err(|source| FirmwareError::Archive {
                path: path.display().to_string(),
                source,
            })?;
        hasher.update(&buf[..take]);
        remaining -= take as u64;
    }
    let calculated = format!("{:x}", hasher.finalize());
    Ok((calculated == expected, expected, calculated, payload_len))
}

pub fn inspect_archive(path: impl AsRef<Path>) -> Result<FirmwareArchiveReport, FirmwareError> {
    let path = path.as_ref();
    let file_size = std::fs::metadata(path)
        .map_err(|source| FirmwareError::Open {
            path: path.display().to_string(),
            source,
        })?
        .len();
    let is_md5 = path
        .to_string_lossy()
        .to_ascii_lowercase()
        .ends_with(".tar.md5");
    let (md5_verified, embedded_md5, calculated_md5, tar_len) = if is_md5 {
        let (ok, expected, actual, payload_len) = verify_md5(path)?;
        if !ok {
            return Err(FirmwareError::Md5Mismatch(path.display().to_string()));
        }
        (Some(true), Some(expected), Some(actual), payload_len)
    } else {
        (None, None, None, file_size)
    };

    let file = File::open(path).map_err(|source| FirmwareError::Open {
        path: path.display().to_string(),
        source,
    })?;
    let reader = file.take(tar_len);
    let mut archive = Archive::new(reader);
    let mut entries_out = Vec::new();
    let mut contains_pit = false;
    let mut contains_userdata = false;
    let mut contains_metadata = false;
    let mut download_list = Vec::new();
    let mut warnings = Vec::new();

    let entries = archive.entries().map_err(|source| FirmwareError::Archive {
        path: path.display().to_string(),
        source,
    })?;
    for item in entries {
        let mut entry = item.map_err(|source| FirmwareError::Archive {
            path: path.display().to_string(),
            source,
        })?;
        let entry_path = entry
            .path()
            .map_err(|source| FirmwareError::Archive {
                path: path.display().to_string(),
                source,
            })?
            .to_string_lossy()
            .to_string();
        let lower = entry_path.to_ascii_lowercase();
        if lower.ends_with(".pit") {
            contains_pit = true;
        }
        if lower.ends_with("userdata.img") || lower.ends_with("userdata.img.lz4") {
            contains_userdata = true;
        }
        if lower.ends_with("metadata.img") || lower.ends_with("metadata.img.lz4") {
            contains_metadata = true;
        }
        if lower.ends_with("download-list.txt") {
            let mut text = String::new();
            if let Err(e) = entry.read_to_string(&mut text) {
                warnings.push(format!("could not read {entry_path}: {e}"));
            } else {
                download_list.extend(
                    text.lines()
                        .map(str::trim)
                        .filter(|v| !v.is_empty())
                        .map(ToOwned::to_owned),
                );
            }
        }
        entries_out.push(FirmwareEntry {
            path: entry_path.clone(),
            size: entry.header().size().unwrap_or(0),
            kind: entry_kind(&entry_path),
            candidate_partition: candidate_partition(&entry_path),
        });
    }

    Ok(FirmwareArchiveReport {
        path: path.display().to_string(),
        role: role_from_name(path),
        file_size,
        md5_verified,
        embedded_md5,
        calculated_md5,
        contains_pit,
        contains_userdata,
        contains_metadata,
        download_list,
        entries: entries_out,
        warnings,
    })
}

pub fn inspect_many<I, P>(paths: I) -> Result<Vec<FirmwareArchiveReport>, FirmwareError>
where
    I: IntoIterator<Item = P>,
    P: AsRef<Path>,
{
    paths.into_iter().map(inspect_archive).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_tar_md5(path: &Path) {
        let tar_path = std::path::PathBuf::from(format!("{}.tar", path.display()));
        {
            let file = File::create(&tar_path).unwrap();
            let mut builder = tar::Builder::new(file);
            let mut header = tar::Header::new_gnu();
            let bytes = b"boot payload";
            header.set_size(bytes.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            builder
                .append_data(&mut header, "boot.img", &bytes[..])
                .unwrap();
            builder.finish().unwrap();
        }
        let mut bytes = std::fs::read(&tar_path).unwrap();
        let digest = format!("{:x}", Md5::digest(&bytes));
        bytes.push(b'\n');
        bytes.extend_from_slice(digest.as_bytes());
        bytes.push(b'\n');
        std::fs::write(path, bytes).unwrap();
        let _ = std::fs::remove_file(tar_path);
    }

    #[test]
    fn inspects_and_verifies_tar_md5() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("AP_TEST.tar.md5");
        make_tar_md5(&path);
        let report = inspect_archive(&path).unwrap();
        assert_eq!(report.role, "AP");
        assert_eq!(report.md5_verified, Some(true));
        assert_eq!(
            report.entries[0].candidate_partition.as_deref(),
            Some("BOOT")
        );
    }
}
