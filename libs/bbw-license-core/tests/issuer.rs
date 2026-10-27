#![cfg(feature = "issuer")]
mod support;

use bbw_license_core::{issuer, verify_token, ClockContext, LicenseError, DEFAULT_POLICY};
use support::*;

#[test]
fn issued_token_round_trips_through_verifier() {
    let k = key(7);
    let token = issuer::issue(&payload(), &k).unwrap();
    let license = verify_token(&token, &active_store(&k), &DEFAULT_POLICY, ClockContext { now: NOW, high_water: 0 }).unwrap();
    assert_eq!(license.license_id, "lic_example");
}

#[test]
fn issuer_refuses_invalid_payloads() {
    let k = key(7);
    let mut unsorted = payload();
    unsorted.features = vec!["reports".into(), "diagnostics".into()];
    assert!(matches!(issuer::issue(&unsorted, &k), Err(LicenseError::Malformed(_))));

    let mut bad_version = payload();
    bad_version.version = 2;
    assert_eq!(issuer::issue(&bad_version, &k), Err(LicenseError::UnsupportedVersion(2)));
}
