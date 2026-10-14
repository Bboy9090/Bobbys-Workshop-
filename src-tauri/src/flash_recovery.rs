//! Fail-closed, hardware-free recovery evidence primitives.
//! Not wired to production flashing. Qualification and integration are separate gates.
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecoveryState {
    Preflight,
    WriteInProgress,
    WriteInterruptedUnknownState,
    AwaitingReenumeration,
    PostWriteVerified,
    BlockedRequiresReview,
}
impl RecoveryState {
    fn as_str(self) -> &'static str {
        match self {
            Self::Preflight => "PREFLIGHT",
            Self::WriteInProgress => "WRITE_IN_PROGRESS",
            Self::WriteInterruptedUnknownState => "WRITE_INTERRUPTED_UNKNOWN_STATE",
            Self::AwaitingReenumeration => "AWAITING_REENUMERATION",
            Self::PostWriteVerified => "POST_WRITE_VERIFIED",
            Self::BlockedRequiresReview => "BLOCKED_REQUIRES_REVIEW",
        }
    }
    fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "PREFLIGHT" => Self::Preflight,
            "WRITE_IN_PROGRESS" => Self::WriteInProgress,
            "WRITE_INTERRUPTED_UNKNOWN_STATE" => Self::WriteInterruptedUnknownState,
            "AWAITING_REENUMERATION" => Self::AwaitingReenumeration,
            "POST_WRITE_VERIFIED" => Self::PostWriteVerified,
            "BLOCKED_REQUIRES_REVIEW" => Self::BlockedRequiresReview,
            _ => return None,
        })
    }
    pub fn can_auto_resume_write(self) -> bool { false }
    pub fn restart_state(self) -> Self {
        match self {
            Self::PostWriteVerified | Self::BlockedRequiresReview |
            Self::WriteInterruptedUnknownState => self,
            _ => Self::WriteInterruptedUnknownState,
        }
    }
}
fn allowed(from: RecoveryState, to: RecoveryState) -> bool {
    use RecoveryState::*;
    matches!((from, to),
        (Preflight, WriteInProgress) |
        (Preflight, BlockedRequiresReview) |
        (WriteInProgress, AwaitingReenumeration) |
        (WriteInProgress, WriteInterruptedUnknownState) |
        (WriteInProgress, BlockedRequiresReview) |
        (AwaitingReenumeration, PostWriteVerified) |
        (AwaitingReenumeration, BlockedRequiresReview) |
        (AwaitingReenumeration, WriteInterruptedUnknownState) |
        (WriteInterruptedUnknownState, BlockedRequiresReview))
}

/// Append before advancing the caller's state. Deliberately records states only:
/// never passwords, raw command output, device identifiers, or secrets.
pub fn append_transition(path: &Path, prior: RecoveryState, next: RecoveryState) -> Result<(), String> {
    if !allowed(prior, next) { return Err("disallowed recovery transition".into()); }
    let mut file = OpenOptions::new().create(true).append(true).open(path)
        .map_err(|e| format!("evidence journal unavailable: {e}"))?;
    writeln!(file, "{}", next.as_str()).map_err(|e| format!("evidence write failed: {e}"))?;
    file.sync_all().map_err(|e| format!("evidence flush failed: {e}"))
}

/// Corrupt, truncated, or missing journals fail closed.
/// A terminal success record is only evidence of a *prior recorded state*,
/// not proof of physical partition integrity.
pub fn load_restart_state(path: &Path) -> RecoveryState {
    let file = match File::open(path) {
        Ok(file) => file,
        Err(_) => return RecoveryState::WriteInterruptedUnknownState,
    };
    let mut last = None;
    for line in BufReader::new(file).lines() {
        let line = match line { Ok(v) => v, Err(_) => return RecoveryState::WriteInterruptedUnknownState };
        let state = match RecoveryState::parse(&line) {
            Some(v) => v,
            None => return RecoveryState::WriteInterruptedUnknownState,
        };
        last = Some(state);
    }
    last.unwrap_or(RecoveryState::WriteInterruptedUnknownState).restart_state()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    fn path() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("bobfw-recovery-{}-{}", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)))
    }
    #[test]
    fn interrupted_write_is_never_resumable() {
        let p = path();
        append_transition(&p, RecoveryState::Preflight, RecoveryState::WriteInProgress).unwrap();
        assert_eq!(load_restart_state(&p), RecoveryState::WriteInterruptedUnknownState);
        append_transition(&p, RecoveryState::WriteInProgress, RecoveryState::WriteInterruptedUnknownState).unwrap();
        let state = load_restart_state(&p);
        assert_eq!(state, RecoveryState::WriteInterruptedUnknownState);
        assert!(!state.can_auto_resume_write());
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn clean_post_write_state_survives_restart_but_not_rewrite() {
        let p = path();
        append_transition(&p, RecoveryState::Preflight, RecoveryState::WriteInProgress).unwrap();
        append_transition(&p, RecoveryState::WriteInProgress, RecoveryState::AwaitingReenumeration).unwrap();
        append_transition(&p, RecoveryState::AwaitingReenumeration, RecoveryState::PostWriteVerified).unwrap();
        let state = load_restart_state(&p);
        assert_eq!(state, RecoveryState::PostWriteVerified);
        assert!(!state.can_auto_resume_write());
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn malformed_or_missing_evidence_fails_closed() {
        let p = path();
        assert_eq!(load_restart_state(&p), RecoveryState::WriteInterruptedUnknownState);
        std::fs::write(&p, b"WRITE_IN_PROGRESS\nTRUNCATED").unwrap();
        assert_eq!(load_restart_state(&p), RecoveryState::WriteInterruptedUnknownState);
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn unsafe_transition_is_rejected() {
        let p = path();
        assert!(append_transition(&p, RecoveryState::WriteInterruptedUnknownState, RecoveryState::PostWriteVerified).is_err());
        assert!(!p.exists());
    }
    #[test]
    fn evidence_sink_failure_blocks_transition() {
        let p = path().join("missing-directory").join("journal");
        assert!(append_transition(&p, RecoveryState::Preflight, RecoveryState::WriteInProgress).is_err());
    }
}
