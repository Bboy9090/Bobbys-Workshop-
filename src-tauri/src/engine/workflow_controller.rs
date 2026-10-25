//! Short-lived backend-owned device sessions. Sessions never establish authorization
//! by themselves: callers must re-check the physical transport before execution.
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DeviceSession {
    pub serial: String,
    pub transport: String,
    created_at: Instant,
}

#[derive(Default)]
pub struct SessionManager {
    sessions: Mutex<HashMap<String, DeviceSession>>,
    pending_intents: Mutex<HashMap<String, (String, Instant)>>,
}

impl SessionManager {
    pub fn allocate_intent(&self, serial: &str) -> Result<String, String> {
        if serial.is_empty() { return Err("Missing target serial".into()); }
        let id = Uuid::new_v4().to_string();
        self.pending_intents.lock().map_err(|_| "Intent lock unavailable")?
            .insert(id.clone(), (serial.to_string(), Instant::now()));
        Ok(id)
    }
    pub fn cancel_intent(&self, id: &str) -> Result<(), String> {
        self.pending_intents.lock().map_err(|_| "Intent lock unavailable")?.remove(id);
        Ok(())
    }
    /// Holds the intent lock through session insertion so cancellation cannot interleave.
    pub fn commit_intent(&self, id: &str, serial: &str) -> Result<String, String> {
        let mut intents = self.pending_intents.lock().map_err(|_| "Intent lock unavailable")?;
        let (expected, created) = intents.remove(id).ok_or("Authorization intent cancelled or unknown")?;
        if expected != serial || created.elapsed() >= Duration::from_secs(10) {
            return Err("Authorization intent target mismatch or expired".into());
        }
        self.register_verified(serial, "adb")
    }
}

impl SessionManager {
    /// Session issuance is conditional on a fresh backend scanner result.
    /// ADB authorization is transport-level proof, not cryptographic device attestation.
    pub fn open_adb_session<T: AuthorizedTargetScanner>(&self, serial: &str, scanner: &T) -> Result<String, String> {
        if serial.is_empty() || !scanner.is_authorized(serial)? {
            return Err("Target absent or ADB authorization not verified".into());
        }
        self.register_verified(serial, "adb")
    }
    pub fn register_verified(&self, serial: &str, transport: &str) -> Result<String, String> {
        if serial.is_empty() || transport.is_empty() {
            return Err("Session requires verified identity and transport".into());
        }
        let token = Uuid::new_v4().to_string();
        let session = DeviceSession {serial: serial.into(), transport: transport.into(), created_at: Instant::now()};
        self.sessions.lock().map_err(|_| "Session lock unavailable")?.insert(token.clone(), session);
        Ok(token)
    }
    pub fn resolve(&self, token: &str, max_age: Duration) -> Result<DeviceSession, String> {
        let mut sessions = self.sessions.lock().map_err(|_| "Session lock unavailable")?;
        let session = sessions.get(token).ok_or("Unknown or revoked device session")?.clone();
        if session.created_at.elapsed() >= max_age {
            sessions.remove(token);
            return Err("Device session expired".into());
        }
        Ok(session)
    }
    /// Rechecks the token and immutable target after any asynchronous boundary.
    pub fn resolve_adb_target(&self, token: &str, serial: &str, max_age: Duration) -> Result<DeviceSession, String> {
        let session = self.resolve(token, max_age)?;
        if session.serial != serial || session.transport != "adb" {
            return Err("AUTHORIZATION_REJECTION: Session target or transport mismatch".into());
        }
        Ok(session)
    }
    pub fn revoke(&self, token: &str) -> Result<(), String> {
        self.sessions.lock().map_err(|_| "Session lock unavailable")?.remove(token);
        Ok(())
    }
    pub fn validate_observed(&self, token: &str, max_age: Duration, observed_serial: &str, observed_transport: &str) -> Result<DeviceSession, String> {
        let session = self.resolve(token, max_age)?;
        if session.serial != observed_serial || session.transport != observed_transport {
            return Err("Observed hardware identity or transport changed".into());
        }
        Ok(session)
    }
}

/// Scanners must independently verify the selected target, not a caller-supplied
/// identity claim. This trait supports deterministic offline tests.
pub trait AuthorizedTargetScanner {
    fn is_authorized(&self, serial: &str) -> Result<bool, String>;
}

pub struct LiveAdbScanner;
impl AuthorizedTargetScanner for LiveAdbScanner {
    fn is_authorized(&self, serial: &str) -> Result<bool, String> {
        let output = crate::adb_command::new_adb_command()
            .args(["devices", "-l"])
            .output().map_err(|e| format!("ADB transport unavailable: {e}"))?;
        if !output.status.success() { return Err("ADB device inventory failed".into()); }
        let found = String::from_utf8_lossy(&output.stdout).lines().skip(1).any(|line| {
            let mut parts = line.split_whitespace();
            parts.next() == Some(serial) && parts.next() == Some("device")
        });
        Ok(found)
    }
}

impl SessionManager {
    pub fn verify_live_adb<T: AuthorizedTargetScanner>(&self, token: &str, max_age: Duration, scanner: &T) -> Result<DeviceSession, String> {
        let session = self.resolve(token, max_age)?;
        if session.transport != "adb" || !scanner.is_authorized(&session.serial)? {
            self.revoke(token)?;
            return Err("Device authorization or transport changed; session revoked".into());
        }
        Ok(session)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct FakeScanner(bool);
    impl AuthorizedTargetScanner for FakeScanner {
        fn is_authorized(&self, _serial: &str) -> Result<bool, String> { Ok(self.0) }
    }
    #[test]
    fn issuance_requires_live_authorized_transport() {
        let manager = SessionManager::default();
        assert!(manager.open_adb_session("device-a", &FakeScanner(false)).is_err());
        assert!(manager.open_adb_session("device-a", &FakeScanner(true)).is_ok());
        assert!(manager.open_adb_session("", &FakeScanner(true)).is_err());
    }
    #[test]
    fn live_recheck_revokes_unauthorized_session() {
        let manager = SessionManager::default();
        let token = manager.register_verified("device-a", "adb").unwrap();
        assert!(manager.verify_live_adb(&token, Duration::from_secs(300), &FakeScanner(false)).is_err());
        assert!(manager.resolve(&token, Duration::from_secs(300)).is_err());
    }
    #[test]
    fn live_recheck_accepts_authorized_target() {
        let manager = SessionManager::default();
        let token = manager.register_verified("device-a", "adb").unwrap();
        assert!(manager.verify_live_adb(&token, Duration::from_secs(300), &FakeScanner(true)).is_ok());
    }
    #[test]
    fn token_is_not_a_substitute_for_observed_hardware() {
        let manager = SessionManager::default();
        let token = manager.register_verified("device-a", "adb").unwrap();
        assert!(manager.validate_observed(&token, Duration::from_secs(300), "device-b", "adb").is_err());
        assert!(manager.validate_observed(&token, Duration::from_secs(300), "device-a", "mtp").is_err());
        assert!(manager.validate_observed(&token, Duration::from_secs(300), "device-a", "adb").is_ok());
    }
    #[test]
    fn revoke_and_expiry_fail_closed() {
        let manager = SessionManager::default();
        let token = manager.register_verified("device-a", "adb").unwrap();
        assert!(manager.resolve(&token, Duration::ZERO).is_err());
        let next = manager.register_verified("device-a", "adb").unwrap();
        manager.revoke(&next).unwrap();
        assert!(manager.resolve(&next, Duration::from_secs(300)).is_err());
    }
    #[test]
    fn cancelled_intent_cannot_mint_session() {
        let manager = SessionManager::default();
        let id = manager.allocate_intent("device-a").unwrap();
        manager.cancel_intent(&id).unwrap();
        assert!(manager.commit_intent(&id, "device-a").is_err());
    }
    #[test]
    fn intent_is_target_bound_and_single_use() {
        let manager = SessionManager::default();
        let id = manager.allocate_intent("device-a").unwrap();
        assert!(manager.commit_intent(&id, "device-b").is_err());
        assert!(manager.commit_intent(&id, "device-a").is_err());
        let next = manager.allocate_intent("device-a").unwrap();
        assert!(manager.commit_intent(&next, "device-a").is_ok());
        assert!(manager.commit_intent(&next, "device-a").is_err());
    }
    #[test]
    fn empty_identity_is_rejected() {
        assert!(SessionManager::default().register_verified("", "adb").is_err());
    }
}

#[cfg(test)]
mod receipt_authorization_tests {
    use super::*;
    const LEASE: Duration = Duration::from_secs(300);
    #[test]
    fn unknown_revoked_and_wrong_target_fail_closed() {
        let manager = SessionManager::default();
        assert!(manager.resolve_adb_target("unknown", "device-a", LEASE).is_err());
        let token = manager.register_verified("device-a", "adb").unwrap();
        assert!(manager.resolve_adb_target(&token, "device-b", LEASE).is_err());
        assert_eq!(manager.resolve_adb_target(&token, "device-a", LEASE).unwrap().serial, "device-a");
        manager.revoke(&token).unwrap();
        assert!(manager.resolve_adb_target(&token, "device-a", LEASE).is_err());
    }
    #[test]
    fn non_adb_transport_and_expired_lease_fail_closed() {
        let manager = SessionManager::default();
        let token = manager.register_verified("device-a", "fastboot").unwrap();
        assert!(manager.resolve_adb_target(&token, "device-a", LEASE).is_err());
        let adb_token = manager.register_verified("device-a", "adb").unwrap();
        assert!(manager.resolve_adb_target(&adb_token, "device-a", Duration::ZERO).is_err());
    }
    #[test]
    fn revocation_during_asynchronous_gap_invalidates_final_check() {
        let manager = SessionManager::default();
        let token = manager.register_verified("device-a", "adb").unwrap();
        manager.resolve_adb_target(&token, "device-a", LEASE).unwrap();
        manager.revoke(&token).unwrap();
        assert!(manager.resolve_adb_target(&token, "device-a", LEASE).is_err());
    }
}
