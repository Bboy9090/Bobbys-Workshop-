use std::collections::{BTreeMap, BTreeSet};

use crate::{LicenseError, VerifiedLicense};

/// Features this desktop build actually implements.
#[derive(Debug, Clone, Default)]
pub struct FeatureRegistry {
    implemented: BTreeSet<String>,
}

impl FeatureRegistry {
    pub fn new<I, S>(features: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        Self {
            implemented: features.into_iter().map(Into::into).collect(),
        }
    }
}

/// Server-side record of which features each license ID was provisioned for.
#[derive(Debug, Clone, Default)]
pub struct ServerInventory {
    provisioned: BTreeMap<String, BTreeSet<String>>,
}

impl ServerInventory {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn provision<I, S>(&mut self, license_id: &str, features: I)
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.provisioned.insert(
            license_id.to_string(),
            features.into_iter().map(Into::into).collect(),
        );
    }

    fn features_for(&self, license_id: &str) -> Option<&BTreeSet<String>> {
        self.provisioned.get(license_id)
    }
}

/// Features granted after reconciliation, plus any provisioned but ungranted features reported
/// for audit. Only `features` may be used to enable behavior.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EffectiveEntitlements {
    pub features: BTreeSet<String>,
    pub not_granted: BTreeSet<String>,
}

/// Cross-checks a verified license against the desktop feature registry and server inventory.
/// Fails closed: a feature the token grants must be implemented by this build and provisioned
/// on the server for this license ID. Anything else is an error, not a silent drop.
pub fn reconcile(
    license: &VerifiedLicense,
    registry: &FeatureRegistry,
    inventory: &ServerInventory,
) -> Result<EffectiveEntitlements, LicenseError> {
    let provisioned = inventory
        .features_for(&license.license_id)
        .ok_or_else(|| LicenseError::MissingInventory(license.license_id.clone()))?;

    for feature in &license.features {
        if !registry.implemented.contains(feature) {
            return Err(LicenseError::UnknownFeature(feature.clone()));
        }
        if !provisioned.contains(feature) {
            return Err(LicenseError::NotProvisioned(feature.clone()));
        }
    }

    let granted: BTreeSet<String> = license.features.iter().cloned().collect();
    let not_granted = provisioned.difference(&granted).cloned().collect();
    Ok(EffectiveEntitlements {
        features: granted,
        not_granted,
    })
}
