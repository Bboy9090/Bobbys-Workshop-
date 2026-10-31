mod support;

use bbw_license_core::{reconcile, FeatureRegistry, LicenseError, ServerInventory, VerifiedLicense};

fn license(features: &[&str]) -> VerifiedLicense {
    VerifiedLicense {
        license_id: "lic_example".into(),
        edition: "pro".into(),
        features: features.iter().map(|s| s.to_string()).collect(),
        expires_at: support::EXPIRES,
        key_id: "ed25519-2026-01".into(),
    }
}

fn registry() -> FeatureRegistry {
    FeatureRegistry::new(["diagnostics", "reports", "exports"])
}

#[test]
fn entitled_features_implemented_and_provisioned_are_granted() {
    let mut inventory = ServerInventory::new();
    inventory.provision("lic_example", ["diagnostics", "reports"]);
    let effective = reconcile(&license(&["diagnostics", "reports"]), &registry(), &inventory).unwrap();
    assert!(effective.features.contains("diagnostics"));
    assert!(effective.features.contains("reports"));
    assert!(effective.not_granted.is_empty());
}

#[test]
fn feature_unknown_to_this_build_fails_closed() {
    let mut inventory = ServerInventory::new();
    inventory.provision("lic_example", ["diagnostics", "telemetry"]);
    assert_eq!(
        reconcile(&license(&["diagnostics", "telemetry"]), &registry(), &inventory),
        Err(LicenseError::UnknownFeature("telemetry".into()))
    );
}

#[test]
fn feature_not_provisioned_on_server_fails_closed() {
    let mut inventory = ServerInventory::new();
    inventory.provision("lic_example", ["diagnostics"]);
    assert_eq!(
        reconcile(&license(&["diagnostics", "reports"]), &registry(), &inventory),
        Err(LicenseError::NotProvisioned("reports".into()))
    );
}

#[test]
fn license_without_inventory_record_fails_closed() {
    let inventory = ServerInventory::new();
    assert_eq!(
        reconcile(&license(&["diagnostics"]), &registry(), &inventory),
        Err(LicenseError::MissingInventory("lic_example".into()))
    );
}

#[test]
fn provisioned_but_ungranted_features_are_reported_not_enabled() {
    let mut inventory = ServerInventory::new();
    inventory.provision("lic_example", ["diagnostics", "exports"]);
    let effective = reconcile(&license(&["diagnostics"]), &registry(), &inventory).unwrap();
    assert!(effective.features.contains("diagnostics"));
    assert!(!effective.features.contains("exports"));
    assert!(effective.not_granted.contains("exports"));
}
