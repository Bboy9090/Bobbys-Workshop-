use crate::firmware::FirmwareArchiveReport;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlashPlan {
    pub protocol: String,
    pub mode_required: String,
    pub execution_enabled: bool,
    pub destructive: bool,
    pub requires_explicit_approval: bool,
    pub preserves_userdata_by_design: bool,
    pub roles: Vec<String>,
    pub package_paths: Vec<String>,
    pub planned_payloads: Vec<String>,
    pub safety_checks: Vec<String>,
    pub warnings: Vec<String>,
}

pub fn build_samsung_plan(reports: &[FirmwareArchiveReport]) -> FlashPlan {
    let roles: Vec<String> = reports.iter().map(|r| r.role.clone()).collect();
    let has_csc = reports.iter().any(|r| r.role == "CSC");
    let has_home_csc = reports.iter().any(|r| r.role == "HOME_CSC");
    let has_pit = reports.iter().any(|r| r.contains_pit);
    let destructive = has_csc || has_pit;
    let preserve = has_home_csc && !has_csc && !has_pit;

    let mut planned_payloads = Vec::new();
    for report in reports {
        for entry in &report.entries {
            if entry.kind == "manifest" || entry.kind == "other" {
                continue;
            }
            if has_home_csc && !report.download_list.is_empty() {
                let name = std::path::Path::new(&entry.path)
                    .file_name()
                    .and_then(|v| v.to_str())
                    .unwrap_or("");
                if !report
                    .download_list
                    .iter()
                    .any(|v| v.eq_ignore_ascii_case(name))
                    && entry.kind != "pit"
                {
                    continue;
                }
            }
            planned_payloads.push(entry.path.clone());
        }
    }
    planned_payloads.sort();
    planned_payloads.dedup();

    let mut warnings = Vec::new();
    if has_csc {
        warnings.push(
            "Full CSC selected: user data may be erased and the partition layout may be rewritten."
                .to_string(),
        );
    }
    if has_home_csc {
        warnings.push("HOME_CSC is preservation-first only; dynamic SUPER capacity must be validated before writes.".to_string());
    }
    if !roles.iter().any(|r| r == "BL") {
        warnings.push("No BL package supplied.".to_string());
    }
    if !roles.iter().any(|r| r == "AP") {
        warnings.push("No AP package supplied.".to_string());
    }

    FlashPlan {
        protocol: "samsung-odin".to_string(),
        mode_required: "samsung-download".to_string(),
        execution_enabled: false,
        destructive,
        requires_explicit_approval: destructive,
        preserves_userdata_by_design: preserve,
        roles,
        package_paths: reports.iter().map(|r| r.path.clone()).collect(),
        planned_payloads,
        safety_checks: vec![
            "Re-enumerate and re-identify USB device immediately before execution".to_string(),
            "Verify every .tar.md5 package before opening a write session".to_string(),
            "Reject bootloader rollback/downgrade when device revision is known".to_string(),
            "Map payloads against active/package PIT before writes".to_string(),
            "Require explicit approval for wipe/repartition operations".to_string(),
            "Never treat FRP/OEM/KG security state as bypassable".to_string(),
        ],
        warnings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::firmware::FirmwareArchiveReport;

    fn report(role: &str, pit: bool) -> FirmwareArchiveReport {
        FirmwareArchiveReport {
            path: format!("{role}.tar.md5"),
            role: role.into(),
            file_size: 1,
            md5_verified: Some(true),
            embedded_md5: None,
            calculated_md5: None,
            contains_pit: pit,
            contains_userdata: false,
            contains_metadata: false,
            download_list: vec![],
            entries: vec![],
            warnings: vec![],
        }
    }

    #[test]
    fn csc_plan_is_destructive_and_gated() {
        let plan = build_samsung_plan(&[
            report("BL", false),
            report("AP", false),
            report("CSC", true),
        ]);
        assert!(plan.destructive);
        assert!(plan.requires_explicit_approval);
        assert!(!plan.execution_enabled);
    }

    #[test]
    fn home_csc_plan_is_preservation_first() {
        let plan = build_samsung_plan(&[
            report("BL", false),
            report("AP", false),
            report("HOME_CSC", false),
        ]);
        assert!(!plan.destructive);
        assert!(plan.preserves_userdata_by_design);
    }
}
