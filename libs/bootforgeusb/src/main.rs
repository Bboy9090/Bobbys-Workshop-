use bootforgeusb::{edl, firmware, mtk_brom, phoenix_sanctum, planner, recovery, scan, trapdoor, transport};
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
    /// Benchmark a single native bulk IN endpoint on an explicitly selected USB device.
    ReadBenchmark {
        #[arg(long)] bus: u8,
        #[arg(long)] address: u8,
        #[arg(long)] interface: Option<u8>,
        #[arg(long, default_value_t = 16)] reads: u32,
        #[arg(long, default_value_t = 1000)] timeout_ms: u64,
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
    /// Issue a hardware-bound HMAC-SHA256 Phoenix Sanctum chamber grant and append to the shadow hash chain.
    SanctumGrant {
        #[arg(long, default_value = "all")]
        chamber: String,
        #[arg(long)]
        serial: Option<String>,
        #[arg(long, default_value = "SANCTUM")]
        phrase: String,
    },
    /// Verify the tamper-evident SHA-256 hash-chained Phoenix Sanctum shadow ledger.
    SanctumVerifyChain {
        #[arg(long, default_value_t = 50)]
        limit: usize,
    },
    /// List native Trapdoor / Bobby's Workshop tool classifications and availability.
    TrapdoorTools,
    /// Live USB probe of a connected Qualcomm EDL (05c6:9008) device to read its Sahara HELLO packet.
    EdlProbe {
        #[arg(long, default_value_t = 2000)]
        timeout_ms: u64,
    },
    /// Live USB handshake and GET_HW_CODE silicon identification on a MediaTek BROM (0e8d:0003) or Preloader (0e8d:2000) device.
    MtkBromProbe {
        #[arg(long, default_value_t = 2000)]
        timeout_ms: u64,
    },
    /// Parse a binary Primary GPT image (LBA 0..6) and output all partition entries as JSON.
    ParseGpt {
        #[arg(required = true)]
        gpt_file: PathBuf,
        #[arg(long, default_value_t = 4096)]
        sector_size: usize,
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
        Commands::ReadBenchmark { bus, address, interface, reads, timeout_ms } =>
            bootforgeusb::read_benchmark::benchmark_bulk_in(bus, address, interface, reads, timeout_ms)
                .map(|result| json(&result)),
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
        Commands::SanctumGrant {
            chamber,
            serial,
            phrase,
        } => phoenix_sanctum::issue_chamber_grant(&chamber, serial, &phrase).map(|grant| {
            let _ = phoenix_sanctum::append_sanctum_chain_entry(
                &chamber,
                "cli-issue-chamber-grant",
                grant.bound_serial.clone(),
                "granted",
                &format!("Issued HMAC-SHA256 hardware-bound grant {}", grant.grant_id),
                None,
            );
            json(&grant);
        }),
        Commands::SanctumVerifyChain { limit } => {
            phoenix_sanctum::verify_sanctum_chain(Some(limit)).map(|report| json(&report))
        }
        Commands::TrapdoorTools => {
            let runner = trapdoor::TrapdoorRunner::new();
            Ok(json(&runner.list_available_tools()))
        }
        Commands::EdlProbe { timeout_ms } => {
            match edl::probe_edl_sahara_live(timeout_ms) {
                Ok(res) => Ok(json(&serde_json::json!({
                    "connected": true,
                    "statusDetail": format!("Sahara v{} on Bus {} Addr {} (Mode: {:?})", res.hello.version, res.bus, res.address, res.hello.mode),
                    "probe": res
                }))),
                Err(reason) => Ok(json(&serde_json::json!({
                    "connected": false,
                    "statusDetail": reason,
                    "probe": serde_json::Value::Null
                }))),
            }
        }
        Commands::MtkBromProbe { timeout_ms } => {
            match mtk_brom::probe_mtk_brom_live(timeout_ms) {
                Ok(res) => Ok(json(&serde_json::json!({
                    "connected": true,
                    "statusDetail": format!("{} ({}) on Bus {} Addr {}", res.identity.chip_name, res.identity.hw_code_hex, res.bus, res.address),
                    "probe": res
                }))),
                Err(reason) => Ok(json(&serde_json::json!({
                    "connected": false,
                    "statusDetail": reason,
                    "probe": serde_json::Value::Null
                }))),
            }
        }
        Commands::ParseGpt {
            gpt_file,
            sector_size,
        } => std::fs::read(&gpt_file)
            .map_err(|e| format!("failed reading GPT file {}: {e}", gpt_file.display()))
            .and_then(|bytes| edl::parse_gpt_entries(&bytes, sector_size))
            .map(|entries| json(&entries)),
    };
    if let Err(err) = result {
        eprintln!("ERROR: {err}");
        std::process::exit(1);
    }
}
