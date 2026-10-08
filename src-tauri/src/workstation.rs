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

fn command_present(program: &str, version_args: &[&str]) -> bool {
    Command::new(program)
        .args(version_args)
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false)
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

    let tools = vec![
        ToolReadiness {
            id: "adb",
            present: command_present("adb", &["version"]),
            detail: "Android Debug Bridge".to_string(),
        },
        ToolReadiness {
            id: "fastboot",
            present: command_present("fastboot", &["--version"]),
            detail: "Android Fastboot".to_string(),
        },
        ToolReadiness {
            id: "lz4",
            present: command_present("lz4", &["--version"]),
            detail: "LZ4 firmware decompression".to_string(),
        },
        ToolReadiness {
            id: "simg2img",
            present: command_present("simg2img", &["--help"]),
            detail: "Android sparse-image conversion".to_string(),
        },
    ];

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

    WorkstationReadiness {
        os,
        architecture,
        workspace_root: workspace_root().display().to_string(),
        workspace_paths: paths,
        tools,
        drivers,
        ready_for_diagnostics: true,
        ready_for_android_service: root_exists && (adb || fastboot || (!windows || samsung_detected || qualcomm_detected)),
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
