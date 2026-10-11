use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirehoseWriteRequest {
    pub image_bytes: u64,
    pub start_sector: u64,
    pub physical_partition: u32,
    pub sector_size: u64,
    pub chunk_size: u64,
    pub partition_start_sector: Option<u64>,
    pub partition_sector_count: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirehoseChunk {
    pub index: u64,
    pub file_offset: u64,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirehoseWritePlan {
    pub allowed: bool,
    pub reasons: Vec<String>,
    pub warnings: Vec<String>,
    pub start_sector: u64,
    pub physical_partition: u32,
    pub sector_size: u64,
    pub image_bytes: u64,
    pub num_partition_sectors: u64,
    pub padded_bytes: u64,
    pub end_sector_exclusive: u64,
    pub chunk_size: u64,
    pub chunks: Vec<FirehoseChunk>,
    pub dry_run_only: bool,
    pub executor_qualified: bool,
}

fn checked_ceil_div(value: u64, divisor: u64) -> Option<u64> {
    if divisor == 0 {
        return None;
    }
    value.checked_add(divisor - 1)?.checked_div(divisor)
}

pub fn build_write_plan(request: &FirehoseWriteRequest) -> FirehoseWritePlan {
    let mut reasons = Vec::new();
    let mut warnings = Vec::new();

    if request.image_bytes == 0 {
        reasons.push("image is empty".to_string());
    }
    if !matches!(request.sector_size, 512 | 4096) {
        reasons.push(format!("unsupported sector size {}", request.sector_size));
    }
    if request.chunk_size < 4096 || request.chunk_size > 4 * 1024 * 1024 {
        reasons.push("chunk size must be between 4 KiB and 4 MiB".to_string());
    }
    if request.chunk_size % 4096 != 0 {
        reasons.push("chunk size must be aligned to 4 KiB".to_string());
    }

    let num_partition_sectors = checked_ceil_div(request.image_bytes, request.sector_size).unwrap_or(0);
    let padded_bytes = num_partition_sectors.checked_mul(request.sector_size).unwrap_or(0);
    if num_partition_sectors == 0 || padded_bytes == 0 {
        reasons.push("sector math overflow or zero-length plan".to_string());
    }

    let end_sector_exclusive = request
        .start_sector
        .checked_add(num_partition_sectors)
        .unwrap_or_else(|| {
            reasons.push("target sector range overflows u64".to_string());
            0
        });

    match (request.partition_start_sector, request.partition_sector_count) {
        (Some(bound_start), Some(bound_count)) => {
            let bound_end = bound_start.checked_add(bound_count).unwrap_or_else(|| {
                reasons.push("partition bound overflows u64".to_string());
                0
            });
            if request.start_sector < bound_start || end_sector_exclusive > bound_end {
                reasons.push(format!(
                    "write range {}..{} exceeds verified partition bounds {}..{}",
                    request.start_sector, end_sector_exclusive, bound_start, bound_end
                ));
            }
        }
        (None, None) => warnings.push(
            "partition bounds are not known yet; execution must remain blocked until rawprogram/GPT bounds are verified"
                .to_string(),
        ),
        _ => reasons.push("partition start/count bounds must be supplied together".to_string()),
    }

    let mut chunks = Vec::new();
    if request.image_bytes > 0 && request.chunk_size > 0 {
        let mut offset = 0u64;
        let mut index = 0u64;
        while offset < request.image_bytes {
            let remaining = request.image_bytes - offset;
            let bytes = remaining.min(request.chunk_size);
            chunks.push(FirehoseChunk {
                index,
                file_offset: offset,
                bytes,
            });
            offset = match offset.checked_add(bytes) {
                Some(v) => v,
                None => {
                    reasons.push("chunk offset overflow".to_string());
                    break;
                }
            };
            index = index.saturating_add(1);
            if chunks.len() > 1_000_000 {
                reasons.push("chunk plan is unreasonably large".to_string());
                break;
            }
        }
    }

    FirehoseWritePlan {
        allowed: reasons.is_empty(),
        reasons,
        warnings,
        start_sector: request.start_sector,
        physical_partition: request.physical_partition,
        sector_size: request.sector_size,
        image_bytes: request.image_bytes,
        num_partition_sectors,
        padded_bytes,
        end_sector_exclusive,
        chunk_size: request.chunk_size,
        chunks,
        dry_run_only: true,
        executor_qualified: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rounds_image_to_sector_boundary() {
        let plan = build_write_plan(&FirehoseWriteRequest {
            image_bytes: 513,
            start_sector: 100,
            physical_partition: 0,
            sector_size: 512,
            chunk_size: 4096,
            partition_start_sector: Some(100),
            partition_sector_count: Some(16),
        });
        assert!(plan.allowed);
        assert_eq!(plan.num_partition_sectors, 2);
        assert_eq!(plan.padded_bytes, 1024);
        assert_eq!(plan.end_sector_exclusive, 102);
    }

    #[test]
    fn blocks_out_of_bounds_write() {
        let plan = build_write_plan(&FirehoseWriteRequest {
            image_bytes: 8192,
            start_sector: 100,
            physical_partition: 0,
            sector_size: 512,
            chunk_size: 4096,
            partition_start_sector: Some(100),
            partition_sector_count: Some(8),
        });
        assert!(!plan.allowed);
    }

    #[test]
    fn remains_dry_run_only() {
        let plan = build_write_plan(&FirehoseWriteRequest {
            image_bytes: 4096,
            start_sector: 0,
            physical_partition: 0,
            sector_size: 512,
            chunk_size: 4096,
            partition_start_sector: None,
            partition_sector_count: None,
        });
        assert!(plan.dry_run_only);
        assert!(!plan.executor_qualified);
    }
}
