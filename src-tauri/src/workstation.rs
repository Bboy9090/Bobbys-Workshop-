use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolReadiness {
    pub id: &'static str,
    pub present: bool,
    pub required_for_core_android_service: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverReadiness {
    pub id: &'static str,
    pub applicable: bool,
    pub evidence_available: bool,
    pub detected: bool,
    pub detail: String,
    pub admin_required_for_install: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePathReadiness {
    pub id: &'static str,
    pub path: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkstationReadiness {
    pub os: String,
    pub architecture: String,
    pub workspace_root: String,
    pub workspace_paths: Vec<WorkspacePathReadiness>,
    pub tools: Vec<ToolReadiness>,
    pub drivers: Vec<DriverReadiness>,
    pub driver_store_probe_available: bool,
    pub ready_for_diagnostics: bool,
    pub ready_for_android_service: bool,
    pub blockers: Vec<String>,
}

fn command_works(program: &std::path::Path, version_args: &[&str]) -> bool {
    Command::new(program)
        .args(version_args)
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false)
}

fn managed_tool_candidates(program: &str) -> Vec<PathBuf> {
    let root = workspace_root().join("tools");
    #[cfg(target_os = "windows")]
    let executable = format!("{program}.exe");
    #[cfg(not(target_os = "windows"))]
    let executable = program.to_string();

    match program {
        "adb" | "fastboot" => vec![
            root.join("platform-tools").join(&executable),
            root.join(&executable),
        ],
        _ => vec![root.join(&executable)],
    }
}

fn resolve_command(program: &str, version_args: &[&str]) -> Option<PathBuf> {
    let path_program = PathBuf::from(program);
    if command_works(&path_program, version_args) {
        return Some(path_program);
    }

    managed_tool_candidates(program)
        .into_iter()
        .find(|candidate| candidate.is_file() && command_works(candidate, version_args))
}

fn workspace_root() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".bobfwtools")
}

fn expected_paths() -> Vec<(&'static str, PathBuf)> {
    let root = workspace_root();
    vec![
        ("root", root.clone()),
        ("firmware", root.join("firmware")),
        ("backups", root.join("backups")),
        ("logs", root.join("logs")),
        ("manifests", root.join("manifests")),
        ("jobs", root.join("jobs")),
        ("tools", root.join("tools")),
    ]
}

#[cfg(target_os = "windows")]
fn windows_driver_catalog() -> (bool, String) {
    match Command::new("pnputil").args(["/enum-drivers"]).output() {
        Ok(out) if out.status.success() => (
            true,
            String::from_utf8_lossy(&out.stdout).to_ascii_lowercase(),
        ),
        _ => (false, String::new()),
    }
}

#[cfg(not(target_os = "windows"))]
fn windows_driver_catalog() -> (bool, String) {
    (true, String::new())
}

#[tauri::command]
pub fn workstation_readiness() -> WorkstationReadiness {
    let os = std::env::consts::OS.to_string();
    let architecture = std::env::consts::ARCH.to_string();

    let paths = expected_paths()
        .into_iter()
        .map(|(id, path)| WorkspacePathReadiness {
            id,
            exists: path.exists(),
            path: path.display().to_string(),
        })
        .collect::<Vec<_>>();

    let tool_specs = [
        ("adb", &["version"][..], "Android Debug Bridge", true),
        ("fastboot", &["--version"][..], "Android Fastboot", true),
        ("lz4", &["--version"][..], "LZ4 firmware decompression", false),
        ("simg2img", &["--help"][..], "Android sparse-image conversion", false),
    ];
    let tools = tool_specs
        .into_iter()
        .map(|(id, args, label, required_for_core_android_service)| {
            let resolved = resolve_command(id, args);
            ToolReadiness {
                id,
                present: resolved.is_some(),
                required_for_core_android_service,
                detail: resolved
                    .map(|path| format!("{label} · {}", path.display()))
                    .unwrap_or_else(|| format!("{label} · not found on PATH or in managed tools")),
            }
        })
        .collect::<Vec<_>>();

    let (driver_store_probe_available, driver_catalog) = windows_driver_catalog();
    let windows = cfg!(target_os = "windows");
    let samsung_detected = !windows
        || (driver_store_probe_available
            && (driver_catalog.contains("samsung")
                || driver_catalog.contains("ssud")
                || driver_catalog.contains("ssudadb")));
    let qualcomm_detected = !windows
        || (driver_store_probe_available
            && (driver_catalog.contains("qualcomm")
                || driver_catalog.contains("qcusb")
                || driver_catalog.contains("qcser")
                || driver_catalog.contains("qdloader")));
    let mediatek_detected = !windows
        || (driver_store_probe_available
            && (driver_catalog.contains("mediatek")
                || driver_catalog.contains("mtk_")
                || driver_catalog.contains("mtk ")));

    let drivers = vec![
        DriverReadiness {
            id: "samsung-usb",
            applicable: windows,
            evidence_available: !windows || driver_store_probe_available,
            detected: samsung_detected,
            detail: if !windows {
                "Not applicable: macOS/Linux use native USB/libusb access".to_string()
            } else if !driver_store_probe_available {
                "Windows driver-store evidence unavailable: pnputil /enum-drivers could not be queried".to_string()
            } else if samsung_detected {
                "Samsung Android USB driver evidence detected in Windows driver store".to_string()
            } else {
                "Windows driver store queried; no Samsung Android USB driver evidence found".to_string()
            },
            admin_required_for_install: windows && driver_store_probe_available && !samsung_detected,
        },
        DriverReadiness {
            id: "qualcomm-qdloader-9008",
            applicable: windows,
            evidence_available: !windows || driver_store_probe_available,
            detected: qualcomm_detected,
            detail: if !windows {
                "Not applicable: macOS/Linux use native USB/libusb access".to_string()
            } else if !driver_store_probe_available {
                "Windows driver-store evidence unavailable: pnputil /enum-drivers could not be queried".to_string()
            } else if qualcomm_detected {
                "Qualcomm HS-USB/QDLoader driver evidence detected in Windows driver store".to_string()
            } else {
                "Windows driver store queried; no Qualcomm HS-USB/QDLoader driver evidence found".to_string()
            },
            admin_required_for_install: windows && driver_store_probe_available && !qualcomm_detected,
        },
        DriverReadiness {
            id: "mediatek-usb-vcom",
            applicable: windows,
            evidence_available: !windows || driver_store_probe_available,
            detected: mediatek_detected,
            detail: if !windows {
                "Not applicable: macOS/Linux use native USB/libusb access".to_string()
            } else if !driver_store_probe_available {
                "Windows driver-store evidence unavailable: pnputil /enum-drivers could not be queried".to_string()
            } else if mediatek_detected {
                "MediaTek USB/VCOM/Preloader driver evidence detected in Windows driver store".to_string()
            } else {
                "Windows driver store queried; no MediaTek USB/VCOM/Preloader driver evidence found".to_string()
            },
            admin_required_for_install: windows && driver_store_probe_available && !mediatek_detected,
        },
    ];

    let adb = tools.iter().find(|t| t.id == "adb").map(|t| t.present).unwrap_or(false);
    let fastboot = tools.iter().find(|t| t.id == "fastboot").map(|t| t.present).unwrap_or(false);
    let root_exists = paths.iter().find(|p| p.id == "root").map(|p| p.exists).unwrap_or(false);

    let mut blockers = Vec::new();
    if !root_exists {
        blockers.push("BobFWTools workspace has not been initialized yet.".to_string());
    }
    if windows && !driver_store_probe_available {
        blockers.push(
            "Windows driver-store probe unavailable; BobFWTools cannot prove OEM driver readiness."
                .to_string(),
        );
    } else if windows {
        if !samsung_detected {
            blockers.push("Samsung USB driver not detected in the Windows driver store.".to_string());
        }
        if !qualcomm_detected {
            blockers.push("Qualcomm QDLoader/9008 driver not detected in the Windows driver store.".to_string());
        }
        if !mediatek_detected {
            blockers.push("MediaTek USB/VCOM driver not detected in the Windows driver store.".to_string());
        }
    }

    WorkstationReadiness {
        os,
        architecture,
        workspace_root: workspace_root().display().to_string(),
        workspace_paths: paths,
        tools,
        drivers,
        driver_store_probe_available: !windows || driver_store_probe_available,
        ready_for_diagnostics: true,
        ready_for_android_service: root_exists
            && (adb || fastboot || (!windows || samsung_detected || qualcomm_detected || mediatek_detected)),
        blockers,
    }
}

#[tauri::command]
pub fn workstation_initialize() -> Result<WorkstationReadiness, String> {
    for (_, path) in expected_paths() {
        std::fs::create_dir_all(&path)
            .map_err(|e| format!("Failed to create {}: {e}", path.display()))?;
    }
    Ok(workstation_readiness())
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adb_and_fastboot_have_managed_platform_tools_candidates() {
        let adb = managed_tool_candidates("adb");
        let fastboot = managed_tool_candidates("fastboot");
        let tools_root = workspace_root().join("tools");
        assert!(adb.iter().all(|p| p.starts_with(&tools_root)));
        assert!(fastboot.iter().all(|p| p.starts_with(&tools_root)));
        assert!(adb.iter().any(|p| p.to_string_lossy().contains("platform-tools")));
        assert!(fastboot.iter().any(|p| p.to_string_lossy().contains("platform-tools")));
    }

    #[test]
    fn workspace_initialization_contract_includes_managed_tools_directory() {
        let paths = expected_paths();
        assert!(paths.iter().any(|(id, path)| *id == "tools" && path == &workspace_root().join("tools")));
    }

    #[test]
    fn firmware_helpers_are_optional_until_an_executor_depends_on_them() {
        let readiness = workstation_readiness();
        let lz4 = readiness.tools.iter().find(|tool| tool.id == "lz4").unwrap();
        let simg2img = readiness.tools.iter().find(|tool| tool.id == "simg2img").unwrap();
        assert!(!lz4.required_for_core_android_service);
        assert!(!simg2img.required_for_core_android_service);
    }

    #[test]
    fn lz4_and_simg2img_have_managed_tool_candidates() {
        let lz4 = managed_tool_candidates("lz4");
        let simg2img = managed_tool_candidates("simg2img");
        assert!(lz4.iter().all(|p| p.to_string_lossy().contains(".bobfwtools")));
        assert!(simg2img.iter().all(|p| p.to_string_lossy().contains(".bobfwtools")));
    }
}
