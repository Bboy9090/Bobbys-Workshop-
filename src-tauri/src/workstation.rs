use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolReadiness {
    pub id: &'static str,
    pub present: bool,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriverReadiness {
    pub id: &'static str,
    pub applicable: bool,
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
    ]
}

#[cfg(target_os = "windows")]
fn windows_driver_catalog() -> String {
    Command::new("pnputil")
        .args(["/enum-drivers"])
        .output()
        .ok()
        .filter(|out| out.status.success())
        .map(|out| String::from_utf8_lossy(&out.stdout).to_ascii_lowercase())
        .unwrap_or_default()
}

#[cfg(not(target_os = "windows"))]
fn windows_driver_catalog() -> String {
    String::new()
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
        ("adb", &["version"][..], "Android Debug Bridge"),
        ("fastboot", &["--version"][..], "Android Fastboot"),
        ("lz4", &["--version"][..], "LZ4 firmware decompression"),
        ("simg2img", &["--help"][..], "Android sparse-image conversion"),
    ];
    let tools = tool_specs
        .into_iter()
        .map(|(id, args, label)| {
            let resolved = resolve_command(id, args);
            ToolReadiness {
                id,
                present: resolved.is_some(),
                detail: resolved
                    .map(|path| format!("{label} · {}", path.display()))
                    .unwrap_or_else(|| format!("{label} · not found on PATH or in managed tools")),
            }
        })
        .collect::<Vec<_>>();

    let driver_catalog = windows_driver_catalog();
    let windows = cfg!(target_os = "windows");
    let samsung_detected = !windows
        || driver_catalog.contains("samsung")
        || driver_catalog.contains("ssud")
        || driver_catalog.contains("ssudadb");
    let qualcomm_detected = !windows
        || driver_catalog.contains("qualcomm")
        || driver_catalog.contains("qcusb")
        || driver_catalog.contains("qcser")
        || driver_catalog.contains("qdloader");
    let mediatek_detected = !windows
        || driver_catalog.contains("mediatek")
        || driver_catalog.contains("mtk_")
        || driver_catalog.contains("mtk ");

    let drivers = vec![
        DriverReadiness {
            id: "samsung-usb",
            applicable: windows,
            detected: samsung_detected,
            detail: if windows {
                "Samsung Android USB driver evidence from Windows driver store".to_string()
            } else {
                "Not applicable: macOS/Linux use native USB/libusb access".to_string()
            },
            admin_required_for_install: windows && !samsung_detected,
        },
        DriverReadiness {
            id: "qualcomm-qdloader-9008",
            applicable: windows,
            detected: qualcomm_detected,
            detail: if windows {
                "Qualcomm HS-USB/QDLoader driver evidence from Windows driver store".to_string()
            } else {
                "Not applicable: macOS/Linux use native USB/libusb access".to_string()
            },
            admin_required_for_install: windows && !qualcomm_detected,
        },
        DriverReadiness {
            id: "mediatek-usb-vcom",
            applicable: windows,
            detected: mediatek_detected,
            detail: if windows {
                "MediaTek USB/VCOM/Preloader driver evidence from Windows driver store".to_string()
            } else {
                "Not applicable: macOS/Linux use native USB/libusb access".to_string()
            },
            admin_required_for_install: windows && !mediatek_detected,
        },
    ];

    let adb = tools.iter().find(|t| t.id == "adb").map(|t| t.present).unwrap_or(false);
    let fastboot = tools.iter().find(|t| t.id == "fastboot").map(|t| t.present).unwrap_or(false);
    let root_exists = paths.iter().find(|p| p.id == "root").map(|p| p.exists).unwrap_or(false);

    let mut blockers = Vec::new();
    if !root_exists {
        blockers.push("BobFWTools workspace has not been initialized yet.".to_string());
    }
    if windows && !samsung_detected {
        blockers.push("Samsung USB driver not detected in the Windows driver store.".to_string());
    }
    if windows && !qualcomm_detected {
        blockers.push("Qualcomm QDLoader/9008 driver not detected in the Windows driver store.".to_string());
    }
    if windows && !mediatek_detected {
        blockers.push("MediaTek USB/VCOM driver not detected in the Windows driver store.".to_string());
    }

    WorkstationReadiness {
        os,
        architecture,
        workspace_root: workspace_root().display().to_string(),
        workspace_paths: paths,
        tools,
        drivers,
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
        assert!(adb.iter().any(|p| p.to_string_lossy().contains("platform-tools")));
        assert!(fastboot.iter().any(|p| p.to_string_lossy().contains("platform-tools")));
    }

    #[test]
    fn lz4_and_simg2img_have_managed_tool_candidates() {
        let lz4 = managed_tool_candidates("lz4");
        let simg2img = managed_tool_candidates("simg2img");
        assert!(lz4.iter().all(|p| p.to_string_lossy().contains(".bobfwtools")));
        assert!(simg2img.iter().all(|p| p.to_string_lossy().contains(".bobfwtools")));
    }
}
