//! Cryptographic core for BobFWTools Phoenix Sanctum:
//! - Hardware-bound HMAC-SHA256 Chamber Grants (`SanctumChamberGrant`)
//! - Tamper-evident SHA-256 hash-chained Shadow Ledger (`SanctumChainEntry`, `SanctumChainVerification`)

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

pub const SANCTUM_GRANT_TTL_SECS: u64 = 1800; // 30-minute hardware-bound session window

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SanctumChamberGrant {
    pub grant_id: String,
    pub chamber: String,
    pub bound_serial: Option<String>,
    pub operator_phrase_verified: bool,
    pub issued_at_unix_secs: u64,
    pub expires_at_unix_secs: u64,
    pub workstation_fingerprint: String,
    pub hmac_signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SanctumChainEntry {
    pub sequence: u64,
    pub timestamp_unix_ms: u64,
    pub chamber: String,
    pub operation: String,
    pub serial: Option<String>,
    pub status: String,
    pub detail: String,
    pub artifact_sha256: Option<String>,
    pub prev_hash: String,
    pub entry_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SanctumChainVerification {
    pub chain_path: String,
    pub total_entries: usize,
    pub intact: bool,
    pub genesis_hash: String,
    pub head_hash: String,
    pub broken_at_sequence: Option<u64>,
    pub entries: Vec<SanctumChainEntry>,
}

static SANCTUM_SESSION_SECRET: OnceLock<String> = OnceLock::new();
static SANCTUM_CHAIN_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn workstation_fingerprint() -> String {
    let host = std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "bobfw-workstation".to_string());
    let material = format!(
        "bobfwtools-workstation:{}:{}:{}",
        std::env::consts::OS,
        std::env::consts::ARCH,
        host
    );
    format!("{:x}", Sha256::digest(material.as_bytes()))
}

fn session_secret() -> &'static str {
    SANCTUM_SESSION_SECRET.get_or_init(|| {
        if let Ok(env_secret) = std::env::var("BOBFW_SANCTUM_SECRET") {
            if env_secret.len() >= 16 {
                return env_secret;
            }
        }
        format!(
            "bobfw-sanctum-{}-{}",
            std::process::id(),
            workstation_fingerprint()
        )
    })
}

/// RFC 2104 HMAC-SHA256 implementation over `sha2::Sha256`.
pub fn hmac_sha256_hex(key: &[u8], message: &[u8]) -> String {
    const BLOCK_SIZE: usize = 64;
    let mut key_block = [0u8; BLOCK_SIZE];
    if key.len() > BLOCK_SIZE {
        let hashed = Sha256::digest(key);
        key_block[..hashed.len()].copy_from_slice(&hashed);
    } else {
        key_block[..key.len()].copy_from_slice(key);
    }

    let mut ipad = [0x36u8; BLOCK_SIZE];
    let mut opad = [0x5cu8; BLOCK_SIZE];
    for i in 0..BLOCK_SIZE {
        ipad[i] ^= key_block[i];
        opad[i] ^= key_block[i];
    }

    let mut inner = Sha256::new();
    inner.update(ipad);
    inner.update(message);
    let inner_hash = inner.finalize();

    let mut outer = Sha256::new();
    outer.update(opad);
    outer.update(inner_hash);
    format!("{:x}", outer.finalize())
}

pub fn compute_grant_hmac(
    grant_id: &str,
    chamber: &str,
    bound_serial: Option<&str>,
    issued_at_unix_secs: u64,
    expires_at_unix_secs: u64,
    workstation_fp: &str,
) -> String {
    let canonical = format!(
        "v1|{grant_id}|{chamber}|{}|{issued_at_unix_secs}|{expires_at_unix_secs}|{workstation_fp}",
        bound_serial.unwrap_or("*")
    );
    hmac_sha256_hex(session_secret().as_bytes(), canonical.as_bytes())
}

pub fn issue_chamber_grant(
    chamber: &str,
    serial: Option<String>,
    confirmation_phrase: &str,
) -> Result<SanctumChamberGrant, String> {
    let normalized_phrase = confirmation_phrase.trim().to_ascii_uppercase();
    let valid_phrases = ["SANCTUM", "PHOENIX-SANCTUM", "ROOT", "UNLOCK"];
    if !valid_phrases.contains(&normalized_phrase.as_str()) {
        return Err(
            "Confirmation phrase rejected. Type 'SANCTUM' (or 'ROOT') to unlock a hardware-bound Phoenix Sanctum chamber."
                .to_string(),
        );
    }

    let valid_chambers = ["root-vault", "silicon-fuse", "baseband-crucible", "all"];
    if !valid_chambers.contains(&chamber) {
        return Err(format!("Unsupported Phoenix Sanctum chamber '{chamber}'."));
    }

    let bound_serial = serial
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let issued_at_unix_secs = now_secs();
    let expires_at_unix_secs = issued_at_unix_secs + SANCTUM_GRANT_TTL_SECS;
    let workstation_fp = workstation_fingerprint();
    let nonce_digest = format!(
        "{:x}",
        Sha256::digest(
            format!("{chamber}:{}:{}:{}", bound_serial.as_deref().unwrap_or("*"), now_ms(), workstation_fp).as_bytes()
        )
    );
    let grant_id = format!("sanctum-{}", &nonce_digest[..16]);

    let hmac_signature = compute_grant_hmac(
        &grant_id,
        chamber,
        bound_serial.as_deref(),
        issued_at_unix_secs,
        expires_at_unix_secs,
        &workstation_fp,
    );

    Ok(SanctumChamberGrant {
        grant_id,
        chamber: chamber.to_string(),
        bound_serial,
        operator_phrase_verified: true,
        issued_at_unix_secs,
        expires_at_unix_secs,
        workstation_fingerprint: workstation_fp,
        hmac_signature,
    })
}

pub fn verify_sanctum_grant(
    grant: &SanctumChamberGrant,
    expected_serial: Option<&str>,
) -> Result<(), String> {
    let now = now_secs();
    if now > grant.expires_at_unix_secs {
        return Err("Phoenix Sanctum chamber grant has expired. Re-issue a fresh hardware-bound grant.".to_string());
    }
    if !grant.operator_phrase_verified {
        return Err("Phoenix Sanctum grant does not carry operator phrase verification.".to_string());
    }
    if grant.workstation_fingerprint != workstation_fingerprint() {
        return Err("Phoenix Sanctum grant workstation fingerprint mismatch.".to_string());
    }
    if let (Some(bound), Some(expected)) = (grant.bound_serial.as_deref(), expected_serial) {
        if bound != "*" && bound != expected {
            return Err(format!(
                "Phoenix Sanctum grant is bound to serial '{bound}', not '{expected}'."
            ));
        }
    }

    let expected_hmac = compute_grant_hmac(
        &grant.grant_id,
        &grant.chamber,
        grant.bound_serial.as_deref(),
        grant.issued_at_unix_secs,
        grant.expires_at_unix_secs,
        &grant.workstation_fingerprint,
    );

    if expected_hmac != grant.hmac_signature {
        return Err("Phoenix Sanctum grant HMAC signature verification failed.".to_string());
    }
    Ok(())
}

pub fn sanctum_chain_path() -> PathBuf {
    if let Ok(custom) = std::env::var("BOBFW_SANCTUM_CHAIN_PATH") {
        if !custom.trim().is_empty() {
            return PathBuf::from(custom);
        }
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
        .join(".bobfwtools")
        .join("logs")
        .join("sanctum-chain.jsonl")
}

pub fn compute_chain_entry_hash(
    sequence: u64,
    timestamp_unix_ms: u64,
    chamber: &str,
    operation: &str,
    serial: Option<&str>,
    status: &str,
    detail: &str,
    artifact_sha256: Option<&str>,
    prev_hash: &str,
) -> String {
    let payload = serde_json::json!({
        "seq": sequence,
        "ts": timestamp_unix_ms,
        "chamber": chamber,
        "op": operation,
        "serial": serial.unwrap_or(""),
        "status": status,
        "detail": detail,
        "artifact": artifact_sha256.unwrap_or(""),
        "prev": prev_hash,
    });
    format!("{:x}", Sha256::digest(payload.to_string().as_bytes()))
}

pub fn append_sanctum_chain_entry(
    chamber: &str,
    operation: &str,
    serial: Option<String>,
    status: &str,
    detail: &str,
    artifact_sha256: Option<String>,
) -> Result<SanctumChainEntry, String> {
    append_sanctum_chain_entry_at(
        &sanctum_chain_path(),
        chamber,
        operation,
        serial,
        status,
        detail,
        artifact_sha256,
    )
}

pub fn append_sanctum_chain_entry_at(
    path: &std::path::Path,
    chamber: &str,
    operation: &str,
    serial: Option<String>,
    status: &str,
    detail: &str,
    artifact_sha256: Option<String>,
) -> Result<SanctumChainEntry, String> {
    let _guard = SANCTUM_CHAIN_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| "Failed to acquire Sanctum chain lock".to_string())?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create Sanctum log directory: {e}"))?;
    }

    let mut last_seq = 0u64;
    let mut prev_hash = "0".repeat(64);

    if path.exists() {
        let file = fs::File::open(path)
            .map_err(|e| format!("Failed to read Sanctum chain ledger: {e}"))?;
        let reader = BufReader::new(file);
        for line in reader.lines().map_while(Result::ok) {
            if line.trim().is_empty() {
                continue;
            }
            if let Ok(entry) = serde_json::from_str::<SanctumChainEntry>(&line) {
                last_seq = entry.sequence;
                prev_hash = entry.entry_hash;
            }
        }
    }

    let sequence = last_seq + 1;
    let timestamp_unix_ms = now_ms();
    let entry_hash = compute_chain_entry_hash(
        sequence,
        timestamp_unix_ms,
        chamber,
        operation,
        serial.as_deref(),
        status,
        detail,
        artifact_sha256.as_deref(),
        &prev_hash,
    );

    let entry = SanctumChainEntry {
        sequence,
        timestamp_unix_ms,
        chamber: chamber.to_string(),
        operation: operation.to_string(),
        serial,
        status: status.to_string(),
        detail: detail.to_string(),
        artifact_sha256,
        prev_hash,
        entry_hash,
    };

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| format!("Failed to open Sanctum chain ledger for append: {e}"))?;
    let serialized = serde_json::to_string(&entry)
        .map_err(|e| format!("Failed to serialize Sanctum chain entry: {e}"))?;
    writeln!(file, "{serialized}")
        .map_err(|e| format!("Failed to write Sanctum chain entry: {e}"))?;

    Ok(entry)
}

pub fn verify_sanctum_chain(limit: Option<usize>) -> Result<SanctumChainVerification, String> {
    verify_sanctum_chain_at(&sanctum_chain_path(), limit)
}

pub fn verify_sanctum_chain_at(
    path: &std::path::Path,
    limit: Option<usize>,
) -> Result<SanctumChainVerification, String> {
    let genesis = "0".repeat(64);
    if !path.exists() {
        return Ok(SanctumChainVerification {
            chain_path: path.display().to_string(),
            total_entries: 0,
            intact: true,
            genesis_hash: genesis.clone(),
            head_hash: genesis,
            broken_at_sequence: None,
            entries: Vec::new(),
        });
    }

    let file = fs::File::open(path)
        .map_err(|e| format!("Failed to open Sanctum chain ledger: {e}"))?;
    let reader = BufReader::new(file);

    let mut expected_prev = genesis.clone();
    let mut expected_seq = 1u64;
    let mut intact = true;
    let mut broken_at = None;
    let mut all_entries = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed reading Sanctum chain line: {e}"))?;
        if line.trim().is_empty() {
            continue;
        }
        let entry: SanctumChainEntry = serde_json::from_str(&line)
            .map_err(|e| format!("Corrupted Sanctum chain JSON entry: {e}"))?;

        let recomputed = compute_chain_entry_hash(
            entry.sequence,
            entry.timestamp_unix_ms,
            &entry.chamber,
            &entry.operation,
            entry.serial.as_deref(),
            &entry.status,
            &entry.detail,
            entry.artifact_sha256.as_deref(),
            &entry.prev_hash,
        );

        if intact
            && (entry.sequence != expected_seq
                || entry.prev_hash != expected_prev
                || entry.entry_hash != recomputed)
        {
            intact = false;
            broken_at = Some(entry.sequence);
        }

        expected_prev = entry.entry_hash.clone();
        expected_seq = entry.sequence + 1;
        all_entries.push(entry);
    }

    let total_entries = all_entries.len();
    let head_hash = all_entries
        .last()
        .map(|e| e.entry_hash.clone())
        .unwrap_or_else(|| genesis.clone());

    all_entries.reverse();
    all_entries.truncate(limit.unwrap_or(50).min(250));

    Ok(SanctumChainVerification {
        chain_path: path.display().to_string(),
        total_entries,
        intact,
        genesis_hash: genesis,
        head_hash,
        broken_at_sequence: broken_at,
        entries: all_entries,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc4231_hmac_sha256_test_vector_matches() {
        // RFC 4231 Test Case 2: key = "Jefe", data = "what do ya want for nothing?"
        let digest = hmac_sha256_hex(b"Jefe", b"what do ya want for nothing?");
        assert_eq!(
            digest,
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
        );
    }

    #[test]
    fn issues_and_verifies_hmac_bound_chamber_grant() {
        let grant = issue_chamber_grant(
            "root-vault",
            Some("R58M999888".to_string()),
            "SANCTUM",
        )
        .expect("should issue grant");

        assert!(grant.operator_phrase_verified);
        assert_eq!(grant.chamber, "root-vault");
        assert!(verify_sanctum_grant(&grant, Some("R58M999888")).is_ok());
        assert!(
            verify_sanctum_grant(&grant, Some("DIFFERENT_SERIAL")).is_err(),
            "grant bound to R58M999888 must reject a different device serial"
        );
    }

    #[test]
    fn rejects_invalid_confirmation_phrase_and_tampered_hmac() {
        let bad = issue_chamber_grant("root-vault", None, "WRONG_PHRASE");
        assert!(bad.is_err());

        let mut grant = issue_chamber_grant(
            "silicon-fuse",
            Some("DEV_01".to_string()),
            "SANCTUM",
        )
        .expect("valid grant");
        grant.bound_serial = Some("DEV_02".to_string());
        assert!(
            verify_sanctum_grant(&grant, Some("DEV_02")).is_err(),
            "tampering with bound_serial must invalidate HMAC signature"
        );
    }

    #[test]
    fn shadow_chain_ledger_detects_tampering_and_verifies_hash_links() {
        let temp_dir = tempfile::tempdir().expect("tempdir");
        let chain_file = temp_dir.path().join("sanctum-chain.jsonl");

        let e1 = append_sanctum_chain_entry_at(
            &chain_file,
            "root-vault",
            "test-op-1",
            Some("SER_A".to_string()),
            "completed",
            "First entry",
            Some("abc123".to_string()),
        )
        .expect("append entry 1");
        let e2 = append_sanctum_chain_entry_at(
            &chain_file,
            "silicon-fuse",
            "test-op-2",
            Some("SER_A".to_string()),
            "completed",
            "Second entry",
            None,
        )
        .expect("append entry 2");

        assert_eq!(e1.sequence, 1);
        assert_eq!(e2.sequence, 2);
        assert_eq!(e2.prev_hash, e1.entry_hash);

        let verified = verify_sanctum_chain_at(&chain_file, Some(10)).expect("verify chain");
        assert!(verified.intact);
        assert_eq!(verified.total_entries, 2);
        assert_eq!(verified.head_hash, e2.entry_hash);

        // Tamper with entry 1 on disk and confirm verification catches it
        let content = std::fs::read_to_string(&chain_file).unwrap();
        let tampered = content.replace("First entry", "Tampered entry");
        std::fs::write(&chain_file, tampered).unwrap();

        let after_tamper = verify_sanctum_chain_at(&chain_file, Some(10)).expect("verify tampered chain");
        assert!(!after_tamper.intact);
        assert_eq!(after_tamper.broken_at_sequence, Some(1));
    }
}
