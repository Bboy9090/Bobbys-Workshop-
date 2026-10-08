use bootforgeusb::{firmware, planner, recovery, scan, transport};
use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(
    name = "bootforgeusb",
    version,
    about = "BobFWTools native device transport and firmware inspection core"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Enumerate USB devices using the native libusb/rusb backend.
    Scan {
        /// Include interface/endpoint transport details.
        #[arg(long)]
        endpoints: bool,
    },
    /// Verify and inspect one or more firmware TAR/.tar.md5 packages.
    Inspect {
        #[arg(required = true)]
        packages: Vec<PathBuf>,
    },
    /// Build a non-executing Samsung/Odin flash plan from verified packages.
    Plan {
        #[arg(required = true)]
        packages: Vec<PathBuf>,
    },
    /// Detect connected devices that are in EDL or MediaTek Download/Preloader mode.
    RecoveryScan,
    /// Build a non-executing recovery plan for EDL or MediaTek Download/Preloader.
    RecoveryPlan {
        #[arg(long)]
        kind: String,
        #[arg(required = true)]
        artifacts: Vec<PathBuf>,
    },
    /// Build an audited recovery job with normalized partition operations and artifact hashes.
    RecoveryJob {
        #[arg(long)]
        kind: String,
        #[arg(long)]
        device_uid: String,
        #[arg(long)]
        vid: String,
        #[arg(long)]
        pid: String,
        #[arg(long)]
        mode: String,
        #[arg(required = true)]
        artifacts: Vec<PathBuf>,
    },
}

fn json<T: serde::Serialize>(value: &T) {
    println!(
        "{}",
        serde_json::to_string_pretty(value).expect("serialize output")
    );
}

fn main() {
    let cli = Cli::parse();
    let result: Result<(), String> = match cli
        .command
        .unwrap_or(Commands::Scan { endpoints: false })
    {
        Commands::Scan { endpoints } => {
            if endpoints {
                transport::scan_transports()
                    .map(|v| json(&v))
                    .map_err(|e| e.to_string())
            } else {
                scan().map(|v| json(&v)).map_err(|e| e.to_string())
            }
        }
        Commands::Inspect { packages } => firmware::inspect_many(packages)
            .map(|v| json(&v))
            .map_err(|e| e.to_string()),
        Commands::Plan { packages } => firmware::inspect_many(packages)
            .map(|reports| planner::build_samsung_plan(&reports))
            .map(|plan| json(&plan))
            .map_err(|e| e.to_string()),
        Commands::RecoveryScan => transport::scan_transports()
            .map(|devices| recovery::scan_recovery_candidates(&devices))
            .map(|candidates| json(&candidates))
            .map_err(|e| e.to_string()),
        Commands::RecoveryPlan { kind, artifacts } => recovery::RecoveryKind::parse(&kind)
            .and_then(|kind| recovery::build_recovery_plan(kind, artifacts))
            .map(|plan| json(&plan))
            .map_err(|e| e.to_string()),
        Commands::RecoveryJob {
            kind,
            device_uid,
            vid,
            pid,
            mode,
            artifacts,
        } => {
            let parsed = (|| -> Result<bootforgeusb::recovery_job::RecoveryJob, String> {
                let workflow = recovery::RecoveryKind::parse(&kind).map_err(|e| e.to_string())?;
                let parse_hex = |value: &str| -> Result<u16, String> {
                    let clean = value
                        .trim()
                        .trim_start_matches("0x")
                        .trim_start_matches("0X");
                    u16::from_str_radix(clean, 16)
                        .map_err(|e| format!("invalid hex USB ID {value}: {e}"))
                };
                let plan = recovery::build_recovery_plan(workflow, artifacts)
                    .map_err(|e| e.to_string())?;
                let candidate = recovery::RecoveryCandidate {
                    device_uid,
                    vendor_id: parse_hex(&vid)?,
                    product_id: parse_hex(&pid)?,
                    detected_mode: mode,
                    workflow,
                    product_name: None,
                    serial_number: None,
                };
                bootforgeusb::recovery_job::build_job(&candidate, &plan).map_err(|e| e.to_string())
            })();
            parsed.map(|job| json(&job))
        }
    };
    if let Err(err) = result {
        eprintln!("ERROR: {err}");
        std::process::exit(1);
    }
}
