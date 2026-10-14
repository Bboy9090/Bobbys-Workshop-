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
    // A caller cannot skip evidence or claim an outdated prior state.
    // The initial record is a PREFLIGHT -> WRITE_IN_PROGRESS or blocked transition.
    if path.exists() {
        let persisted = read_last_record(path)?;
        if persisted != prior { return Err("journal prior state mismatch".into()); }
    } else if prior != RecoveryState::Preflight {
        return Err("missing initial preflight evidence".into());
    }
    let mut file = OpenOptions::new().create(true).append(true).open(path)
        .map_err(|e| format!("evidence journal unavailable: {e}"))?;
    writeln!(file, "{}", next.as_str()).map_err(|e| format!("evidence write failed: {e}"))?;
    file.sync_all().map_err(|e| format!("evidence flush failed: {e}"))
}

fn read_last_record(path: &Path) -> Result<RecoveryState, String> {
    let file = File::open(path).map_err(|e| format!("evidence unavailable: {e}"))?;
    let mut last = None;
    for line in BufReader::new(file).lines() {
        let line = line.map_err(|e| format!("evidence unreadable: {e}"))?;
        let state = RecoveryState::parse(&line).ok_or("invalid evidence record")?;
        last = Some(state);
    }
    last.ok_or_else(|| "empty evidence journal".into())
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
    fn stale_caller_cannot_advance_recorded_transaction() {
        let p = path();
        append_transition(&p, RecoveryState::Preflight, RecoveryState::WriteInProgress).unwrap();
        assert!(append_transition(&p, RecoveryState::Preflight, RecoveryState::BlockedRequiresReview).is_err());
        assert_eq!(load_restart_state(&p), RecoveryState::WriteInterruptedUnknownState);
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn corrupt_journal_cannot_be_extended_as_if_valid() {
        let p = path();
        std::fs::write(&p, b"CORRUPTED\n").unwrap();
        assert!(append_transition(&p, RecoveryState::Preflight, RecoveryState::WriteInProgress).is_err());
        let _ = std::fs::remove_file(p);
    }

    #[test]
    fn interruption_state_is_terminal_for_auto_write() {
        for state in [
            RecoveryState::Preflight, RecoveryState::WriteInProgress,
            RecoveryState::WriteInterruptedUnknownState, RecoveryState::AwaitingReenumeration,
            RecoveryState::PostWriteVerified, RecoveryState::BlockedRequiresReview,
        ] { assert!(!state.can_auto_resume_write()); }
    }
    #[test]
    fn incomplete_preflight_is_unknown_after_restart() {
        assert_eq!(RecoveryState::Preflight.restart_state(), RecoveryState::WriteInterruptedUnknownState);
    }
    #[test]
    fn interrupted_reenumeration_is_unknown_after_restart() {
        assert_eq!(RecoveryState::AwaitingReenumeration.restart_state(), RecoveryState::WriteInterruptedUnknownState);
    }
    #[test]
    fn denied_grant_can_block_from_preflight() {
        let p = path();
        append_transition(&p, RecoveryState::Preflight, RecoveryState::BlockedRequiresReview).unwrap();
        assert_eq!(load_restart_state(&p), RecoveryState::BlockedRequiresReview);
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn cannot_skip_write_to_success() {
        let p = path();
        assert!(append_transition(&p, RecoveryState::Preflight, RecoveryState::PostWriteVerified).is_err());
        assert!(!p.exists());
    }
    #[test]
    fn cannot_verify_target_during_write() {
        let p = path();
        append_transition(&p, RecoveryState::Preflight, RecoveryState::WriteInProgress).unwrap();
        assert!(append_transition(&p, RecoveryState::WriteInProgress, RecoveryState::PostWriteVerified).is_err());
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn cannot_return_from_ambiguous_write_to_writing() {
        let p = path();
        append_transition(&p, RecoveryState::Preflight, RecoveryState::WriteInProgress).unwrap();
        append_transition(&p, RecoveryState::WriteInProgress, RecoveryState::WriteInterruptedUnknownState).unwrap();
        assert!(append_transition(&p, RecoveryState::WriteInterruptedUnknownState, RecoveryState::WriteInProgress).is_err());
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn cannot_extend_verified_transaction_to_second_write() {
        let p = path();
        append_transition(&p, RecoveryState::Preflight, RecoveryState::WriteInProgress).unwrap();
        append_transition(&p, RecoveryState::WriteInProgress, RecoveryState::AwaitingReenumeration).unwrap();
        append_transition(&p, RecoveryState::AwaitingReenumeration, RecoveryState::PostWriteVerified).unwrap();
        assert!(append_transition(&p, RecoveryState::PostWriteVerified, RecoveryState::WriteInProgress).is_err());
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn truncated_last_record_rejects_append() {
        let p = path();
        std::fs::write(&p, b"WRITE_IN_PROGRESS\\nAWAITING_REEN").unwrap();
        assert!(append_transition(&p, RecoveryState::WriteInProgress, RecoveryState::AwaitingReenumeration).is_err());
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn empty_existing_journal_rejects_append() {
        let p = path();
        std::fs::write(&p, b"").unwrap();
        assert!(append_transition(&p, RecoveryState::Preflight, RecoveryState::WriteInProgress).is_err());
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn terminal_block_survives_restart() {
        assert_eq!(RecoveryState::BlockedRequiresReview.restart_state(), RecoveryState::BlockedRequiresReview);
    }
    #[test]
    fn preflight_cannot_be_entered_from_write() {
        let p = path();
        append_transition(&p, RecoveryState::Preflight, RecoveryState::WriteInProgress).unwrap();
        assert!(append_transition(&p, RecoveryState::WriteInProgress, RecoveryState::Preflight).is_err());
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn verification_requires_recorded_reenumeration() {
        let p = path();
        append_transition(&p, RecoveryState::Preflight, RecoveryState::WriteInProgress).unwrap();
        assert!(append_transition(&p, RecoveryState::AwaitingReenumeration, RecoveryState::PostWriteVerified).is_err());
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn unknown_record_token_fails_closed() {
        let p = path();
        std::fs::write(&p, b"POST_WRITE_VERIFIED\\nUNRECOGNIZED\\n").unwrap();
        assert_eq!(load_restart_state(&p), RecoveryState::WriteInterruptedUnknownState);
        let _ = std::fs::remove_file(p);
    }
    #[test]
    fn evidence_sink_failure_blocks_transition() {
        let p = path().join("missing-directory").join("journal");
        assert!(append_transition(&p, RecoveryState::Preflight, RecoveryState::WriteInProgress).is_err());
    }
}
