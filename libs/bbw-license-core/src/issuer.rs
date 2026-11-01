//! Server-side license issuance. Compiled only with the `issuer` feature, which the desktop
//! build never enables. The signing key must come from a secret store, never from source.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use ed25519_dalek::{Signer, SigningKey};

use crate::{LicenseError, LicensePayload, TOKEN_PREFIX};

pub fn issue(payload: &LicensePayload, key: &SigningKey) -> Result<String, LicenseError> {
    payload.validate_shape()?;
    let bytes = serde_json::to_vec(payload)
        .map_err(|_| LicenseError::Malformed("payload cannot be encoded"))?;
    let signature = key.sign(&bytes);
    Ok(format!(
        "{}.{}.{}",
        TOKEN_PREFIX,
        URL_SAFE_NO_PAD.encode(&bytes),
        URL_SAFE_NO_PAD.encode(signature.to_bytes())
    ))
}
