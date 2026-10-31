use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use ed25519_dalek::Signature;
use serde::{Deserialize, Serialize};

use crate::{LicenseError, LicensePolicy, TrustStore};

/// Wire-format prefix. Changing the payload schema requires a new prefix and version.
pub const TOKEN_PREFIX: &str = "bbwlic1";
pub const SUPPORTED_VERSION: u64 = 1;
/// Tokens may be issued slightly ahead of a client clock that is behind real time.
pub const MAX_FUTURE_SKEW_SECS: u64 = 300;
/// Small backwards clock steps (NTP corrections) are tolerated. Larger rollbacks fail closed.
pub const ROLLBACK_TOLERANCE_SECS: u64 = 300;

const MAX_TOKEN_BYTES: usize = 4096;
const MAX_FEATURES: usize = 32;
const MAX_ID_LEN: usize = 64;
const MAX_SLUG_LEN: usize = 32;

/// The signed payload. Field declaration order is the canonical serialization order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LicensePayload {
    pub version: u64,
    pub license_id: String,
    pub product_id: String,
    pub edition: String,
    pub features: Vec<String>,
    pub issued_at: u64,
    pub expires_at: u64,
    pub key_id: String,
}

impl LicensePayload {
    /// Structural checks shared by the verifier and the issuer.
    pub fn validate_shape(&self) -> Result<(), LicenseError> {
        if self.version != SUPPORTED_VERSION {
            return Err(LicenseError::UnsupportedVersion(self.version));
        }
        check_license_id(&self.license_id, MAX_ID_LEN)?;
        check_slug(&self.key_id, MAX_ID_LEN, "key_id")?;
        check_slug(&self.product_id, MAX_SLUG_LEN, "product_id")?;
        check_slug(&self.edition, MAX_SLUG_LEN, "edition")?;
        if self.features.len() > MAX_FEATURES {
            return Err(LicenseError::Malformed("too many features"));
        }
        for feature in &self.features {
            check_slug(feature, MAX_SLUG_LEN, "feature")?;
        }
        // Features must be strictly ascending so there is exactly one canonical list.
        if self.features.windows(2).any(|pair| pair[0] >= pair[1]) {
            return Err(LicenseError::Malformed("features must be sorted and unique"));
        }
        if self.issued_at >= self.expires_at {
            return Err(LicenseError::Malformed("expires_at must be after issued_at"));
        }
        Ok(())
    }
}

/// Lowercase slugs: product, edition, feature names, and key IDs.
fn check_slug(value: &str, max_len: usize, field: &'static str) -> Result<(), LicenseError> {
    let valid = !value.is_empty()
        && value.len() <= max_len
        && value
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_');
    if valid { Ok(()) } else { Err(LicenseError::Malformed(field)) }
}

/// License IDs keep their case so support staff can match them against records.
fn check_license_id(value: &str, max_len: usize) -> Result<(), LicenseError> {
    let valid = !value.is_empty()
        && value.len() <= max_len
        && value.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    if valid { Ok(()) } else { Err(LicenseError::Malformed("license_id")) }
}

/// Clock inputs supplied by the caller. `high_water` is the newest timestamp the client has
/// ever accepted, persisted locally; 0 means none recorded yet.
///
/// Offline clock checks are not tamper-proof: a user who controls the machine clock can
/// defeat them. The rollback check exists to fail closed on accidental or casual rollback,
/// not to resist a determined local attacker.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ClockContext {
    pub now: u64,
    pub high_water: u64,
}

/// The result of a successful verification. Describes software entitlements only.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerifiedLicense {
    pub license_id: String,
    pub edition: String,
    pub features: Vec<String>,
    pub expires_at: u64,
    pub key_id: String,
}

impl VerifiedLicense {
    pub fn has_feature(&self, feature: &str) -> bool {
        self.features.iter().any(|f| f == feature)
    }
}

/// Verifies a token and returns its entitlements. Checks run in this order: format, version,
/// canonical form, trusted key, signature, then product, edition, feature and time claims.
/// Claims are not acted on until the signature has been verified.
pub fn verify_token(
    token: &str,
    trust: &TrustStore,
    policy: &LicensePolicy,
    clock: ClockContext,
) -> Result<VerifiedLicense, LicenseError> {
    if token.len() > MAX_TOKEN_BYTES {
        return Err(LicenseError::Malformed("token too large"));
    }
    let mut segments = token.split('.');
    let (Some(prefix), Some(payload_segment), Some(signature_segment), None) =
        (segments.next(), segments.next(), segments.next(), segments.next())
    else {
        return Err(LicenseError::Malformed("token must have three segments"));
    };
    if prefix != TOKEN_PREFIX {
        return Err(LicenseError::Malformed("unknown token prefix"));
    }

    let payload_bytes = URL_SAFE_NO_PAD
        .decode(payload_segment)
        .map_err(|_| LicenseError::Malformed("payload is not base64url"))?;
    let signature_bytes = URL_SAFE_NO_PAD
        .decode(signature_segment)
        .map_err(|_| LicenseError::Malformed("signature is not base64url"))?;
    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|_| LicenseError::Malformed("signature must be 64 bytes"))?;

    // Read the version before the typed parse so an unsupported version is reported as such.
    let raw: serde_json::Value = serde_json::from_slice(&payload_bytes)
        .map_err(|_| LicenseError::Malformed("payload is not JSON"))?;
    let version = raw
        .get("version")
        .and_then(serde_json::Value::as_u64)
        .ok_or(LicenseError::Malformed("version missing"))?;
    if version != SUPPORTED_VERSION {
        return Err(LicenseError::UnsupportedVersion(version));
    }

    let payload: LicensePayload = serde_json::from_slice(&payload_bytes)
        .map_err(|_| LicenseError::Malformed("payload does not match schema"))?;
    payload.validate_shape()?;

    // Exactly one byte sequence per payload. Anything else (spacing, key order, duplicate
    // keys) is rejected even if its signature is valid.
    let canonical = serde_json::to_vec(&payload)
        .map_err(|_| LicenseError::Malformed("payload cannot be re-encoded"))?;
    if canonical != payload_bytes {
        return Err(LicenseError::NonCanonicalPayload);
    }

    let key = trust.lookup(&payload.key_id)?;
    key.verifying_key
        .verify_strict(&payload_bytes, &signature)
        .map_err(|_| LicenseError::BadSignature)?;

    if payload.product_id != policy.product_id {
        return Err(LicenseError::ProductMismatch);
    }
    if !policy.allowed_editions.contains(&payload.edition.as_str()) {
        return Err(LicenseError::EditionNotAllowed(payload.edition.clone()));
    }
    if let Some(feature) = payload
        .features
        .iter()
        .find(|f| policy.non_grantable_features.contains(&f.as_str()))
    {
        return Err(LicenseError::ForbiddenFeature(feature.clone()));
    }

    if clock.high_water > clock.now.saturating_add(ROLLBACK_TOLERANCE_SECS) {
        return Err(LicenseError::ClockRollback {
            observed: clock.now,
            high_water: clock.high_water,
        });
    }
    if payload.issued_at > clock.now.saturating_add(MAX_FUTURE_SKEW_SECS) {
        return Err(LicenseError::NotYetValid);
    }
    if clock.now >= payload.expires_at {
        return Err(LicenseError::Expired);
    }

    Ok(VerifiedLicense {
        license_id: payload.license_id,
        edition: payload.edition,
        features: payload.features,
        expires_at: payload.expires_at,
        key_id: payload.key_id,
    })
}
