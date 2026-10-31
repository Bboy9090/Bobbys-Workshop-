mod support;

use bbw_license_core::{
    verify_token, ClockContext, LicenseError, LicensePayload, TrustStore, DEFAULT_POLICY,
};
use support::*;

fn clock(now: u64) -> ClockContext {
    ClockContext { now, high_water: 0 }
}

fn verify(token: &str, store: &bbw_license_core::TrustStore) -> Result<bbw_license_core::VerifiedLicense, LicenseError> {
    verify_token(token, store, &DEFAULT_POLICY, clock(NOW))
}

// --- valid tokens -------------------------------------------------------------------------

#[test]
fn valid_token_verifies_and_reports_entitlements() {
    let k = key(7);
    let license = verify(&token_for(&payload(), &k), &active_store(&k)).expect("valid");
    assert_eq!(license.license_id, "lic_example");
    assert_eq!(license.edition, "pro");
    assert_eq!(license.features, vec!["diagnostics", "reports"]);
    assert!(license.has_feature("reports"));
    assert!(!license.has_feature("exports"));
}

// --- malformed input and unsupported versions ---------------------------------------------

#[test]
fn wrong_segment_count_is_malformed() {
    let k = key(7);
    let store = active_store(&k);
    let token = token_for(&payload(), &k);
    let two_segments: String = token.rsplitn(2, '.').last().unwrap().to_string();
    assert!(matches!(verify(&two_segments, &store), Err(LicenseError::Malformed(_))));
    assert!(matches!(verify(&format!("{token}.extra"), &store), Err(LicenseError::Malformed(_))));
}

#[test]
fn wrong_prefix_is_malformed() {
    let k = key(7);
    let token = token_for(&payload(), &k).replacen("bbwlic1", "bbwlic9", 1);
    assert!(matches!(verify(&token, &active_store(&k)), Err(LicenseError::Malformed(_))));
}

#[test]
fn non_base64_and_wrong_length_signatures_are_malformed() {
    let k = key(7);
    let store = active_store(&k);
    let good = token_for(&payload(), &k);
    let (head, _) = good.rsplit_once('.').unwrap();
    assert!(matches!(verify(&format!("{head}.!!!"), &store), Err(LicenseError::Malformed(_))));
    assert!(matches!(verify(&format!("{head}.AAAA"), &store), Err(LicenseError::Malformed(_))));
}

#[test]
fn payload_that_is_not_json_is_malformed() {
    let k = key(7);
    let token = sign_bytes(b"not json at all", &k);
    assert!(matches!(verify(&token, &active_store(&k)), Err(LicenseError::Malformed(_))));
}

#[test]
fn unsupported_version_is_reported_as_such() {
    let k = key(7);
    let mut p = payload();
    p.version = 2;
    // Signed correctly, but the version is not one this client understands.
    let token = sign_bytes(&serde_json::to_vec(&serde_json::json!({
        "version": 2, "license_id": "lic_example", "product_id": "bobbys-workshop",
        "edition": "pro", "features": ["reports"], "issued_at": ISSUED,
        "expires_at": EXPIRES, "key_id": "ed25519-2026-01"
    })).unwrap(), &k);
    assert_eq!(verify(&token, &active_store(&k)), Err(LicenseError::UnsupportedVersion(2)));
}

#[test]
fn unknown_payload_field_is_rejected() {
    let k = key(7);
    let token = sign_bytes(&serde_json::to_vec(&serde_json::json!({
        "version": 1, "license_id": "lic_example", "product_id": "bobbys-workshop",
        "edition": "pro", "features": ["reports"], "issued_at": ISSUED,
        "expires_at": EXPIRES, "key_id": "ed25519-2026-01", "seats": 99
    })).unwrap(), &k);
    assert!(matches!(verify(&token, &active_store(&k)), Err(LicenseError::Malformed(_))));
}

#[test]
fn non_canonical_but_validly_signed_payload_is_rejected() {
    let k = key(7);
    // Same claims, different bytes (spaces added). The signature is genuine, but the
    // verifier signs and checks exact bytes, so there must be exactly one encoding.
    let spaced = serde_json::to_string(&payload()).unwrap().replace(',', ", ");
    let token = sign_bytes(spaced.as_bytes(), &k);
    assert_eq!(verify(&token, &active_store(&k)), Err(LicenseError::NonCanonicalPayload));
}

#[test]
fn duplicate_json_keys_are_rejected() {
    let k = key(7);
    let token = sign_bytes(
        br#"{"version":1,"version":1,"license_id":"lic_example","product_id":"bobbys-workshop","edition":"pro","features":["reports"],"issued_at":1793062800,"expires_at":1824598800,"key_id":"ed25519-2026-01"}"#,
        &k,
    );
    // Serde refuses duplicate fields while parsing, so the payload fails as malformed before
    // the canonical-bytes check. Either way the token is rejected.
    assert!(matches!(verify(&token, &active_store(&k)), Err(LicenseError::Malformed(_))));
}

#[test]
fn unsorted_or_duplicate_features_are_malformed() {
    let k = key(7);
    for features in [vec!["reports", "diagnostics"], vec!["reports", "reports"]] {
        let mut p = payload();
        p.features = features.into_iter().map(String::from).collect();
        assert!(matches!(
            verify(&token_for(&p, &k), &active_store(&k)),
            Err(LicenseError::Malformed(_))
        ));
    }
}

#[test]
fn issued_after_expiry_is_malformed() {
    let k = key(7);
    let mut p = payload();
    p.expires_at = p.issued_at;
    assert!(matches!(verify(&token_for(&p, &k), &active_store(&k)), Err(LicenseError::Malformed(_))));
}

// --- signatures and trust ------------------------------------------------------------------

#[test]
fn tampered_payload_fails_signature_check() {
    let k = key(7);
    let good = token_for(&payload(), &k);
    let (_, signature) = good.rsplit_once('.').unwrap();
    let mut forged = payload();
    forged.edition = "enterprise".into();
    let tampered = format!(
        "bbwlic1.{}.{}",
        base64url(&canonical(&forged)),
        signature
    );
    assert_eq!(verify(&tampered, &active_store(&k)), Err(LicenseError::BadSignature));
}

#[test]
fn signature_from_another_key_is_rejected() {
    let trusted = key(7);
    let attacker = key(8);
    let token = token_for(&payload(), &attacker);
    // The payload names the trusted key ID, but the signature was made by a different key.
    assert_eq!(verify(&token, &active_store(&trusted)), Err(LicenseError::BadSignature));
}

#[test]
fn unknown_key_id_is_rejected() {
    let k = key(7);
    let mut p = payload();
    p.key_id = "ed25519-2099-01".into();
    let store = active_store(&k);
    assert_eq!(verify(&token_for(&p, &k), &store), Err(LicenseError::UnknownKey("ed25519-2099-01".into())));
}

#[test]
fn revoked_key_rejects_tokens_it_signed() {
    let k = key(7);
    let store = store(2, &[("ed25519-2026-01", &k, "revoked")]);
    assert_eq!(
        verify(&token_for(&payload(), &k), &store),
        Err(LicenseError::RevokedKey("ed25519-2026-01".into()))
    );
}

#[test]
fn trust_store_rejects_duplicate_ids_bad_keys_and_unknown_fields() {
    let k = key(7);
    let entry = format!(r#"{{"key_id":"a","public_key":"{}","status":"active"}}"#, public_b64(&k));
    let dup = format!(r#"{{"trust_store_version":1,"keys":[{entry},{entry}]}}"#);
    assert!(matches!(TrustStore::from_json(&dup), Err(LicenseError::Malformed(_))));

    let short = r#"{"trust_store_version":1,"keys":[{"key_id":"a","public_key":"AAAA","status":"active"}]}"#;
    assert!(matches!(TrustStore::from_json(short), Err(LicenseError::Malformed(_))));

    let extra = format!(r#"{{"trust_store_version":1,"keys":[{entry}],"note":"x"}}"#);
    assert!(matches!(TrustStore::from_json(&extra), Err(LicenseError::Malformed(_))));

    assert!(matches!(
        TrustStore::from_json(r#"{"trust_store_version":1,"keys":[]}"#),
        Err(LicenseError::Malformed(_))
    ));
}

// --- product, edition, features, time ------------------------------------------------------

#[test]
fn product_mismatch_is_rejected() {
    let k = key(7);
    let mut p = payload();
    p.product_id = "some-other-product".into();
    assert_eq!(verify(&token_for(&p, &k), &active_store(&k)), Err(LicenseError::ProductMismatch));
}

#[test]
fn edition_outside_policy_is_rejected() {
    let k = key(7);
    let mut p = payload();
    p.edition = "enterprise".into();
    assert_eq!(
        verify(&token_for(&p, &k), &active_store(&k)),
        Err(LicenseError::EditionNotAllowed("enterprise".into()))
    );
}

#[test]
fn license_cannot_grant_device_altering_features() {
    let k = key(7);
    let mut p = payload();
    p.features = vec!["diagnostics".into(), "flash".into()];
    assert_eq!(
        verify(&token_for(&p, &k), &active_store(&k)),
        Err(LicenseError::ForbiddenFeature("flash".into()))
    );
}

#[test]
fn expiry_boundary_is_exclusive() {
    let k = key(7);
    let store = active_store(&k);
    let token = token_for(&payload(), &k);
    assert!(verify_token(&token, &store, &DEFAULT_POLICY, clock(EXPIRES - 1)).is_ok());
    assert_eq!(verify_token(&token, &store, &DEFAULT_POLICY, clock(EXPIRES)), Err(LicenseError::Expired));
}

#[test]
fn issuance_in_the_future_is_not_yet_valid_beyond_skew() {
    let k = key(7);
    let store = active_store(&k);
    let mut p = payload();
    p.issued_at = NOW + 300;
    p.expires_at = NOW + 10_000_000;
    let token = token_for(&p, &k);
    assert!(verify_token(&token, &store, &DEFAULT_POLICY, clock(NOW)).is_ok());
    p.issued_at = NOW + 301;
    let token = token_for(&p, &k);
    assert_eq!(verify_token(&token, &store, &DEFAULT_POLICY, clock(NOW)), Err(LicenseError::NotYetValid));
}

#[test]
fn clock_rollback_beyond_tolerance_fails_closed() {
    let k = key(7);
    let store = active_store(&k);
    let token = token_for(&payload(), &k);
    let high_water = NOW + 1_000;
    assert_eq!(
        verify_token(&token, &store, &DEFAULT_POLICY, ClockContext { now: NOW, high_water }),
        Err(LicenseError::ClockRollback { observed: NOW, high_water })
    );
}

#[test]
fn small_clock_correction_within_tolerance_is_accepted() {
    let k = key(7);
    let store = active_store(&k);
    let token = token_for(&payload(), &k);
    let ctx = ClockContext { now: NOW, high_water: NOW + 300 };
    assert!(verify_token(&token, &store, &DEFAULT_POLICY, ctx).is_ok());
}

#[test]
fn feature_requirements_are_enforced_by_caller_check() {
    let k = key(7);
    let license = verify(&token_for(&payload(), &k), &active_store(&k)).unwrap();
    assert!(license.has_feature("diagnostics"));
    assert!(!license.has_feature("exports"));
}

// --- key rotation and trust-store rollback -------------------------------------------------

#[test]
fn key_rotation_keeps_retired_tokens_valid_and_new_tokens_valid() {
    let old = key(7);
    let new = key(9);
    let v2 = store(2, &[("ed25519-2026-01", &old, "retired"), ("ed25519-2026-07", &new, "active")]);

    let mut p_old = payload();
    p_old.key_id = "ed25519-2026-01".into();
    assert!(verify(&token_for(&p_old, &old), &v2).is_ok());

    let mut p_new = payload();
    p_new.key_id = "ed25519-2026-07".into();
    assert!(verify(&token_for(&p_new, &new), &v2).is_ok());
}

#[test]
fn revoking_a_rotated_key_invalidates_its_tokens() {
    let old = key(7);
    let new = key(9);
    let v3 = store(3, &[("ed25519-2026-01", &old, "revoked"), ("ed25519-2026-07", &new, "active")]);
    assert_eq!(
        verify(&token_for(&payload(), &old), &v3),
        Err(LicenseError::RevokedKey("ed25519-2026-01".into()))
    );
}

#[test]
fn older_trust_store_cannot_reinstate_a_revoked_key() {
    let old = key(7);
    let v2_revoked = store(2, &[("ed25519-2026-01", &old, "revoked")]);
    let v1_active = store(1, &[("ed25519-2026-01", &old, "active")]);

    // The client has already accepted v2, so presenting v1 must be refused.
    assert_eq!(
        v1_active.require_not_rolled_back(v2_revoked.version()),
        Err(LicenseError::TrustStoreRollback { presented: 1, last_seen: 2 })
    );
    // Accepting v2 itself is fine, and the revoked key still rejects tokens.
    assert!(v2_revoked.require_not_rolled_back(v2_revoked.version()).is_ok());
    assert!(matches!(verify(&token_for(&payload(), &old), &v2_revoked), Err(LicenseError::RevokedKey(_))));
}

fn base64url(bytes: &[u8]) -> String {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    URL_SAFE_NO_PAD.encode(bytes)
}

#[allow(dead_code)]
fn _payload_type_used(_: &LicensePayload) {}
