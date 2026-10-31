use std::collections::BTreeSet;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use ed25519_dalek::VerifyingKey;
use serde::Deserialize;

use crate::LicenseError;

const MAX_TRUSTED_KEYS: usize = 16;

/// Lifecycle of a signing key in the trust store.
///
/// * `Active`: signs new licenses and verifies existing ones.
/// * `Retired`: no longer used for new licenses, still verifies tokens it already signed.
/// * `Revoked`: rejects every token it signed, regardless of expiry. Use on suspected compromise.
///
/// A retired key remains able to verify any token it signed until that token expires, so a
/// key that may already be compromised must be revoked rather than retired.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KeyStatus {
    Active,
    Retired,
    Revoked,
}

#[derive(Debug, Clone)]
pub struct TrustedKey {
    pub key_id: String,
    pub verifying_key: VerifyingKey,
    pub status: KeyStatus,
}

/// A versioned set of trusted public keys. Versions increase monotonically; the client stores
/// the newest version it has accepted and refuses older stores (see `require_not_rolled_back`).
#[derive(Debug, Clone)]
pub struct TrustStore {
    version: u64,
    keys: Vec<TrustedKey>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawKey {
    key_id: String,
    public_key: String,
    status: KeyStatus,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RawStore {
    trust_store_version: u64,
    keys: Vec<RawKey>,
}

impl TrustStore {
    pub fn from_json(text: &str) -> Result<Self, LicenseError> {
        let raw: RawStore = serde_json::from_str(text)
            .map_err(|_| LicenseError::Malformed("trust store does not match schema"))?;
        if raw.keys.is_empty() || raw.keys.len() > MAX_TRUSTED_KEYS {
            return Err(LicenseError::Malformed(
                "trust store key count out of range",
            ));
        }

        let mut seen = BTreeSet::new();
        let mut keys = Vec::with_capacity(raw.keys.len());
        for entry in raw.keys {
            if !seen.insert(entry.key_id.clone()) {
                return Err(LicenseError::Malformed("duplicate key_id in trust store"));
            }
            let bytes = URL_SAFE_NO_PAD
                .decode(&entry.public_key)
                .map_err(|_| LicenseError::Malformed("public key is not base64url"))?;
            let array: [u8; 32] = bytes
                .try_into()
                .map_err(|_| LicenseError::Malformed("public key must be 32 bytes"))?;
            let verifying_key = VerifyingKey::from_bytes(&array)
                .map_err(|_| LicenseError::Malformed("public key is not a valid Ed25519 point"))?;
            keys.push(TrustedKey {
                key_id: entry.key_id,
                verifying_key,
                status: entry.status,
            });
        }

        Ok(Self {
            version: raw.trust_store_version,
            keys,
        })
    }

    pub fn version(&self) -> u64 {
        self.version
    }

    /// Finds the key for a token. Unknown and revoked keys are reported as distinct errors.
    pub fn lookup(&self, key_id: &str) -> Result<&TrustedKey, LicenseError> {
        let key = self
            .keys
            .iter()
            .find(|k| k.key_id == key_id)
            .ok_or_else(|| LicenseError::UnknownKey(key_id.to_string()))?;
        match key.status {
            KeyStatus::Revoked => Err(LicenseError::RevokedKey(key_id.to_string())),
            KeyStatus::Active | KeyStatus::Retired => Ok(key),
        }
    }

    /// Refuses a trust store older than the newest one the client has already accepted.
    /// Without this, an old store that still lists a since-revoked key could be reinstated.
    pub fn require_not_rolled_back(&self, last_seen: u64) -> Result<(), LicenseError> {
        if self.version < last_seen {
            return Err(LicenseError::TrustStoreRollback {
                presented: self.version,
                last_seen,
            });
        }
        Ok(())
    }
}
