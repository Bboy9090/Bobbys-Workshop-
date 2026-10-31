//! Offline license verification for BobFWTools.
//!
//! The server signs canonical payload bytes with Ed25519. The desktop client holds only
//! public keys in a versioned trust store and verifies the exact signed bytes. License
//! results describe software entitlements only; they never grant device-altering access.

mod error;
mod policy;
mod reconcile;
mod token;
mod trust;

#[cfg(feature = "issuer")]
pub mod issuer;

pub use error::LicenseError;
pub use policy::{LicensePolicy, DEFAULT_POLICY};
pub use reconcile::{reconcile, EffectiveEntitlements, FeatureRegistry, ServerInventory};
pub use token::{
    verify_token, ClockContext, LicensePayload, VerifiedLicense, MAX_FUTURE_SKEW_SECS,
    ROLLBACK_TOLERANCE_SECS, SUPPORTED_VERSION, TOKEN_PREFIX,
};
pub use trust::{KeyStatus, TrustStore, TrustedKey};
