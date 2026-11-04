//! Strictly bounded parsing of already-captured Android getprop output.
//! This module never executes ADB or accesses hardware.
use std::io::{self, BufRead};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceDiagnostics {
    pub model: Option<String>,
    pub android_release: Option<String>,
    pub secure_boot_raw: Option<String>,
    pub partition_hash_raw: Option<String>,
}

pub fn parse_getprop<R: BufRead>(mut reader: R) -> io::Result<DeviceDiagnostics> {
    const MAX_LINE: usize = 4096;
    const MAX_ROWS: usize = 128;
    let mut result = DeviceDiagnostics { model: None, android_release: None, secure_boot_raw: None, partition_hash_raw: None };
    let mut line = Vec::new();
    for _ in 0..MAX_ROWS {
        line.clear();
        let mut bounded = std::io::Read::take(&mut reader, (MAX_LINE + 1) as u64);
        let count = bounded.read_until(b'\n', &mut line)?;
        if count == 0 { return Ok(result); }
        if count > MAX_LINE || !line.ends_with(b"\n") && line.len() == MAX_LINE { return Err(io::Error::new(io::ErrorKind::InvalidData, "oversized property line")); }
        let raw = std::str::from_utf8(&line).map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "non-UTF8 property"))?;
        let raw = raw.trim_end_matches(['\r', '\n']);
        let Some((key, value)) = raw.split_once("]: [") else { continue };
        let Some(key) = key.strip_prefix('[') else { continue };
        let Some(value) = value.strip_suffix(']') else { continue };
        if value.len() > 256 { return Err(io::Error::new(io::ErrorKind::InvalidData, "oversized property value")); }
        let target = match key {
            "ro.product.model" => &mut result.model,
            "ro.build.version.release" => &mut result.android_release,
            "ro.boot.secureboot" => &mut result.secure_boot_raw,
            "ro.boot.partition_hash" => &mut result.partition_hash_raw,
            _ => continue,
        };
        if target.is_some() { return Err(io::Error::new(io::ErrorKind::InvalidData, "duplicate property")); }
        *target = Some(value.to_owned());
    }
    // Refuse to silently ignore properties beyond the row limit.
    if reader.fill_buf()?.is_empty() { Ok(result) } else { Err(io::Error::new(io::ErrorKind::InvalidData, "too many property lines")) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn parses_exact_properties() {
        let input = b"[ro.product.model]: [SM-T500]\n[ro.build.version.release]: [11]\n[ro.boot.secureboot]: [1]\n";
        let got = parse_getprop(&input[..]).unwrap();
        assert_eq!(got.model.as_deref(), Some("SM-T500"));
        assert_eq!(got.android_release.as_deref(), Some("11"));
        assert_eq!(got.secure_boot_raw.as_deref(), Some("1"));
        assert_eq!(got.partition_hash_raw, None);
    }
    #[test] fn unknown_is_not_assumed_locked() { assert_eq!(parse_getprop(&b""[..]).unwrap().secure_boot_raw, None); }
    #[test] fn oversized_line_rejected() { let input = vec![b'x'; 5000]; assert_eq!(parse_getprop(&input[..]).unwrap_err().kind(), io::ErrorKind::InvalidData); }
    #[test] fn duplicate_key_rejected() { let input = b"[ro.product.model]: [A]\n[ro.product.model]: [B]\n"; assert!(parse_getprop(&input[..]).is_err()); }
    #[test] fn too_many_rows_rejected() { let input = "[unused]: [x]\n".repeat(129); assert!(parse_getprop(input.as_bytes()).is_err()); }
}
