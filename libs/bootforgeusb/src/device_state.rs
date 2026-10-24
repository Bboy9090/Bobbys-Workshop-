//! Conservative device-state diagnostics. USB descriptors cannot prove FRP status.
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceDiagnostic {
    pub status: &'static str,
    pub detail: String,
    pub safe_to_attempt_mtp: bool,
    pub firmware_write_authorized: bool,
}

pub fn classify_mtp_claim(interface_is_imaging: bool, claim_error: Option<&str>) -> DeviceDiagnostic {
    if !interface_is_imaging {
        return DeviceDiagnostic { status: "unsupportedInterface", detail: "The selected USB interface does not advertise imaging/PTP. No MTP command was sent.".into(), safe_to_attempt_mtp: false, firmware_write_authorized: false };
    }
    if let Some(error) = claim_error {
        return DeviceDiagnostic { status: "interfaceUnavailable", detail: format!("USB imaging interface could not be claimed: {error}. Check OS driver ownership and device connection. Setup/FRP status cannot be determined from this error."), safe_to_attempt_mtp: false, firmware_write_authorized: false };
    }
    DeviceDiagnostic { status: "imagingInterfaceAvailable", detail: "USB imaging interface can be claimed. This does not establish MTP session readiness or device unlock state.".into(), safe_to_attempt_mtp: true, firmware_write_authorized: false }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn access_denied_is_not_misreported_as_frp() {
        let result = classify_mtp_claim(true, Some("Access denied"));
        assert_eq!(result.status, "interfaceUnavailable");
        assert!(!result.safe_to_attempt_mtp);
        assert!(!result.firmware_write_authorized);
        assert!(result.detail.contains("cannot be determined"));
    }
    #[test] fn non_imaging_is_never_mtp_ready() {
        assert_eq!(classify_mtp_claim(false, None).status, "unsupportedInterface");
    }
    #[test] fn imaging_claim_is_not_firmware_authorization() {
        let state = classify_mtp_claim(true, None);
        assert!(state.safe_to_attempt_mtp);
        assert!(!state.firmware_write_authorized);
    }
}

/// Descriptor-only assessment for display in read-only diagnostic surfaces.
/// This does not attempt to claim the USB interface or infer device lock state.
pub fn diagnose_transport(device: &crate::transport::TransportDevice) -> Vec<DeviceDiagnostic> {
    let mut seen = std::collections::BTreeSet::new();
    let mut result = Vec::new();
    for ep in &device.endpoints {
        if !seen.insert((ep.configuration, ep.interface, ep.alternate_setting)) { continue; }
        let imaging = (ep.interface_class, ep.interface_subclass, ep.interface_protocol) == (6, 1, 1);
        if imaging {
            result.push(DeviceDiagnostic { status: "imagingInterfaceDetected", detail: format!("Interface {} advertises imaging/PTP 06/01/01; ownership, protocol handshake, and setup/FRP state remain unverified.", ep.interface), safe_to_attempt_mtp: false, firmware_write_authorized: false });
        } else {
            result.push(classify_mtp_claim(false, None));
        }
    }
    result
}
