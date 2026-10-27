//! Read-only device observation reconciliation. Production callers must supply actual probe evidence.
//! This module never infers authorization or bootloader readiness from a USB VID/PID.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AdbState { Authorized, Unauthorized, Offline }

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceObservation {
    pub physical_uid: String,
    pub usb_present: bool,
    pub adb: Option<AdbState>,
    pub mtp_verified: bool,
    pub fastboot_verified: bool,
    /// Monotonic generation allocated when a scan starts, not wall-clock time.
    pub generation: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PrimaryState { Detached, UsbOnly, Mtp, AdbAuthorized, AdbUnauthorized, AdbOffline, Fastboot }

impl DeviceObservation {
    pub fn primary_state(&self) -> PrimaryState {
        if !self.usb_present { return PrimaryState::Detached; }
        if self.fastboot_verified { return PrimaryState::Fastboot; }
        match self.adb {
            Some(AdbState::Authorized) => PrimaryState::AdbAuthorized,
            Some(AdbState::Unauthorized) => PrimaryState::AdbUnauthorized,
            Some(AdbState::Offline) => PrimaryState::AdbOffline,
            None if self.mtp_verified => PrimaryState::Mtp,
            None => PrimaryState::UsbOnly,
        }
    }
}

/// Reject delayed scan results. A detach observation invalidates older in-flight probes.
pub fn reconcile(current: Option<DeviceObservation>, incoming: DeviceObservation) -> DeviceObservation {
    match current {
        Some(previous) if previous.physical_uid == incoming.physical_uid && previous.generation >= incoming.generation => previous,
        _ => incoming,
    }
}

/// A physical-UID keyed registry. Tokens never reset on reconnect, so an old
/// probe cannot commit into a new attachment epoch of the same USB location.
#[derive(Default)]
pub struct ObservationRegistry {
    entries: std::collections::HashMap<String, DeviceObservation>,
}
impl ObservationRegistry {
    pub fn observe_usb(&mut self, uid: &str, present: bool) -> DeviceObservation {
        let generation = self.entries.get(uid).map_or(1, |old| old.generation.saturating_add(1));
        let observation = DeviceObservation {
            physical_uid: uid.to_owned(), usb_present: present, adb: None,
            mtp_verified: false, fastboot_verified: false, generation,
        };
        self.entries.insert(uid.to_owned(), observation.clone());
        observation
    }
    pub fn commit_probe(&mut self, incoming: DeviceObservation) -> bool {
        match self.entries.get_mut(&incoming.physical_uid) {
            Some(current) if current.usb_present && incoming.usb_present && current.generation == incoming.generation => {
                *current = incoming;
                true
            }
            _ => false,
        }
    }
    pub fn state(&self, uid: &str) -> Option<PrimaryState> {
        self.entries.get(uid).map(DeviceObservation::primary_state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn observation(generation: u64) -> DeviceObservation {
        DeviceObservation { physical_uid: "usb-location-1".into(), usb_present: true, adb: None, mtp_verified: false, fastboot_verified: false, generation }
    }
    #[test] fn usb_does_not_grant_authorization() { assert_eq!(observation(1).primary_state(), PrimaryState::UsbOnly); }
    #[test] fn unauthorized_blocks_authorized_state() { let mut x=observation(1); x.adb=Some(AdbState::Unauthorized); assert_eq!(x.primary_state(), PrimaryState::AdbUnauthorized); }
    #[test] fn mtp_can_coexist_with_adb() { let mut x=observation(1); x.mtp_verified=true; x.adb=Some(AdbState::Authorized); assert_eq!(x.primary_state(), PrimaryState::AdbAuthorized); assert!(x.mtp_verified); }
    #[test] fn fastboot_requires_verified_probe() { let mut x=observation(1); x.fastboot_verified=true; assert_eq!(x.primary_state(), PrimaryState::Fastboot); }
    #[test] fn late_probe_cannot_resurrect_detached_device() { let old=observation(1); let mut detached=observation(2); detached.usb_present=false; let state=reconcile(Some(detached.clone()),old); assert_eq!(state.primary_state(),PrimaryState::Detached); }
    #[test] fn newer_observation_replaces_older() { let mut newer=observation(3); newer.adb=Some(AdbState::Offline); assert_eq!(reconcile(Some(observation(2)),newer).primary_state(),PrimaryState::AdbOffline); }
    #[test] fn duplicate_generation_is_ignored() { let previous=observation(4); let mut duplicate=observation(4); duplicate.fastboot_verified=true; assert_eq!(reconcile(Some(previous),duplicate).primary_state(),PrimaryState::UsbOnly); }
}

#[cfg(test)]
mod registry_integration_tests {
    use super::*;
    #[test]
    fn late_probe_cannot_resurrect_after_disconnect_and_reconnect() {
        let mut registry = ObservationRegistry::default();
        let first = registry.observe_usb("port-1", true);
        registry.observe_usb("port-1", false);
        assert!(!registry.commit_probe(first.clone()));
        assert_eq!(registry.state("port-1"), Some(PrimaryState::Detached));
        let second = registry.observe_usb("port-1", true);
        assert!(second.generation > first.generation);
        let mut stale = first;
        stale.adb = Some(AdbState::Authorized);
        assert!(!registry.commit_probe(stale));
        assert_eq!(registry.state("port-1"), Some(PrimaryState::UsbOnly));
        let mut fresh = second;
        fresh.adb = Some(AdbState::Unauthorized);
        assert!(registry.commit_probe(fresh));
        assert_eq!(registry.state("port-1"), Some(PrimaryState::AdbUnauthorized));
    }
    #[test]
    fn detached_probe_is_never_accepted_as_authorization() {
        let mut registry = ObservationRegistry::default();
        let mut candidate = registry.observe_usb("port-2", true);
        candidate.usb_present = false;
        assert!(!registry.commit_probe(candidate));
    }
}
