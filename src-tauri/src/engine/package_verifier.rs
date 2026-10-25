//! Read-only, fail-closed parser for Android `dumpsys package PACKAGE` evidence.
//! Package-manager output is not cryptographic APK attestation.
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

const MAX_DUMP_BYTES: u64 = 65_536;

/// Read-only collection. This is a transport observation, not APK attestation.
pub async fn collect_live_dump(serial: &str, package: &str) -> Result<String, String> {
    if serial.is_empty() || serial.starts_with('-') || serial.chars().any(char::is_whitespace) || serial.len() > 128 {
        return Err("Invalid ADB serial".into());
    }
    if package.is_empty() || !package.split('.').all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')) {
        return Err("Invalid package name".into());
    }
    collect_bounded_dump_stream("adb", &["-s", serial, "shell", "dumpsys", "package", package], Duration::from_secs(4)).await
}

/// Executes a bounded, read-only evidence query. `program` is internal-only and used for tests.
async fn collect_bounded_dump_stream(program: &str, args: &[&str], deadline: Duration) -> Result<String, String> {
    let mut command = Command::new(program);
    command.args(args)
        .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null()).kill_on_drop(true);
    #[cfg(unix)]
    unsafe {
        command.pre_exec(|| {
            if libc::setsid() == -1 { return Err(std::io::Error::last_os_error()); }
            Ok(())
        });
    }
    let child = command.spawn().map_err(|e| format!("Collector spawn failed: {e}"))?;
    #[cfg(unix)]
    let guard = CollectorGroupGuard(child.id().unwrap_or(0) as i32);
    let collection = async {
        let mut child = child;
        let mut stdout = child.stdout.take().ok_or("Collector stdout missing")?;
        let mut bytes = Vec::new();
        (&mut stdout).take(MAX_DUMP_BYTES + 1).read_to_end(&mut bytes).await
            .map_err(|e| format!("Collector read failed: {e}"))?;
        if bytes.len() as u64 > MAX_DUMP_BYTES { return Err("BUFFER_OVERFLOW: Collector output exceeds 64 KiB".into()); }
        let status = child.wait().await.map_err(|e| format!("Collector wait failed: {e}"))?;
        if !status.success() { return Err("EXIT_STATUS_REJECTION: Collector returned unsuccessful exit status".into()); }
        if bytes.is_empty() { return Err("Collector returned empty evidence".into()); }
        String::from_utf8(bytes).map_err(|_| "Collector returned invalid UTF-8".into())
    };
    let result = tokio::time::timeout(deadline, collection).await
        .map_err(|_| "COLLECTOR_TIMEOUT: Deadline exceeded".to_string())?;
    #[cfg(unix)]
    drop(guard); // Cleanup remaining process-group descendants even on success.
    result
}

#[cfg(unix)]
struct CollectorGroupGuard(i32);
#[cfg(unix)]
impl Drop for CollectorGroupGuard {
    fn drop(&mut self) {
        if self.0 > 1 {
            let rc = unsafe { libc::kill(-self.0, libc::SIGKILL) };
            if rc != 0 {
                let error = std::io::Error::last_os_error();
                if error.raw_os_error() != Some(libc::ESRCH) {
                    eprintln!("Collector group cleanup failed: {error}");
                }
            }
        }
    }
}


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
    #[cfg(unix)]
    #[tokio::test]
    async fn collector_rejects_oversized_stream() {
        let result = collect_bounded_dump_stream("/bin/sh", &["-c", "yes v | head -c 131072"], Duration::from_secs(3)).await;
        assert!(result.unwrap_err().contains("BUFFER_OVERFLOW"));
    }
    #[cfg(unix)]
    #[tokio::test]
    async fn collector_rejects_nonzero_exit() {
        let result = collect_bounded_dump_stream("/bin/sh", &["-c", "printf 'Package [com.example]'; exit 1"], Duration::from_secs(3)).await;
        assert!(result.unwrap_err().contains("EXIT_STATUS_REJECTION"));
    }
    #[cfg(unix)]
    #[tokio::test]
    async fn collector_times_out_and_cleans_up() {
        let started = std::time::Instant::now();
        let result = collect_bounded_dump_stream("/bin/sh", &["-c", "sleep 10"], Duration::from_millis(120)).await;
        assert!(result.unwrap_err().contains("COLLECTOR_TIMEOUT"));
        assert!(started.elapsed() < Duration::from_secs(2));
    }
    #[cfg(unix)]
    #[tokio::test]
    async fn collector_reads_multiple_chunks_through_eof() {
        let result = collect_bounded_dump_stream("/bin/sh", &["-c", "printf abc; sleep 0.02; printf def"], Duration::from_secs(3)).await.unwrap();
        assert_eq!(result, "abcdef");
    }

}
