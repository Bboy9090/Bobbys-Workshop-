#![allow(dead_code)] // Shared integration-test helpers are compiled separately per test target.

//! Shared fixtures. Tokens are forged with ed25519-dalek directly, not through the issuer,
//! so verifier tests do not depend on the code they check.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use bbw_license_core::{LicensePayload, TrustStore};
use ed25519_dalek::{Signer, SigningKey};

pub const ISSUED: u64 = 1_793_062_800;
pub const EXPIRES: u64 = 1_824_598_800;
/// A time comfortably inside the license window.
pub const NOW: u64 = 1_793_100_000;

pub fn key(seed: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed; 32])
}

pub fn public_b64(key: &SigningKey) -> String {
    URL_SAFE_NO_PAD.encode(key.verifying_key().to_bytes())
}

pub fn payload() -> LicensePayload {
    LicensePayload {
        version: 1,
        license_id: "lic_example".into(),
        product_id: "bobbys-workshop".into(),
        edition: "pro".into(),
        features: vec!["diagnostics".into(), "reports".into()],
        issued_at: ISSUED,
        expires_at: EXPIRES,
        key_id: "ed25519-2026-01".into(),
    }
}

pub fn canonical(payload: &LicensePayload) -> Vec<u8> {
    serde_json::to_vec(payload).expect("payload encodes")
}

/// Builds a token from arbitrary payload bytes, signed by `key`.
pub fn sign_bytes(bytes: &[u8], key: &SigningKey) -> String {
    format!(
        "bbwlic1.{}.{}",
        URL_SAFE_NO_PAD.encode(bytes),
        URL_SAFE_NO_PAD.encode(key.sign(bytes).to_bytes())
    )
}

pub fn token_for(payload: &LicensePayload, key: &SigningKey) -> String {
    sign_bytes(&canonical(payload), key)
}

/// Builds a trust store from `(key_id, key, status)` entries.
pub fn store(version: u64, entries: &[(&str, &SigningKey, &str)]) -> TrustStore {
    let keys: Vec<String> = entries
        .iter()
        .map(|(id, key, status)| {
            format!(
                r#"{{"key_id":"{id}","public_key":"{}","status":"{status}"}}"#,
                public_b64(key)
            )
        })
        .collect();
    let json = format!(
        r#"{{"trust_store_version":{version},"keys":[{}]}}"#,
        keys.join(",")
    );
    TrustStore::from_json(&json).expect("fixture trust store parses")
}

pub fn active_store(key: &SigningKey) -> TrustStore {
    store(1, &[("ed25519-2026-01", key, "active")])
}
