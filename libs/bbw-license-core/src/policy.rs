/// Product rules the verifier enforces after the signature is checked.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LicensePolicy {
    pub product_id: &'static str,
    pub allowed_editions: &'static [&'static str],
    /// Features a license may never grant. Device-altering capabilities live here so a
    /// valid paid license cannot unlock them. Hardware permissions are a separate gate.
    pub non_grantable_features: &'static [&'static str],
}

pub const DEFAULT_POLICY: LicensePolicy = LicensePolicy {
    product_id: "bobbys-workshop",
    allowed_editions: &["standard", "pro"],
    non_grantable_features: &[
        "device-write",
        "flash",
        "bootloader-unlock",
        "factory-reset",
        "device-reboot",
    ],
};
