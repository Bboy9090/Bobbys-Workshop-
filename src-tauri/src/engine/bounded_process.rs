//! Bounded subprocess execution for future authorized device workflows.
//! No device commands are exposed by this module.
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;

#[derive(Debug, PartialEq, Eq)]
pub enum ProcessOutcome {
    Completed { success: bool, exit_code: Option<i32> },
    TimedOut,
    SpawnFailed,
}

#[cfg(unix)]
struct GroupKillGuard { pgid: i32, armed: bool }

#[cfg(unix)]
impl Drop for GroupKillGuard {
    fn drop(&mut self) {
        if self.armed {
            // Best-effort cancellation: kill the isolated process group before child handle drops.
            if self.pgid > 1 {
                let result = unsafe { libc::kill(-self.pgid, libc::SIGKILL) };
                if result != 0 {
                    let error = std::io::Error::last_os_error();
                    if error.raw_os_error() != Some(libc::ESRCH) {
                        eprintln!("Process group cleanup failed (pgid={}): {}", self.pgid, error);
                    }
                }
            }
        }
    }
}

pub async fn run_bounded(program: &str, args: &[&str], deadline: Duration) -> ProcessOutcome {
    let mut command = Command::new(program);
    command.args(args).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    command.kill_on_drop(true);
    #[cfg(unix)]
    unsafe {
        command.pre_exec(|| {
            if libc::setsid() == -1 { return Err(std::io::Error::last_os_error()); }
            Ok(())
        });
    }
    let child = match command.spawn() {
        Ok(child) => child,
        Err(_) => return ProcessOutcome::SpawnFailed,
    };
    #[cfg(unix)]
    let mut guard = GroupKillGuard { pgid: child.id().unwrap_or(0) as i32, armed: true };
    #[cfg(unix)]
    if guard.pgid <= 0 { return ProcessOutcome::SpawnFailed; }
    let result = tokio::time::timeout(deadline, child.wait_with_output()).await;
    match result {
        Ok(Ok(output)) => {
            #[cfg(unix)]
            { guard.armed = false; }
            ProcessOutcome::Completed { success: output.status.success(), exit_code: output.status.code() }
        }
        Ok(Err(_)) => ProcessOutcome::SpawnFailed,
        Err(_) => ProcessOutcome::TimedOut,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn bounded_success() {
        let result = run_bounded("/bin/sh", &["-c", "exit 0"], Duration::from_secs(2)).await;
        assert_eq!(result, ProcessOutcome::Completed {success: true, exit_code: Some(0)});
    }
    #[tokio::test]
    async fn bounded_failure() {
        let result = run_bounded("/bin/sh", &["-c", "exit 7"], Duration::from_secs(2)).await;
        assert_eq!(result, ProcessOutcome::Completed {success: false, exit_code: Some(7)});
    }
    #[tokio::test]
    async fn stalled_direct_child_returns_within_deadline() {
        let started = std::time::Instant::now();
        let result = run_bounded("/bin/sleep", &["30"], Duration::from_millis(100)).await;
        assert_eq!(result, ProcessOutcome::TimedOut);
        assert!(started.elapsed() < Duration::from_secs(2));
    }
    #[cfg(unix)]
    #[tokio::test]
    async fn timeout_kills_background_descendant() {
        let marker = std::env::temp_dir().join(format!("bob-pgid-{}.pid", uuid::Uuid::new_v4()));
        let marker_path = marker.to_string_lossy().into_owned();
        let script = format!("sleep 30 & echo $! > '{}' ; wait", marker_path);
        let result = run_bounded("/bin/sh", &["-c", &script], Duration::from_millis(400)).await;
        assert_eq!(result, ProcessOutcome::TimedOut);
        let pid: i32 = std::fs::read_to_string(&marker).expect("descendant PID captured").trim().parse().unwrap();
        let _ = std::fs::remove_file(&marker);
        // ESRCH means the descendant no longer exists; EPERM means it is still present.
        let mut gone = false;
        for _ in 0..30 {
            if unsafe { libc::kill(pid, 0) } == -1 && std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH) {
                gone = true;
                break;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        assert!(gone, "background descendant PID {pid} still exists after group cancellation");
    }
    #[tokio::test]
    async fn bounded_timeout() {
        let result = run_bounded("/bin/sh", &["-c", "sleep 5"], Duration::from_millis(50)).await;
        assert_eq!(result, ProcessOutcome::TimedOut);
    }
}
