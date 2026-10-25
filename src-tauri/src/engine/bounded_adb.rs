//! Target-specific ADB authorization check with bounded execution and output.
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

pub async fn check_authorized(serial: &str, deadline: Duration) -> Result<bool, String> {
    if serial.is_empty() || serial.starts_with('-') || serial.chars().any(char::is_whitespace) {
        return Err("Invalid target serial".into());
    }
    let mut cmd = Command::new("adb");
    #[cfg(target_os = "macos")]
    cmd.env("ADB_LIBUSB", "1");
    cmd.args(["-s", serial, "get-state"])
        .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null())
        .kill_on_drop(true);
    let mut child = cmd.spawn().map_err(|e| format!("ADB spawn failed: {e}"))?;
    let mut stdout = child.stdout.take().ok_or("ADB stdout unavailable")?;
    let run = async {
        let mut limited = (&mut stdout).take(65);
        let mut bytes = Vec::new();
        limited.read_to_end(&mut bytes).await.map_err(|e| format!("ADB output read failed: {e}"))?;
        if bytes.len() > 64 { return Err("ADB response too large".into()); }
        let status = child.wait().await.map_err(|e| format!("ADB wait failed: {e}"))?;
        Ok(status.success() && bytes == b"device\n" || status.success() && bytes == b"device\r\n")
    };
    tokio::time::timeout(deadline, run).await.map_err(|_| "ADB authorization deadline exceeded".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn rejects_invalid_serial_before_spawn() {
        assert!(check_authorized("", Duration::from_secs(1)).await.is_err());
        assert!(check_authorized("-x", Duration::from_secs(1)).await.is_err());
        assert!(check_authorized("a b", Duration::from_secs(1)).await.is_err());
    }
}
