/// Every reason a license or reconciliation check can fail. Callers must treat any
/// variant as "not licensed"; there is no partial success.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LicenseError {
    Malformed(&'static str),
    UnsupportedVersion(u64),
    NonCanonicalPayload,
    UnknownKey(String),
    RevokedKey(String),
    BadSignature,
    ProductMismatch,
    EditionNotAllowed(String),
    ForbiddenFeature(String),
    MissingFeature(String),
    NotYetValid,
    Expired,
    ClockRollback { observed: u64, high_water: u64 },
    TrustStoreRollback { presented: u64, last_seen: u64 },
    UnknownFeature(String),
    NotProvisioned(String),
    MissingInventory(String),
}
