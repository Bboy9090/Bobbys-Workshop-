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

pub async fn run_bounded(program: &str, args: &[&str], deadline: Duration) -> ProcessOutcome {
    let mut command = Command::new(program);
    command.args(args).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    command.kill_on_drop(true);
    let child = match command.spawn() {
        Ok(child) => child,
        Err(_) => return ProcessOutcome::SpawnFailed,
    };
    match tokio::time::timeout(deadline, child.wait_with_output()).await {
        Ok(Ok(output)) => ProcessOutcome::Completed { success: output.status.success(), exit_code: output.status.code() },
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
    #[tokio::test]
    async fn bounded_timeout() {
        let result = run_bounded("/bin/sh", &["-c", "sleep 5"], Duration::from_millis(50)).await;
        assert_eq!(result, ProcessOutcome::TimedOut);
    }
}
