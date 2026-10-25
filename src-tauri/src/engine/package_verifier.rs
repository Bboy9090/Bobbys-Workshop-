//! Read-only, fail-closed parser for Android `dumpsys package PACKAGE` evidence.
//! Package-manager output is not cryptographic APK attestation.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PackageMetadata {
    pub package_name: String,
    pub version_code: u64,
    pub code_path: Option<String>,
    pub is_verified: bool,
}

pub fn parse_package_dump(dump: &str, expected_package: &str, expected_version: u64) -> Result<PackageMetadata, String> {
    if expected_package.is_empty() || !expected_package.split('.').all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')) {
        return Err("Invalid expected package identifier".into());
    }
    if dump.len() > 1024 * 1024 { return Err("Package dump exceeds evidence size limit".into()); }
    let mut in_package = false;
    let mut seen_header = false;
    let mut version: Option<u64> = None;
    let mut code_path: Option<String> = None;
    for line in dump.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Package [") {
            if seen_header { return Err("Ambiguous package headers".into()); }
            let name = trimmed.strip_prefix("Package [").and_then(|s| s.split_once(']')).map(|(n, _)| n).ok_or("Malformed package header")?;
            if name != expected_package { return Err("Package identity mismatch".into()); }
            seen_header = true;
            in_package = true;
            continue;
        }
        if !in_package { continue; }
        for field in trimmed.split_whitespace() {
            if let Some(raw) = field.strip_prefix("versionCode=") {
                let number = raw.parse::<u64>().map_err(|_| "Malformed versionCode")?;
                if version.replace(number).is_some() { return Err("Duplicate versionCode evidence".into()); }
            }
            if let Some(path) = field.strip_prefix("codePath=") {
                if path.is_empty() || !path.starts_with('/') || path.contains("..") || code_path.replace(path.to_string()).is_some() {
                    return Err("Invalid or duplicate codePath evidence".into());
                }
            }
        }
    }
    if !seen_header { return Err("Package header absent".into()); }
    let version_code = version.ok_or("versionCode absent")?;
    Ok(PackageMetadata { package_name: expected_package.into(), version_code, code_path, is_verified: version_code == expected_version })
}

#[cfg(test)]
mod tests {
    use super::*;
    const GOOD: &str = "Package [com.example.app] (abc):\n userId=10000\n codePath=/data/app/com.example.app/base.apk\n versionCode=9005 minSdk=26 targetSdk=34\n";
    #[test] fn parses_exact_package_and_version() {
        let parsed = parse_package_dump(GOOD, "com.example.app", 9005).unwrap();
        assert!(parsed.is_verified);
        assert_eq!(parsed.version_code, 9005);
        assert_eq!(parsed.code_path.as_deref(), Some("/data/app/com.example.app/base.apk"));
    }
    #[test] fn mismatched_version_is_not_verified() {
        assert!(!parse_package_dump(GOOD, "com.example.app", 9006).unwrap().is_verified);
    }
    #[test] fn rejects_wrong_or_missing_identity() {
        assert!(parse_package_dump(GOOD, "com.other.app", 9005).is_err());
        assert!(parse_package_dump("versionCode=9005", "com.example.app", 9005).is_err());
    }
    #[test] fn rejects_invalid_and_duplicate_versions() {
        assert!(parse_package_dump(&GOOD.replace("9005", "INVALID"), "com.example.app", 9005).is_err());
        assert!(parse_package_dump(&(GOOD.to_string() + " versionCode=9005\n"), "com.example.app", 9005).is_err());
        assert!(parse_package_dump(&GOOD.replace("9005", "18446744073709551616"), "com.example.app", 9005).is_err());
    }
    #[test] fn rejects_duplicate_headers_and_malformed_paths() {
        assert!(parse_package_dump(&(GOOD.to_string() + GOOD), "com.example.app", 9005).is_err());
        assert!(parse_package_dump(&GOOD.replace("/data/app/", "../data/app/"), "com.example.app", 9005).is_err());
    }
    #[test] fn accepts_missing_optional_path_without_claiming_integrity() {
        let parsed = parse_package_dump(&GOOD.replace(" codePath=/data/app/com.example.app/base.apk\n", ""), "com.example.app", 9005).unwrap();
        assert_eq!(parsed.code_path, None);
    }
}
